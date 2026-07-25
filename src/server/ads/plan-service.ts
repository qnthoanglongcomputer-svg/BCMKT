import Decimal from 'decimal.js'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/server/audit/log'
import { PLATFORM_LABEL, PLATFORM_ORDER, type AdsPlatform } from '@/server/dashboard/channel-metrics'

/**
 * Mục tiêu quảng cáo theo kênh + tháng, để dashboard so thực tế với kế hoạch.
 */

export class AdsPlanError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AdsPlanError'
  }
}

const money = (label: string) =>
  z
    .string()
    .trim()
    .default('0')
    .refine((v) => /^\d+(\.\d+)?$/.test(v || '0'), `${label} phải là số không âm`)

const count = (label: string) =>
  z.number({ message: `${label} phải là số` }).int().min(0, `${label} không được âm`)

export const saveAdsPlanSchema = z.object({
  platform: z.enum(['FACEBOOK', 'GOOGLE', 'TIKTOK', 'ZALO', 'COCCOC']),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  spendTarget: money('Chi phí mục tiêu'),
  revenueTarget: money('Doanh thu mục tiêu'),
  leadsTarget: count('Lead mục tiêu'),
  ordersTarget: count('Đơn mục tiêu'),
})

export type SaveAdsPlanInput = z.infer<typeof saveAdsPlanSchema>

export async function saveAdsPlan(
  input: SaveAdsPlanInput,
  actorId: string,
): Promise<{ id: string }> {
  const existing = await prisma.adsChannelPlan.findUnique({
    where: {
      platform_year_month: {
        platform: input.platform,
        year: input.year,
        month: input.month,
      },
    },
    select: { id: true, spendTarget: true },
  })

  return prisma.$transaction(async (tx) => {
    const row = await tx.adsChannelPlan.upsert({
      where: {
        platform_year_month: {
          platform: input.platform,
          year: input.year,
          month: input.month,
        },
      },
      update: {
        spendTarget: new Decimal(input.spendTarget || '0').toFixed(2),
        revenueTarget: new Decimal(input.revenueTarget || '0').toFixed(2),
        leadsTarget: input.leadsTarget,
        ordersTarget: input.ordersTarget,
        updatedBy: actorId,
      },
      create: {
        platform: input.platform,
        year: input.year,
        month: input.month,
        spendTarget: new Decimal(input.spendTarget || '0').toFixed(2),
        revenueTarget: new Decimal(input.revenueTarget || '0').toFixed(2),
        leadsTarget: input.leadsTarget,
        ordersTarget: input.ordersTarget,
        createdBy: actorId,
        updatedBy: actorId,
      },
    })

    await logAudit(tx, {
      actorId,
      action: existing ? 'UPDATE' : 'CREATE',
      entityType: 'ads_channel_plan',
      entityId: row.id,
      changes: [
        { field: 'platform', oldValue: null, newValue: input.platform },
        { field: 'period', oldValue: null, newValue: `${input.month}/${input.year}` },
        {
          field: 'spendTarget',
          oldValue: existing?.spendTarget.toString() ?? null,
          newValue: new Decimal(input.spendTarget || '0').toFixed(2),
        },
      ],
    })

    return { id: row.id }
  })
}

export interface AdsPlanRow {
  platform: AdsPlatform
  label: string
  spendTarget: string
  revenueTarget: string
  leadsTarget: number
  ordersTarget: number
}

/**
 * Mục tiêu của cả 5 kênh trong một tháng, luôn trả đủ 5 dòng (kênh chưa đặt
 * hiện giá trị 0) để form nhập được liền một lượt.
 */
export async function listAdsPlans(year: number, month: number): Promise<AdsPlanRow[]> {
  const rows = await prisma.adsChannelPlan.findMany({
    where: { year, month },
    select: {
      platform: true,
      spendTarget: true,
      revenueTarget: true,
      leadsTarget: true,
      ordersTarget: true,
    },
  })
  const byPlatform = new Map(rows.map((r) => [r.platform as AdsPlatform, r]))

  return PLATFORM_ORDER.map((platform) => {
    const r = byPlatform.get(platform)
    return {
      platform,
      label: PLATFORM_LABEL[platform],
      spendTarget: r?.spendTarget.toString() ?? '0',
      revenueTarget: r?.revenueTarget.toString() ?? '0',
      leadsTarget: r?.leadsTarget ?? 0,
      ordersTarget: r?.ordersTarget ?? 0,
    }
  })
}
