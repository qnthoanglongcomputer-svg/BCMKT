import Decimal from 'decimal.js'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/server/audit/log'
import {
  EMPTY_TOTALS,
  computeCampaignMetrics,
  type CampaignMetrics,
  type CampaignTotals,
} from './metrics'

export class CampaignServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CampaignServiceError'
  }
}

export const saveCampaignSchema = z
  .object({
    id: z.string().optional(),
    code: z
      .string()
      .trim()
      .min(2, 'Mã phải có ít nhất 2 ký tự')
      .regex(/^[A-Z][A-Z0-9_]*$/, 'Mã chỉ gồm chữ in hoa, số và gạch dưới'),
    name: z.string().trim().min(1, 'Chưa nhập tên chiến dịch'),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày bắt đầu không hợp lệ'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày kết thúc không hợp lệ'),
    budget: z.string().optional(),
    isActive: z.boolean().default(true),
  })
  .refine((d) => d.endDate >= d.startDate, {
    path: ['endDate'],
    message: 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu',
  })

export type SaveCampaignInput = z.infer<typeof saveCampaignSchema>

export interface CampaignListItem {
  id: string
  code: string
  name: string
  startDate: Date
  endDate: Date
  budget: string | null
  isActive: boolean
  metrics: CampaignMetrics
}

/** Ngày lịch từ chuỗi yyyy-MM-dd, ở UTC-midnight như mọi ngày khác trong hệ thống. */
function toUtcDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(Date.UTC(y as number, (m as number) - 1, d as number))
}

/**
 * Gom số nguyên liệu của các campaign từ hai nguồn:
 *   1. `ads_insights` — dữ liệu đồng bộ từ nền tảng quảng cáo
 *   2. `report_details` của báo cáo đã `APPROVED` — số nhập tay
 *
 * Cộng **tử và mẫu** trước, tính tỷ lệ sau. Đây là lý do không lưu sẵn CPA/ROAS.
 */
async function collectTotals(campaignIds: string[]): Promise<Map<string, CampaignTotals>> {
  if (campaignIds.length === 0) return new Map()

  const [adsRows, reportRows] = await Promise.all([
    prisma.adsInsight.groupBy({
      by: ['campaignId'],
      where: { campaignId: { in: campaignIds } },
      _sum: { spend: true, revenue: true, leads: true, impressions: true, clicks: true, conversions: true },
    }),
    prisma.reportDetail.findMany({
      where: {
        report: { campaignId: { in: campaignIds }, status: 'APPROVED' },
      },
      select: {
        value: true,
        report: { select: { campaignId: true } },
        kpiDefinition: { select: { code: true } },
      },
    }),
  ])

  const result = new Map<string, CampaignTotals>()
  const ensure = (id: string) => {
    const existing = result.get(id)
    if (existing) return existing
    const fresh: CampaignTotals = {
      ...EMPTY_TOTALS,
      spend: new Decimal(0),
      revenue: new Decimal(0),
    }
    result.set(id, fresh)
    return fresh
  }

  for (const row of adsRows) {
    if (!row.campaignId) continue
    const totals = ensure(row.campaignId)
    result.set(row.campaignId, {
      spend: totals.spend.plus(row._sum.spend?.toString() ?? 0),
      revenue: totals.revenue.plus(row._sum.revenue?.toString() ?? 0),
      leads: totals.leads + (row._sum.leads ?? 0),
      orders: totals.orders + (row._sum.conversions ?? 0),
      impressions: totals.impressions + (row._sum.impressions ?? 0),
      clicks: totals.clicks + (row._sum.clicks ?? 0),
    })
  }

  // Số nhập tay: cộng thêm vào đúng ô tương ứng theo mã metric.
  for (const row of reportRows) {
    const campaignId = row.report.campaignId
    if (!campaignId) continue
    const totals = ensure(campaignId)
    const value = new Decimal(row.value.toString())

    switch (row.kpiDefinition.code) {
      case 'SPEND':
        totals.spend = totals.spend.plus(value)
        break
      case 'REVENUE':
        totals.revenue = totals.revenue.plus(value)
        break
      case 'LEAD':
        totals.leads += value.toNumber()
        break
      case 'ORDERS':
        totals.orders += value.toNumber()
        break
      case 'IMPRESSIONS':
        totals.impressions += value.toNumber()
        break
      case 'CLICKS':
        totals.clicks += value.toNumber()
        break
      default:
        // Metric khác không tham gia vào chỉ số hiệu quả của campaign.
        break
    }
  }

  return result
}

/**
 * Chiến dịch là dữ liệu cấp phòng, không gắn phòng ban cụ thể nên không lọc
 * được theo scope. Vì vậy **quyền truy cập được chặn ở tầng route**: chi phí,
 * doanh thu và ROI toàn chiến dịch không dành cho nhân viên (đặc tả mục 20).
 */
export async function listCampaigns(): Promise<CampaignListItem[]> {
  const campaigns = await prisma.campaign.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      code: true,
      name: true,
      startDate: true,
      endDate: true,
      budget: true,
      isActive: true,
    },
    orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
  })

  const totalsById = await collectTotals(campaigns.map((c) => c.id))

  const items = campaigns.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    startDate: c.startDate,
    endDate: c.endDate,
    budget: c.budget?.toString() ?? null,
    isActive: c.isActive,
    metrics: computeCampaignMetrics(
      totalsById.get(c.id) ?? { ...EMPTY_TOTALS, spend: new Decimal(0), revenue: new Decimal(0) },
      c.budget ? new Decimal(c.budget.toString()) : null,
    ),
  }))

  // Sắp theo ROI giảm dần trong nhóm đang chạy; campaign chưa có dữ liệu xuống cuối.
  return items.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
    const roiA = a.metrics.roi?.toNumber() ?? Number.NEGATIVE_INFINITY
    const roiB = b.metrics.roi?.toNumber() ?? Number.NEGATIVE_INFINITY
    return roiB - roiA
  })
}

export interface CampaignDetail extends CampaignListItem {
  /** Đóng góp của từng bộ phận, dựa trên báo cáo đã duyệt gắn campaign này */
  contributions: Array<{ departmentName: string; metricName: string; value: string; unit: string }>
  /** Chi phí và doanh thu theo ngày, cho biểu đồ xu hướng */
  daily: Array<{ date: string; spend: number; revenue: number }>
  platforms: Array<{ platform: string; spend: string; leads: number; cpa: string | null }>
}

/** Xem chú thích của `listCampaigns` về nơi chặn quyền. */
export async function getCampaign(id: string): Promise<CampaignDetail | null> {
  const campaign = await prisma.campaign.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      code: true,
      name: true,
      startDate: true,
      endDate: true,
      budget: true,
      isActive: true,
    },
  })
  if (!campaign) return null

  const [totalsById, contributionRows, dailyRows, platformRows] = await Promise.all([
    collectTotals([id]),
    prisma.reportDetail.findMany({
      where: { report: { campaignId: id, status: 'APPROVED' } },
      select: {
        value: true,
        report: { select: { department: { select: { name: true } } } },
        kpiDefinition: { select: { name: true, unit: true } },
      },
    }),
    prisma.adsInsight.groupBy({
      by: ['date'],
      where: { campaignId: id },
      _sum: { spend: true, revenue: true },
      orderBy: { date: 'asc' },
    }),
    prisma.adsInsight.groupBy({
      by: ['platform'],
      where: { campaignId: id },
      _sum: { spend: true, leads: true },
    }),
  ])

  // Gộp đóng góp theo (bộ phận, chỉ số) để không liệt kê từng dòng báo cáo.
  const contributionMap = new Map<string, { departmentName: string; metricName: string; unit: string; value: Decimal }>()
  for (const row of contributionRows) {
    const key = `${row.report.department.name}|${row.kpiDefinition.name}`
    const existing = contributionMap.get(key)
    if (existing) {
      existing.value = existing.value.plus(row.value.toString())
    } else {
      contributionMap.set(key, {
        departmentName: row.report.department.name,
        metricName: row.kpiDefinition.name,
        unit: row.kpiDefinition.unit,
        value: new Decimal(row.value.toString()),
      })
    }
  }

  const totals = totalsById.get(id) ?? {
    ...EMPTY_TOTALS,
    spend: new Decimal(0),
    revenue: new Decimal(0),
  }

  return {
    id: campaign.id,
    code: campaign.code,
    name: campaign.name,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    budget: campaign.budget?.toString() ?? null,
    isActive: campaign.isActive,
    metrics: computeCampaignMetrics(
      totals,
      campaign.budget ? new Decimal(campaign.budget.toString()) : null,
    ),
    contributions: [...contributionMap.values()]
      .sort((a, b) => a.departmentName.localeCompare(b.departmentName, 'vi'))
      .map((c) => ({
        departmentName: c.departmentName,
        metricName: c.metricName,
        unit: c.unit,
        value: c.value.toString(),
      })),
    daily: dailyRows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      spend: new Decimal(r._sum.spend?.toString() ?? 0).toNumber(),
      revenue: new Decimal(r._sum.revenue?.toString() ?? 0).toNumber(),
    })),
    platforms: platformRows.map((r) => {
      const spend = new Decimal(r._sum.spend?.toString() ?? 0)
      const leads = r._sum.leads ?? 0
      return {
        platform: r.platform,
        spend: spend.toString(),
        leads,
        cpa: leads === 0 ? null : spend.dividedBy(leads).toFixed(2),
      }
    }),
  }
}

export async function saveCampaign(
  input: SaveCampaignInput,
  actorId: string,
): Promise<{ id: string }> {
  const existing = input.id
    ? await prisma.campaign.findUnique({
        where: { id: input.id },
        select: { id: true, code: true, budget: true, name: true },
      })
    : null

  if (input.id && !existing) {
    throw new CampaignServiceError('Không tìm thấy chiến dịch cần sửa.')
  }
  if (existing && existing.code !== input.code) {
    throw new CampaignServiceError(
      `Không được đổi mã chiến dịch sau khi tạo (hiện tại: ${existing.code}).`,
    )
  }

  const duplicate = await prisma.campaign.findUnique({
    where: { code: input.code },
    select: { id: true },
  })
  if (duplicate && duplicate.id !== input.id) {
    throw new CampaignServiceError(`Mã ${input.code} đã được dùng cho chiến dịch khác.`)
  }

  const budget = input.budget && input.budget.trim() !== '' ? new Decimal(input.budget) : null
  if (budget && budget.lt(0)) {
    throw new CampaignServiceError('Ngân sách không được âm.')
  }

  return prisma.$transaction(async (tx) => {
    const campaign = existing
      ? await tx.campaign.update({
          where: { id: existing.id },
          data: {
            name: input.name,
            startDate: toUtcDate(input.startDate),
            endDate: toUtcDate(input.endDate),
            budget: budget?.toFixed(2) ?? null,
            isActive: input.isActive,
            updatedBy: actorId,
          },
        })
      : await tx.campaign.create({
          data: {
            code: input.code,
            name: input.name,
            startDate: toUtcDate(input.startDate),
            endDate: toUtcDate(input.endDate),
            budget: budget?.toFixed(2) ?? null,
            isActive: input.isActive,
            createdBy: actorId,
            updatedBy: actorId,
          },
        })

    await logAudit(tx, {
      actorId,
      action: existing ? 'UPDATE' : 'CREATE',
      entityType: 'campaign',
      entityId: campaign.id,
      changes: existing
        ? [
            { field: 'name', oldValue: existing.name, newValue: input.name },
            {
              field: 'budget',
              oldValue: existing.budget?.toString() ?? null,
              newValue: budget?.toFixed(2) ?? null,
            },
          ]
        : [{ field: 'code', oldValue: null, newValue: input.code }],
    })

    return { id: campaign.id }
  })
}
