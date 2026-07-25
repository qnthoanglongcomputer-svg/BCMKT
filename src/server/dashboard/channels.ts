import Decimal from 'decimal.js'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
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
import { previousRange, prorateTarget, type DateRange } from './date-range'

/**
 * Dữ liệu cho dashboard hiệu quả kênh quảng cáo.
 *
 * Dữ liệu ads là số cấp phòng, không gắn phòng ban cụ thể nên không lọc theo
 * cây tổ chức được. Vì vậy **quyền được chặn ở tầng route** (nhân viên không
 * xem chi phí/doanh thu toàn kênh) — service này không nhận scope.
 */

/** So sánh một chỉ số giữa kỳ này và kỳ trước / kế hoạch. */
export interface ChannelDelta {
  /** Thay đổi so kỳ trước, dạng tỷ lệ. null khi kỳ trước bằng 0 hoặc không có */
  vsPrevious: number | null
  /** Tỷ lệ đạt so kế hoạch (thực tế / mục tiêu). null khi chưa đặt kế hoạch */
  vsPlan: number | null
  /** Giá trị mục tiêu đã phân bổ theo khoảng ngày; null khi chưa đặt */
  planTarget: number | null
}

export interface ChannelPlanTargets {
  spend: number | null
  revenue: number | null
  leads: number | null
  orders: number | null
}

export interface ChannelRow {
  platform: AdsPlatform
  label: string
  metrics: ChannelMetrics
  /** Tỷ trọng chi phí trên tổng, dùng cho thanh nền trong bảng */
  spendShare: number
  /** So sánh chi phí kỳ này với kỳ trước và kế hoạch */
  spendDelta: ChannelDelta
  /** So sánh doanh thu kỳ này với kỳ trước và kế hoạch */
  revenueDelta: ChannelDelta
}

export interface ChannelTrendPoint {
  date: string
  spend: number
  revenue: number
  leads: number
}

/** Chỉ số tổng kèm so sánh, dùng cho hàng tile trên cùng. */
export interface TotalWithComparison {
  metrics: ChannelMetrics
  plan: ChannelPlanTargets
  /** Thay đổi so kỳ trước, dạng tỷ lệ */
  previous: {
    spend: number | null
    revenue: number | null
    leads: number | null
    orders: number | null
    roas: number | null
    ros: number | null
  }
}

export interface ChannelDashboardData {
  range: DateRange
  previous: { from: Date; to: Date }
  hasData: boolean
  total: TotalWithComparison
  channels: ChannelRow[]
  trend: ChannelTrendPoint[]
}

function toNumber(value: Decimal | null | undefined): number {
  if (value === null || value === undefined) return 0
  return new Decimal(value.toString()).toNumber()
}

/** Thay đổi tỷ lệ (mới − cũ)/cũ; null khi cũ bằng 0. */
function relativeChange(current: Decimal.Value, previous: Decimal.Value): number | null {
  const prev = new Decimal(previous)
  if (prev.isZero()) return null
  return new Decimal(current).minus(prev).dividedBy(prev).toNumber()
}

/** Gom số nguyên liệu theo kênh trong một khoảng ngày. */
async function totalsByPlatform(
  from: Date,
  to: Date,
): Promise<Map<AdsPlatform, ChannelTotals>> {
  const rows = await prisma.adsInsight.groupBy({
    by: ['platform'],
    where: { date: { gte: from, lte: to } },
    _sum: {
      spend: true,
      revenue: true,
      impressions: true,
      clicks: true,
      leads: true,
      conversions: true,
    },
  })

  const map = new Map<AdsPlatform, ChannelTotals>()
  for (const row of rows) {
    map.set(row.platform as AdsPlatform, {
      spend: new Decimal(row._sum.spend?.toString() ?? 0),
      revenue: new Decimal(row._sum.revenue?.toString() ?? 0),
      impressions: row._sum.impressions ?? 0,
      clicks: row._sum.clicks ?? 0,
      leads: row._sum.leads ?? 0,
      orders: row._sum.conversions ?? 0,
    })
  }
  return map
}

function emptyTotals(): ChannelTotals {
  return { ...EMPTY_TOTALS, spend: new Decimal(0), revenue: new Decimal(0) }
}

/**
 * Bảng mục tiêu tháng cho một kênh, dạng Map "yyyy-M" → target, để
 * `prorateTarget` phân bổ theo khoảng ngày.
 */
function targetMap(
  plans: Array<{ platform: string; year: number; month: number } & Record<string, unknown>>,
  platform: AdsPlatform,
  field: 'spendTarget' | 'revenueTarget' | 'leadsTarget' | 'ordersTarget',
): Map<string, Decimal.Value> {
  const map = new Map<string, Decimal.Value>()
  for (const plan of plans) {
    if (plan.platform !== platform) continue
    map.set(`${plan.year}-${plan.month}`, String(plan[field]))
  }
  return map
}

export async function getChannelDashboard(range: DateRange): Promise<ChannelDashboardData> {
  const prev = previousRange(range)

  const [currentByPlatform, prevByPlatform, byDay, plans] = await Promise.all([
    totalsByPlatform(range.from, range.to),
    totalsByPlatform(prev.from, prev.to),
    prisma.adsInsight.groupBy({
      by: ['date'],
      where: { date: { gte: range.from, lte: range.to } },
      _sum: { spend: true, revenue: true, leads: true },
      orderBy: { date: 'asc' },
    }),
    prisma.adsChannelPlan.findMany({
      // Lấy mọi kế hoạch chạm tới khoảng đang xem (khoảng có thể vắt qua tháng).
      where: planWhereForRange(range.from, range.to),
      select: {
        platform: true,
        year: true,
        month: true,
        spendTarget: true,
        revenueTarget: true,
        leadsTarget: true,
        ordersTarget: true,
      },
    }),
  ])

  const allCurrent = sumTotals([...currentByPlatform.values()])
  const allPrev = sumTotals([...prevByPlatform.values()])
  const totalMetrics = computeChannelMetrics(allCurrent)
  const prevMetrics = computeChannelMetrics(allPrev)
  const totalSpend = allCurrent.spend

  // Mục tiêu tổng = tổng mục tiêu từng kênh, phân bổ theo khoảng.
  const sumPlan = (field: 'spendTarget' | 'revenueTarget' | 'leadsTarget' | 'ordersTarget') => {
    let sum = new Decimal(0)
    let matched = false
    for (const platform of PLATFORM_ORDER) {
      const t = prorateTarget(range.from, range.to, targetMap(plans, platform, field))
      if (t !== null) {
        matched = true
        sum = sum.plus(t)
      }
    }
    return matched ? sum.toNumber() : null
  }

  const total: TotalWithComparison = {
    metrics: totalMetrics,
    plan: {
      spend: sumPlan('spendTarget'),
      revenue: sumPlan('revenueTarget'),
      leads: sumPlan('leadsTarget'),
      orders: sumPlan('ordersTarget'),
    },
    previous: {
      spend: relativeChange(allCurrent.spend, allPrev.spend),
      revenue: relativeChange(allCurrent.revenue, allPrev.revenue),
      leads: allPrev.leads === 0 ? null : (allCurrent.leads - allPrev.leads) / allPrev.leads,
      orders: allPrev.orders === 0 ? null : (allCurrent.orders - allPrev.orders) / allPrev.orders,
      roas:
        totalMetrics.roas === null || prevMetrics.roas === null
          ? null
          : relativeChange(totalMetrics.roas, prevMetrics.roas),
      ros:
        totalMetrics.ros === null || prevMetrics.ros === null
          ? null
          : relativeChange(totalMetrics.ros, prevMetrics.ros),
    },
  }

  const channels: ChannelRow[] = PLATFORM_ORDER.map((platform) => {
    const totals = currentByPlatform.get(platform) ?? emptyTotals()
    const prevTotals = prevByPlatform.get(platform) ?? emptyTotals()
    const metrics = computeChannelMetrics(totals)

    const spendPlan = prorateTarget(range.from, range.to, targetMap(plans, platform, 'spendTarget'))
    const revenuePlan = prorateTarget(
      range.from,
      range.to,
      targetMap(plans, platform, 'revenueTarget'),
    )

    return {
      platform,
      label: PLATFORM_LABEL[platform],
      metrics,
      spendShare: totalSpend.isZero() ? 0 : metrics.spend.dividedBy(totalSpend).toNumber(),
      spendDelta: {
        vsPrevious: relativeChange(totals.spend, prevTotals.spend),
        vsPlan: spendPlan && !spendPlan.isZero() ? totals.spend.dividedBy(spendPlan).toNumber() : null,
        planTarget: spendPlan?.toNumber() ?? null,
      },
      revenueDelta: {
        vsPrevious: relativeChange(totals.revenue, prevTotals.revenue),
        vsPlan:
          revenuePlan && !revenuePlan.isZero()
            ? totals.revenue.dividedBy(revenuePlan).toNumber()
            : null,
        planTarget: revenuePlan?.toNumber() ?? null,
      },
    }
  })

  const spendByDay = new Map(
    byDay.map((r) => [
      r.date.getTime(),
      { spend: toNumber(r._sum.spend), revenue: toNumber(r._sum.revenue), leads: r._sum.leads ?? 0 },
    ]),
  )

  const trend: ChannelTrendPoint[] = []
  for (let d = new Date(range.from); d <= range.to; d = new Date(d.getTime() + 86_400_000)) {
    const row = spendByDay.get(d.getTime())
    trend.push({
      date: d.toISOString().slice(0, 10),
      spend: row?.spend ?? 0,
      revenue: row?.revenue ?? 0,
      leads: row?.leads ?? 0,
    })
  }

  return {
    range,
    previous: { from: prev.from, to: prev.to },
    hasData: currentByPlatform.size > 0,
    total,
    channels,
    trend,
  }
}

/** Điều kiện lấy kế hoạch của mọi tháng mà khoảng [from, to] chạm tới. */
function planWhereForRange(from: Date, to: Date): Prisma.AdsChannelPlanWhereInput {
  const months: Array<{ year: number; month: number }> = []
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1))
  const last = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1))
  while (cursor <= last) {
    months.push({ year: cursor.getUTCFullYear(), month: cursor.getUTCMonth() + 1 })
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return { OR: months }
}
