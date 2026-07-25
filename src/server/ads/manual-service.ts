import Decimal from 'decimal.js'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/server/audit/log'
import { PLATFORM_ORDER } from '@/server/dashboard/channel-metrics'

/**
 * Nhập tay số liệu quảng cáo theo kênh + ngày.
 *
 * Tạm thời chưa có connector API (workflow 09). Dữ liệu nhập tay ghi vào chính
 * bảng `ads_insights`; sau này connector sẽ upsert đè cùng khoá tự nhiên nên
 * dashboard không phải đổi.
 *
 * Với nhập tay, dùng sentinel `'MANUAL'` / `'-'` cho các mã ngoài (account,
 * campaign, adset, ad) — vừa giữ khoá unique đầy đủ giá trị (Postgres coi
 * NULL ≠ NULL, upsert theo khoá có null sẽ hỏng), vừa phân biệt được với dữ
 * liệu đồng bộ từ nền tảng.
 */

const MANUAL_ACCOUNT = 'MANUAL'
const MANUAL_SENTINEL = '-'

export class AdsEntryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AdsEntryError'
  }
}

/** Số tiền nhận dạng string để không mất độ chính xác qua JSON. */
const money = (label: string) =>
  z
    .string()
    .trim()
    .default('0')
    .refine((v) => /^\d+(\.\d+)?$/.test(v || '0'), `${label} phải là số không âm`)

const count = (label: string) =>
  z
    .number({ message: `${label} phải là số` })
    .int(`${label} phải là số nguyên`)
    .min(0, `${label} không được âm`)

export const saveAdsEntrySchema = z.object({
  platform: z.enum(['FACEBOOK', 'GOOGLE', 'TIKTOK', 'ZALO', 'COCCOC']),
  /** Ngày lịch yyyy-MM-dd */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ'),
  impressions: count('Lượt hiển thị'),
  clicks: count('Lượt click'),
  spend: money('Chi phí'),
  leads: count('Lead'),
  conversions: count('Số đơn'),
  revenue: money('Doanh thu'),
})

export type SaveAdsEntryInput = z.infer<typeof saveAdsEntrySchema>

function toUtcDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(Date.UTC(y as number, (m as number) - 1, d as number))
}

/**
 * Lưu một dòng số liệu (kênh, ngày). Upsert theo khoá tự nhiên — nhập lại cùng
 * ngày/kênh sẽ ghi đè, không tạo dòng trùng.
 */
export async function saveAdsEntry(
  input: SaveAdsEntryInput,
  actorId: string,
): Promise<{ id: string }> {
  // Chặn số phi lý sớm, ngay tại tầng nghiệp vụ.
  if (input.clicks > input.impressions) {
    throw new AdsEntryError(
      `Số click (${input.clicks}) không thể lớn hơn số hiển thị (${input.impressions}).`,
    )
  }
  if (input.leads > input.clicks && input.clicks > 0) {
    throw new AdsEntryError(
      `Số lead (${input.leads}) không thể lớn hơn số click (${input.clicks}).`,
    )
  }

  const key = {
    platform: input.platform,
    accountId: MANUAL_ACCOUNT,
    campaignExtId: MANUAL_SENTINEL,
    adsetExtId: MANUAL_SENTINEL,
    adExtId: MANUAL_SENTINEL,
    date: toUtcDate(input.date),
  }

  const existing = await prisma.adsInsight.findUnique({
    where: {
      platform_accountId_campaignExtId_adsetExtId_adExtId_date: key,
    },
    select: { id: true },
  })

  return prisma.$transaction(async (tx) => {
    const row = await tx.adsInsight.upsert({
      where: {
        platform_accountId_campaignExtId_adsetExtId_adExtId_date: key,
      },
      update: {
        impressions: input.impressions,
        clicks: input.clicks,
        spend: new Decimal(input.spend || '0').toFixed(2),
        leads: input.leads,
        conversions: input.conversions,
        revenue: new Decimal(input.revenue || '0').toFixed(2),
      },
      create: {
        ...key,
        impressions: input.impressions,
        clicks: input.clicks,
        spend: new Decimal(input.spend || '0').toFixed(2),
        leads: input.leads,
        conversions: input.conversions,
        revenue: new Decimal(input.revenue || '0').toFixed(2),
      },
    })

    await logAudit(tx, {
      actorId,
      action: existing ? 'UPDATE' : 'CREATE',
      entityType: 'ads_insight',
      entityId: row.id,
      changes: [
        { field: 'platform', oldValue: null, newValue: input.platform },
        { field: 'date', oldValue: null, newValue: input.date },
        { field: 'spend', oldValue: null, newValue: input.spend || '0' },
      ],
    })

    return { id: row.id }
  })
}

export interface AdsEntryRow {
  id: string
  platform: string
  date: Date
  impressions: number
  clicks: number
  spend: string
  leads: number
  conversions: number
  revenue: string
}

/** Liệt kê số liệu nhập tay trong một tháng, mới nhất trước. */
export async function listAdsEntries(monthAnchor: Date): Promise<AdsEntryRow[]> {
  const start = new Date(Date.UTC(monthAnchor.getUTCFullYear(), monthAnchor.getUTCMonth(), 1))
  const end = new Date(Date.UTC(monthAnchor.getUTCFullYear(), monthAnchor.getUTCMonth() + 1, 0))

  const rows = await prisma.adsInsight.findMany({
    where: { accountId: MANUAL_ACCOUNT, date: { gte: start, lte: end } },
    select: {
      id: true,
      platform: true,
      date: true,
      impressions: true,
      clicks: true,
      spend: true,
      leads: true,
      conversions: true,
      revenue: true,
    },
    orderBy: [{ date: 'desc' }, { platform: 'asc' }],
  })

  return rows.map((r) => ({
    id: r.id,
    platform: r.platform,
    date: r.date,
    impressions: r.impressions,
    clicks: r.clicks,
    spend: r.spend.toString(),
    leads: r.leads,
    conversions: r.conversions,
    revenue: r.revenue.toString(),
  }))
}

export { PLATFORM_ORDER }
