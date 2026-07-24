import Decimal from 'decimal.js'
import { prisma } from '@/lib/prisma'
import { forecastPeriod } from '@/server/kpi/forecast'
import { daysBetweenInclusive } from '@/server/kpi/period'
import { monthBounds } from './overview'
import type { MetricDirection } from '@/server/kpi/types'

/**
 * Dữ liệu cho dashboard của một bộ phận.
 *
 * ⚠️ CHƯA ÁP resolveScope — module xác thực (workflow 01) chưa được xây.
 * Khi làm xong 01, hàm phải nhận `scope` và chặn truy cập bộ phận ngoài phạm vi
 * bằng cách trả null (để route trả 404, không phải 403 — không tiết lộ bộ phận tồn tại).
 */

export interface MetricRow {
  code: string
  name: string
  unit: string
  direction: MetricDirection
  aggregation: 'SUM' | 'RATIO'
  actual: number | null
  target: number | null
  targetToDate: number | null
  attainment: number | null
  delta: number | null
}

export interface DepartmentDashboardData {
  department: { id: string; code: string; name: string }
  period: { start: Date; end: Date; totalDays: number; elapsedDays: number }
  hasData: boolean
  /** Nhóm chỉ số hiển thị theo thứ tự cấu hình cho bộ phận */
  groups: Array<{ title: string; metrics: MetricRow[] }>
  trend: Array<{ date: string; actual: number | null; target: number | null }>
  trendMetric: { name: string; unit: string } | null
  score: { value: number | null; grade: string | null }
  forecast: {
    metricName: string
    value: number | null
    target: number | null
    attainment: number | null
    reason?: string
  } | null
}

/**
 * Bộ chỉ số của từng bộ phận, theo mục 7 đặc tả.
 * Tra theo `department.code`, không hardcode tên tiếng Việt.
 * Bộ phận không có trong bảng này dùng cấu hình `DEFAULT`.
 */
const DEPARTMENT_METRICS: Record<
  string,
  { groups: Array<{ title: string; codes: string[] }>; trendCode: string }
> = {
  PERFORMANCE: {
    groups: [
      { title: 'Chi phí & kết quả', codes: ['SPEND', 'REVENUE', 'LEAD', 'ORDERS'] },
      { title: 'Hiệu quả', codes: ['CPA', 'CPC', 'CTR', 'ROAS', 'AOV', 'ROS'] },
    ],
    trendCode: 'LEAD',
  },
  CONTENT_SOCIAL: {
    groups: [
      { title: 'Sản lượng', codes: ['CONTENT_POST', 'VIDEO'] },
      { title: 'Độ phủ & tương tác', codes: ['REACH', 'ORGANIC_REACH', 'ENGAGEMENT'] },
    ],
    trendCode: 'CONTENT_POST',
  },
  TRADE: {
    groups: [
      { title: 'Triển khai', codes: ['PROMO_COUNT', 'AUDIT_COUNT', 'POSM_COUNT'] },
      { title: 'Kết quả', codes: ['REVENUE', 'NEW_CUSTOMERS'] },
    ],
    trendCode: 'REVENUE',
  },
  DEFAULT: {
    groups: [{ title: 'Chỉ số chính', codes: ['LEAD', 'REVENUE', 'SPEND'] }],
    trendCode: 'LEAD',
  },
}

function toNumber(value: Decimal | null | undefined): number | null {
  if (value === null || value === undefined) return null
  return new Decimal(value.toString()).toNumber()
}

export async function getDepartmentDashboard(
  departmentCode: string,
  today: Date,
): Promise<DepartmentDashboardData | null> {
  const department = await prisma.department.findFirst({
    where: { code: departmentCode, deletedAt: null },
    select: { id: true, code: true, name: true },
  })
  if (!department) return null

  const { start, end } = monthBounds(today)
  const prevStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1))
  const totalDays = daysBetweenInclusive(start, end)
  const elapsedDays = Math.min(daysBetweenInclusive(start, today), totalDays)
  const lastElapsedDay = new Date(start.getTime() + (elapsedDays - 1) * 86_400_000)

  const config = DEPARTMENT_METRICS[departmentCode] ?? DEPARTMENT_METRICS.DEFAULT
  if (!config) return null

  const allCodes = [...new Set(config.groups.flatMap((g) => g.codes))]

  const definitions = await prisma.kpiDefinition.findMany({
    where: { code: { in: allCodes } },
    select: { id: true, code: true, name: true, unit: true, direction: true, aggregation: true },
  })
  const definitionIds = definitions.map((d) => d.id)
  const owner = { ownerType: 'DEPARTMENT' as const, ownerId: department.id }

  const [targets, targetsToDate, actuals, prevActuals, summary, trendRows, trendTargets] =
    await Promise.all([
      prisma.kpiTarget.findMany({
        where: { ...owner, kpiDefinitionId: { in: definitionIds }, periodType: 'MONTH', periodStart: start },
        select: { kpiDefinitionId: true, targetValue: true },
      }),
      prisma.kpiTarget.groupBy({
        by: ['kpiDefinitionId'],
        where: {
          ...owner,
          kpiDefinitionId: { in: definitionIds },
          periodType: 'DAY',
          periodStart: { gte: start, lte: lastElapsedDay },
        },
        _sum: { targetValue: true },
      }),
      prisma.kpiActual.findMany({
        where: { ...owner, kpiDefinitionId: { in: definitionIds }, periodType: 'MONTH', periodStart: start },
        select: { kpiDefinitionId: true, actualValue: true, numeratorSum: true, denominatorSum: true },
      }),
      prisma.kpiActual.findMany({
        where: { ...owner, kpiDefinitionId: { in: definitionIds }, periodType: 'MONTH', periodStart: prevStart },
        select: { kpiDefinitionId: true, actualValue: true },
      }),
      prisma.kpiSummary.findFirst({
        where: { ...owner, periodType: 'MONTH', periodStart: start },
        select: { score: true, grade: true },
      }),
      prisma.kpiActual.findMany({
        where: { ...owner, periodType: 'DAY', periodStart: { gte: start, lte: end }, kpiDefinition: { code: config.trendCode } },
        select: { periodStart: true, actualValue: true },
        orderBy: { periodStart: 'asc' },
      }),
      prisma.kpiTarget.findMany({
        where: { ...owner, periodType: 'DAY', periodStart: { gte: start, lte: end }, kpiDefinition: { code: config.trendCode } },
        select: { periodStart: true, targetValue: true },
        orderBy: { periodStart: 'asc' },
      }),
    ])

  const targetByDef = new Map(targets.map((t) => [t.kpiDefinitionId, t.targetValue]))
  const targetToDateByDef = new Map(targetsToDate.map((t) => [t.kpiDefinitionId, t._sum.targetValue]))
  const actualByDef = new Map(actuals.map((a) => [a.kpiDefinitionId, a]))
  const prevByDef = new Map(prevActuals.map((a) => [a.kpiDefinitionId, a.actualValue]))

  const buildMetric = (code: string): MetricRow | null => {
    const def = definitions.find((d) => d.code === code)
    if (!def) return null

    const actualRow = actualByDef.get(def.id)
    const target = toNumber(targetByDef.get(def.id) ?? null)
    const actual = resolveActual(actualRow)
    const previous = toNumber(prevByDef.get(def.id) ?? null)
    const targetToDate =
      def.aggregation === 'RATIO' ? target : toNumber(targetToDateByDef.get(def.id) ?? null)

    return {
      code: def.code,
      name: def.name,
      unit: def.unit,
      direction: def.direction,
      aggregation: def.aggregation,
      actual,
      target,
      targetToDate,
      attainment: computeAttainment(actual, targetToDate, def.direction),
      delta:
        previous !== null && previous !== 0 && actual !== null
          ? (actual - previous) / previous
          : null,
    }
  }

  const groups = config.groups.map((g) => ({
    title: g.title,
    metrics: g.codes.map(buildMetric).filter((m): m is MetricRow => m !== null),
  }))

  const targetByDay = new Map(trendTargets.map((t) => [t.periodStart.getTime(), toNumber(t.targetValue)]))
  const actualByDay = new Map(trendRows.map((a) => [a.periodStart.getTime(), toNumber(a.actualValue)]))

  const trend = Array.from({ length: totalDays }, (_, i) => {
    const day = new Date(start.getTime() + i * 86_400_000)
    return {
      date: day.toISOString().slice(0, 10),
      // Ngày tương lai để null: đường biểu đồ dừng lại thay vì kéo về 0.
      actual: i < elapsedDays ? (actualByDay.get(day.getTime()) ?? 0) : null,
      target: targetByDay.get(day.getTime()) ?? null,
    }
  })

  const trendDef = definitions.find((d) => d.code === config.trendCode)
  const trendMetricRow = groups.flatMap((g) => g.metrics).find((m) => m.code === config.trendCode)

  const actualToDate = trend.slice(0, elapsedDays).reduce((sum, p) => sum + (p.actual ?? 0), 0)
  const fc = forecastPeriod({ actualToDate, daysElapsed: elapsedDays, totalDays })
  const forecastValue = fc.value === null ? null : fc.value.toNumber()

  const hasData = groups.some((g) => g.metrics.some((m) => m.target !== null || m.actual !== null))

  return {
    department,
    period: { start, end, totalDays, elapsedDays },
    hasData,
    groups,
    trend,
    trendMetric: trendDef ? { name: trendDef.name, unit: trendDef.unit } : null,
    score: { value: toNumber(summary?.score ?? null), grade: summary?.grade ?? null },
    forecast: trendDef
      ? {
          metricName: trendDef.name,
          value: forecastValue,
          target: trendMetricRow?.target ?? null,
          attainment:
            forecastValue !== null && trendMetricRow?.target
              ? forecastValue / trendMetricRow.target
              : null,
          reason: fc.reason,
        }
      : null,
  }
}

/** Metric RATIO tính lại từ tử/mẫu đã cộng dồn, không dùng giá trị tỷ lệ đã lưu. */
function resolveActual(
  row:
    | { actualValue: Decimal; numeratorSum: Decimal | null; denominatorSum: Decimal | null }
    | undefined,
): number | null {
  if (!row) return null
  if (row.numeratorSum !== null && row.denominatorSum !== null) {
    const den = new Decimal(row.denominatorSum.toString())
    if (den.isZero()) return null // mẫu số 0 → chưa xác định, không phải 0
    return new Decimal(row.numeratorSum.toString()).dividedBy(den).toNumber()
  }
  return toNumber(row.actualValue)
}

function computeAttainment(
  actual: number | null,
  target: number | null,
  direction: MetricDirection,
): number | null {
  if (actual === null || target === null || target === 0) return null
  if (direction === 'HIGHER_BETTER') return actual / target
  if (actual === 0) return 1.2 // chi phí bằng 0 là tốt nhất, trả trần thay vì chia cho 0
  return target / actual
}
