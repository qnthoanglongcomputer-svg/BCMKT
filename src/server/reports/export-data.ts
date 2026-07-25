import Decimal from 'decimal.js'
import { prisma } from '@/lib/prisma'
import { monthBounds } from '@/server/dashboard/overview'
import { isDepartmentInScope, type Scope } from '@/server/auth/scope'
import type { PeriodType } from '@/lib/format'

export class ExportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExportError'
  }
}

/**
 * Gom dữ liệu cho báo cáo xuất ra file.
 *
 * **Toàn bộ dữ liệu ở đây phải đi qua `scope`.** File xuất ra rời khỏi hệ thống
 * và có thể bị chuyển tiếp — rò rỉ không thu hồi được. Không có đường tắt
 * "lấy hết rồi lọc sau".
 */

export interface ExportFilter {
  periodType: Extract<PeriodType, 'MONTH' | 'QUARTER' | 'YEAR'>
  /** Ngày bất kỳ trong kỳ cần xuất */
  anchor: Date
  /** Giới hạn thêm về một phòng ban cụ thể; phải nằm trong scope */
  departmentId?: string
}

export interface ExportRow {
  departmentName: string
  metricCode: string
  metricName: string
  unit: string
  direction: string
  target: number | null
  actual: number | null
  attainment: number | null
}

export interface ExportPayload {
  meta: {
    title: string
    periodLabel: string
    periodStart: Date
    periodEnd: Date
    departmentFilter: string
    generatedAt: Date
    generatedBy: string
  }
  rows: ExportRow[]
  summary: Array<{ departmentName: string; score: number | null; grade: string | null }>
}

function periodBounds(filter: ExportFilter): { start: Date; end: Date; label: string } {
  const year = filter.anchor.getUTCFullYear()
  const month = filter.anchor.getUTCMonth()

  if (filter.periodType === 'YEAR') {
    return {
      start: new Date(Date.UTC(year, 0, 1)),
      end: new Date(Date.UTC(year, 11, 31)),
      label: `Năm ${year}`,
    }
  }

  if (filter.periodType === 'QUARTER') {
    const quarter = Math.floor(month / 3)
    return {
      start: new Date(Date.UTC(year, quarter * 3, 1)),
      end: new Date(Date.UTC(year, quarter * 3 + 3, 0)),
      label: `Quý ${quarter + 1}/${year}`,
    }
  }

  const bounds = monthBounds(filter.anchor)
  return { ...bounds, label: `Tháng ${month + 1}/${year}` }
}

function toNumber(value: Decimal | null | undefined): number | null {
  if (value === null || value === undefined) return null
  return new Decimal(value.toString()).toNumber()
}

export async function buildExportPayload(
  filter: ExportFilter,
  scope: Scope,
  generatedBy: string,
  now: Date,
): Promise<ExportPayload> {
  const { start, end, label } = periodBounds(filter)

  // Tham số phòng ban đến từ client — kiểm lại với phạm vi, không tin.
  if (filter.departmentId && !isDepartmentInScope(scope, filter.departmentId)) {
    throw new ExportError('Bạn không có quyền xuất dữ liệu của bộ phận này.')
  }

  const allowedIds = filter.departmentId
    ? [filter.departmentId]
    : (scope.departmentIds ?? undefined)

  const departments = await prisma.department.findMany({
    where: {
      deletedAt: null,
      ...(allowedIds ? { id: { in: allowedIds } } : {}),
    },
    select: { id: true, name: true, level: true, sortOrder: true },
    orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
  })

  if (departments.length === 0) {
    return {
      meta: {
        title: 'Báo cáo KPI',
        periodLabel: label,
        periodStart: start,
        periodEnd: end,
        departmentFilter: 'Không có bộ phận nào trong phạm vi',
        generatedAt: now,
        generatedBy,
      },
      rows: [],
      summary: [],
    }
  }

  const departmentIds = departments.map((d) => d.id)
  const nameById = new Map(departments.map((d) => [d.id, d.name]))

  const [targets, actuals, summaries, definitions] = await Promise.all([
    prisma.kpiTarget.findMany({
      where: {
        ownerType: 'DEPARTMENT',
        ownerId: { in: departmentIds },
        periodType: filter.periodType,
        periodStart: start,
      },
      select: { ownerId: true, kpiDefinitionId: true, targetValue: true },
    }),
    prisma.kpiActual.findMany({
      where: {
        ownerType: 'DEPARTMENT',
        ownerId: { in: departmentIds },
        periodType: filter.periodType,
        periodStart: start,
      },
      select: {
        ownerId: true,
        kpiDefinitionId: true,
        actualValue: true,
        numeratorSum: true,
        denominatorSum: true,
      },
    }),
    prisma.kpiSummary.findMany({
      where: {
        ownerType: 'DEPARTMENT',
        ownerId: { in: departmentIds },
        periodType: filter.periodType,
        periodStart: start,
      },
      select: { ownerId: true, score: true, grade: true },
    }),
    prisma.kpiDefinition.findMany({
      select: { id: true, code: true, name: true, unit: true, direction: true, sortOrder: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ])

  const definitionById = new Map(definitions.map((d) => [d.id, d]))
  const actualByKey = new Map(actuals.map((a) => [`${a.ownerId}:${a.kpiDefinitionId}`, a]))

  const rows: ExportRow[] = []

  for (const target of targets) {
    const definition = definitionById.get(target.kpiDefinitionId)
    if (!definition) continue

    const actualRow = actualByKey.get(`${target.ownerId}:${target.kpiDefinitionId}`)
    const targetValue = toNumber(target.targetValue)

    // Metric tỷ lệ: tính lại từ tử/mẫu đã cộng dồn, không lấy giá trị đã lưu.
    let actualValue: number | null = null
    if (actualRow) {
      if (actualRow.numeratorSum !== null && actualRow.denominatorSum !== null) {
        const den = new Decimal(actualRow.denominatorSum.toString())
        actualValue = den.isZero()
          ? null
          : new Decimal(actualRow.numeratorSum.toString()).dividedBy(den).toNumber()
      } else {
        actualValue = toNumber(actualRow.actualValue)
      }
    }

    let attainment: number | null = null
    if (actualValue !== null && targetValue !== null && targetValue !== 0) {
      attainment =
        definition.direction === 'HIGHER_BETTER'
          ? actualValue / targetValue
          : actualValue === 0
            ? 1.2
            : targetValue / actualValue
    }

    rows.push({
      departmentName: nameById.get(target.ownerId) ?? 'Không xác định',
      metricCode: definition.code,
      metricName: definition.name,
      unit: definition.unit,
      direction: definition.direction === 'LOWER_BETTER' ? 'Thấp hơn tốt' : 'Cao hơn tốt',
      target: targetValue,
      actual: actualValue,
      attainment,
    })
  }

  rows.sort(
    (a, b) =>
      a.departmentName.localeCompare(b.departmentName, 'vi') ||
      a.metricName.localeCompare(b.metricName, 'vi'),
  )

  return {
    meta: {
      title: 'Báo cáo KPI',
      periodLabel: label,
      periodStart: start,
      periodEnd: end,
      departmentFilter: filter.departmentId
        ? (nameById.get(filter.departmentId) ?? 'Không xác định')
        : 'Toàn bộ phạm vi được phép',
      generatedAt: now,
      generatedBy,
    },
    rows,
    summary: departments.map((d) => {
      const s = summaries.find((x) => x.ownerId === d.id)
      return {
        departmentName: d.name,
        score: toNumber(s?.score ?? null),
        grade: s?.grade ?? null,
      }
    }),
  }
}
