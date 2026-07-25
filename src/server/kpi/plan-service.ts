import Decimal from 'decimal.js'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { allocateYear } from './allocation'
import { allocateRatioYear } from './allocation-ratio'
import { logAudit } from '@/server/audit/log'
import { isDepartmentInScope, type Scope } from '@/server/auth/scope'
import type { AllocationResult, AllocationStrategy, OwnerType } from './types'
import type { SavePlanInput } from './schemas'

/**
 * Lưu và phân bổ kế hoạch KPI.
 *
 * Truy vấn DB tách riêng khỏi tính toán: engine (`allocateYear`,
 * `allocateRatioYear`) là hàm thuần, ở đây chỉ đọc/ghi và ghép lại.
 */

export class PlanServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PlanServiceError'
  }
}

/** Chuyển bản ghi 12 tháng dạng string sang khoá số cho engine. */
function toNumericKeys(record: Record<string, string>): Record<number, string> {
  const out: Record<number, string> = {}
  for (const [key, value] of Object.entries(record)) {
    const month = Number(key)
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new PlanServiceError(`Tháng không hợp lệ: ${key}.`)
    }
    out[month] = value
  }
  return out
}

/**
 * Tính bảng phân bổ mà **không ghi DB** — dùng cho khối xem trước trên form.
 * Ném lỗi nghiệp vụ nguyên vẹn để UI hiển thị đúng thông báo.
 */
export async function previewAllocation(input: SavePlanInput): Promise<AllocationResult> {
  const definition = await prisma.kpiDefinition.findUnique({
    where: { id: input.kpiDefinitionId },
    select: { aggregation: true },
  })
  if (!definition) {
    throw new PlanServiceError('Không tìm thấy chỉ số KPI.')
  }
  return computeAllocation(input, definition.aggregation === 'RATIO')
}

function computeAllocation(input: SavePlanInput, isRatio: boolean): AllocationResult {
  if (isRatio) {
    if (!input.monthlyValues) {
      throw new PlanServiceError('Chỉ số tỷ lệ cần nhập mục tiêu cho cả 12 tháng.')
    }
    return allocateRatioYear({
      year: input.year,
      monthlyValues: toNumericKeys(input.monthlyValues),
    })
  }

  if (!input.yearTarget || !input.strategy) {
    throw new PlanServiceError('Thiếu mục tiêu năm hoặc chiến lược phân bổ.')
  }

  return allocateYear({
    year: input.year,
    yearTarget: input.yearTarget,
    strategy: input.strategy,
    monthWeights: input.monthWeights ? toNumericKeys(input.monthWeights) : undefined,
    lockedMonths: input.lockedMonths ? toNumericKeys(input.lockedMonths) : undefined,
  })
}

export interface SavePlanResult {
  planId: string
  targetCount: number
}

/**
 * Lưu kế hoạch và sinh lại toàn bộ `kpi_targets`.
 *
 * Idempotent: **xoá sạch target cũ của plan rồi sinh lại**, không cộng dồn.
 * Toàn bộ nằm trong một transaction — không để lại trạng thái nửa vời.
 */
export async function savePlan(
  input: SavePlanInput,
  actorId: string | null,
): Promise<SavePlanResult> {
  const definition = await prisma.kpiDefinition.findUnique({
    where: { id: input.kpiDefinitionId },
    select: { id: true, code: true, name: true, aggregation: true },
  })
  if (!definition) {
    throw new PlanServiceError('Không tìm thấy chỉ số KPI.')
  }

  const isRatio = definition.aggregation === 'RATIO'
  const allocation = computeAllocation(input, isRatio)

  // Metric RATIO không có "mục tiêu năm" do admin nhập — lưu giá trị năm mà
  // engine suy ra (trung bình có trọng số) để danh sách hiển thị được.
  const yearTarget = isRatio ? allocation.year.value : new Decimal(input.yearTarget as string)

  const existing = input.planId
    ? await prisma.kpiPlan.findUnique({ where: { id: input.planId } })
    : await prisma.kpiPlan.findUnique({
        where: {
          year_ownerType_ownerId_kpiDefinitionId: {
            year: input.year,
            ownerType: input.ownerType,
            ownerId: input.ownerId,
            kpiDefinitionId: input.kpiDefinitionId,
          },
        },
      })

  return prisma.$transaction(async (tx) => {
    const plan = existing
      ? await tx.kpiPlan.update({
          where: { id: existing.id },
          data: {
            yearTarget: yearTarget.toFixed(2),
            strategy: (input.strategy ?? 'MANUAL') as AllocationStrategy,
            monthWeights: (input.monthWeights ?? null) as Prisma.InputJsonValue,
            lockedMonths: (input.monthlyValues ??
              input.lockedMonths ??
              null) as Prisma.InputJsonValue,
            updatedBy: actorId,
          },
        })
      : await tx.kpiPlan.create({
          data: {
            year: input.year,
            ownerType: input.ownerType,
            ownerId: input.ownerId,
            kpiDefinitionId: input.kpiDefinitionId,
            yearTarget: yearTarget.toFixed(2),
            strategy: (input.strategy ?? 'MANUAL') as AllocationStrategy,
            monthWeights: (input.monthWeights ?? null) as Prisma.InputJsonValue,
            lockedMonths: (input.monthlyValues ??
              input.lockedMonths ??
              null) as Prisma.InputJsonValue,
            createdBy: actorId,
            updatedBy: actorId,
          },
        })

    // Xoá và sinh lại: bảo đảm chạy nhiều lần không nhân đôi dữ liệu.
    await tx.kpiTarget.deleteMany({ where: { planId: plan.id } })

    const rows: Prisma.KpiTargetCreateManyInput[] = []
    const base = {
      planId: plan.id,
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      kpiDefinitionId: input.kpiDefinitionId,
    }

    rows.push({
      ...base,
      periodType: 'YEAR',
      periodStart: allocation.year.start,
      periodEnd: allocation.year.end,
      targetValue: allocation.year.value.toFixed(2),
    })
    for (const p of allocation.quarters) {
      rows.push({ ...base, periodType: 'QUARTER', periodStart: p.start, periodEnd: p.end, targetValue: p.value.toFixed(2) })
    }
    for (const p of allocation.months) {
      rows.push({ ...base, periodType: 'MONTH', periodStart: p.start, periodEnd: p.end, targetValue: p.value.toFixed(2) })
    }
    for (const p of allocation.weeks) {
      rows.push({ ...base, periodType: 'WEEK', periodStart: p.start, periodEnd: p.end, targetValue: p.value.toFixed(2) })
    }
    for (const p of allocation.days) {
      rows.push({ ...base, periodType: 'DAY', periodStart: p.start, periodEnd: p.end, targetValue: p.value.toFixed(2) })
    }

    await tx.kpiTarget.createMany({ data: rows })

    await logAudit(tx, {
      actorId,
      action: existing ? 'UPDATE' : 'CREATE',
      entityType: 'kpi_plan',
      entityId: plan.id,
      changes: [
        {
          field: 'yearTarget',
          oldValue: existing ? existing.yearTarget.toString() : null,
          newValue: yearTarget.toFixed(2),
        },
        {
          field: 'strategy',
          oldValue: existing ? existing.strategy : null,
          newValue: input.strategy ?? 'MANUAL',
        },
      ],
    })

    return { planId: plan.id, targetCount: rows.length }
  })
}

export interface PlanListItem {
  id: string
  year: number
  ownerType: OwnerType
  ownerId: string
  ownerName: string
  metricCode: string
  metricName: string
  metricUnit: string
  aggregation: 'SUM' | 'RATIO'
  yearTarget: string
  strategy: AllocationStrategy
  hasActuals: boolean
}

export async function listPlans(year: number, scope: Scope): Promise<PlanListItem[]> {
  const plans = await prisma.kpiPlan.findMany({
    where: {
      year,
      // Chỉ liệt kê kế hoạch của phòng ban trong phạm vi.
      ...(scope.departmentIds === null ? {} : { ownerId: { in: scope.departmentIds } }),
    },
    select: {
      id: true,
      year: true,
      ownerType: true,
      ownerId: true,
      kpiDefinitionId: true,
      yearTarget: true,
      strategy: true,
    },
    orderBy: [{ ownerType: 'asc' }, { createdAt: 'asc' }],
  })

  if (plans.length === 0) return []

  // `KpiPlan` chưa có quan hệ tới `KpiDefinition` trong schema nên phải tra riêng.
  const [departments, definitions] = await Promise.all([
    prisma.department.findMany({
      where: { id: { in: plans.map((p) => p.ownerId) }, deletedAt: null },
      select: { id: true, name: true },
    }),
    prisma.kpiDefinition.findMany({
      where: { id: { in: plans.map((p) => p.kpiDefinitionId) } },
      select: { id: true, code: true, name: true, unit: true, aggregation: true },
    }),
  ])
  const nameById = new Map(departments.map((d) => [d.id, d.name]))
  const definitionById = new Map(definitions.map((d) => [d.id, d]))

  // Đánh dấu kế hoạch đã có dữ liệu thực tế — sửa sẽ làm đổi % đạt các kỳ đã qua.
  const withActuals = await prisma.kpiActual.groupBy({
    by: ['ownerId', 'kpiDefinitionId'],
    where: { ownerId: { in: plans.map((p) => p.ownerId) } },
    _count: { _all: true },
  })
  const actualKeys = new Set(withActuals.map((a) => `${a.ownerId}:${a.kpiDefinitionId}`))

  return plans.map((p) => {
    const definition = definitionById.get(p.kpiDefinitionId)
    return {
      id: p.id,
      year: p.year,
      ownerType: p.ownerType,
      ownerId: p.ownerId,
      ownerName: nameById.get(p.ownerId) ?? 'Không xác định',
      metricCode: definition?.code ?? '—',
      metricName: definition?.name ?? 'Chỉ số không còn tồn tại',
      metricUnit: definition?.unit ?? '',
      aggregation: definition?.aggregation ?? 'SUM',
      yearTarget: p.yearTarget.toString(),
      strategy: p.strategy,
      hasActuals: actualKeys.has(`${p.ownerId}:${p.kpiDefinitionId}`),
    }
  })
}

/**
 * Dữ liệu để dựng form. Danh sách phòng ban đã lọc theo phạm vi — người dùng
 * không chọn được phòng ban họ không có quyền, và server vẫn kiểm lại khi lưu.
 */
export async function getPlanFormOptions(scope: Scope) {
  const [departments, definitions] = await Promise.all([
    prisma.department.findMany({
      where: {
        deletedAt: null,
        ...(scope.departmentIds === null ? {} : { id: { in: scope.departmentIds } }),
      },
      select: { id: true, code: true, name: true, level: true },
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
    }),
    prisma.kpiDefinition.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, unit: true, aggregation: true, direction: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ])
  return { departments, definitions }
}

/** Trả `null` khi kế hoạch nằm ngoài phạm vi — route dùng để trả 404. */
export async function getPlan(planId: string, scope: Scope) {
  const plan = await prisma.kpiPlan.findUnique({
    where: { id: planId },
    select: {
      id: true,
      year: true,
      ownerType: true,
      ownerId: true,
      kpiDefinitionId: true,
      yearTarget: true,
      strategy: true,
      monthWeights: true,
      lockedMonths: true,
    },
  })
  if (!plan) return null
  if (!isDepartmentInScope(scope, plan.ownerId)) return null

  const kpiDefinition = await prisma.kpiDefinition.findUnique({
    where: { id: plan.kpiDefinitionId },
    select: { code: true, name: true, unit: true, aggregation: true },
  })

  return { ...plan, kpiDefinition }
}
