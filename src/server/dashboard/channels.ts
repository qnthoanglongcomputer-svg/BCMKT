import Decimal from 'decimal.js'
import { prisma } from '@/lib/prisma'
import { daysBetweenInclusive } from '@/server/kpi/period'
import { monthBounds } from './overview'
import {
  EMPTY_TOTALS,
  PLATFORM_LABEL,
  PLATFORM_ORDER,
  computeChannelMetrics,
  sumTotals,
  type AdsPlatform,
  type ChannelMetrics,
  type ChannelTotals,
} from './channel-metrics'

/**
 * Dữ liệu cho dashboard hiệu quả kênh quảng cáo.
 *
 * Dữ liệu ads là số cấp phòng, không gắn phòng ban cụ thể nên không lọc theo
 * cây tổ chức được. Vì vậy **quyền được chặn ở tầng route** (nhân viên không
 * xem chi phí/doanh thu toàn kênh) — service này không nhận scope.
 */

export interface ChannelRow {
  platform: AdsPlatform
  label: string
  metrics: ChannelMetrics
  /** Tỷ trọng chi phí trên tổng, dùng cho thanh nền trong bảng */
  spendShare: number
}

export interface ChannelTrendPoint {
  date: string
  spend: number
  revenue: number
  leads: number
}

export interface ChannelDashboardData {
  period: { start: Date; end: Date; totalDays: number; elapsedDays: number }
  hasData: boolean
  /** Tổng hợp toàn bộ kênh — cho hàng tile trên cùng */
  total: ChannelMetrics
  channels: ChannelRow[]
  trend: ChannelTrendPoint[]
}

function toNumber(value: Decimal | null | undefined): number {
  if (value === null || value === undefined) return 0
  return new Decimal(value.toString()).toNumber()
}

export async function getChannelDashboard(today: Date): Promise<ChannelDashboardData> {
  const { start, end } = monthBounds(today)
  const totalDays = daysBetweenInclusive(start, end)
  const elapsedDays = Math.min(daysBetweenInclusive(start, today), totalDays)

  const [byPlatform, byDay] = await Promise.all([
    prisma.adsInsight.groupBy({
      by: ['platform'],
      where: { date: { gte: start, lte: end } },
      _sum: {
        spend: true,
        revenue: true,
        impressions: true,
        clicks: true,
        leads: true,
        conversions: true,
      },
    }),
    prisma.adsInsight.groupBy({
      by: ['date'],
      where: { date: { gte: start, lte: end } },
      _sum: { spend: true, revenue: true, leads: true },
      orderBy: { date: 'asc' },
    }),
  ])

  const totalsByPlatform = new Map<AdsPlatform, ChannelTotals>()
  for (const row of byPlatform) {
    totalsByPlatform.set(row.platform as AdsPlatform, {
      spend: new Decimal(row._sum.spend?.toString() ?? 0),
      revenue: new Decimal(row._sum.revenue?.toString() ?? 0),
      impressions: row._sum.impressions ?? 0,
      clicks: row._sum.clicks ?? 0,
      leads: row._sum.leads ?? 0,
      orders: row._sum.conversions ?? 0,
    })
  }

  const allTotals = sumTotals([...totalsByPlatform.values()])
  const total = computeChannelMetrics(allTotals)
  const totalSpend = allTotals.spend

  // Giữ thứ tự kênh cố định; kênh chưa có dữ liệu vẫn hiện với giá trị 0/—.
  const channels: ChannelRow[] = PLATFORM_ORDER.map((platform) => {
    const totals =
      totalsByPlatform.get(platform) ??
      ({ ...EMPTY_TOTALS, spend: new Decimal(0), revenue: new Decimal(0) } as ChannelTotals)
    const metrics = computeChannelMetrics(totals)
    return {
      platform,
      label: PLATFORM_LABEL[platform],
      metrics,
      spendShare: totalSpend.isZero() ? 0 : metrics.spend.dividedBy(totalSpend).toNumber(),
    }
  })

  const spendByDay = new Map(
    byDay.map((r) => [
      r.date.getTime(),
      {
        spend: toNumber(r._sum.spend),
        revenue: toNumber(r._sum.revenue),
        leads: r._sum.leads ?? 0,
      },
    ]),
  )

  const trend: ChannelTrendPoint[] = Array.from({ length: elapsedDays }, (_, i) => {
    const day = new Date(start.getTime() + i * 86_400_000)
    const row = spendByDay.get(day.getTime())
    return {
      date: day.toISOString().slice(0, 10),
      spend: row?.spend ?? 0,
      revenue: row?.revenue ?? 0,
      leads: row?.leads ?? 0,
    }
  })

  return {
    period: { start, end, totalDays, elapsedDays },
    hasData: byPlatform.length > 0,
    total,
    channels,
    trend,
  }
}
