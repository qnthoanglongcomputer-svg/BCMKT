import Decimal from 'decimal.js'
import { prisma } from '@/lib/prisma'
import { DEPARTMENT_CODES } from '@/lib/departments'
import { forecastPeriod } from '@/server/kpi/forecast'
import { daysBetweenInclusive } from '@/server/kpi/period'
import type { MetricDirection } from '@/server/kpi/types'
import type { Scope, SessionUser } from '@/server/auth/scope'

/**
 * Dữ liệu cho dashboard tổng quan.
 *
 * Phạm vi dữ liệu do `scope` quyết định:
 *   - Không thấy phòng Marketing (EMPLOYEE, hoặc LEADER bộ phận con) → hiển thị
 *     dữ liệu của phòng ban gần nhất trong phạm vi, không phải toàn phòng.
 *   - Khối so sánh bộ phận chỉ liệt kê bộ phận nằm trong phạm vi.
 */

/** 6 chỉ số chính trên hàng tile đầu, theo bố cục trong đặc tả mục 25. */
const HEADLINE_METRICS = ['REVENUE', 'LEAD', 'CPA', 'ROAS', 'SPEND', 'ORDERS'] as const

export interface KpiTileData {
  code: string
  name: string
  unit: string
  direction: MetricDirection
  /** null khi chưa có dữ liệu hoặc mẫu số bằng 0 */
  actual: number | null
  /** Mục tiêu cả kỳ */
  target: number | null
  /**
   * Mục tiêu tính tới hôm nay. Với metric SUM là tổng mục tiêu các ngày đã qua;
   * với metric RATIO bằng chính mục tiêu kỳ (CPA mục tiêu không chia theo ngày).
   */
  targetToDate: number | null
  /**
   * Tỷ lệ đạt **so với tiến độ kỳ** (`actual / targetToDate`), 0.84 = 84%.
   *
   * Cố ý không dùng mục tiêu cả kỳ làm mẫu số: ngày 24/31 mà so với mục tiêu
   * cả tháng thì mọi chỉ số đều hiện "Không đạt" kể cả khi đang chạy đúng tiến độ.
   * Câu hỏi "cuối kỳ có đạt không" do khối Dự báo trả lời.
   */
  attainment: number | null
  /** Thay đổi so kỳ trước, dạng tỷ lệ. null khi kỳ trước không có dữ liệu */
  delta: number | null
}

export interface TrendPoint {
  date: string
  actual: number | null
  target: number | null
}

export interface DepartmentPerformance {
  code: string
  name: string
  score: number | null
  attainment: number | null
}

export interface OverviewData {
  period: { start: Date; end: Date; totalDays: number; elapsedDays: number }
  hasData: boolean
  tiles: KpiTileData[]
  trend: TrendPoint[]
  departments: DepartmentPerformance[]
  forecast: {
    metricName: string
    value: number | null
    target: number | null
    attainment: number | null
    reason?: string
  } | null
}

function toNumber(value: Decimal | null | undefined): number | null {
  if (value === null || value === undefined) return null
  return new Decimal(value.toString()).toNumber()
}

/** Ngày đầu và cuối tháng chứa `date`, ở UTC-midnight. */
export function monthBounds(date: Date): { start: Date; end: Date } {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  return {
    start: new Date(Date.UTC(year, month, 1)),
    end: new Date(Date.UTC(year, month + 1, 0)),
  }
}

function previousMonthBounds(start: Date): { start: Date; end: Date } {
  const prev = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1))
  return monthBounds(prev)
}

export async function getOverview(
  today: Date,
  user: SessionUser,
  scope: Scope,
): Promise<OverviewData> {
  const { start, end } = monthBounds(today)
  const prev = previousMonthBounds(start)

  const totalDays = daysBetweenInclusive(start, end)
  // Ngày hôm nay tính là đã qua — báo cáo trong ngày vẫn đang được nhập.
  const elapsedDays = Math.min(daysBetweenInclusive(start, today), totalDays)

  const owner = await resolveOwner(user, scope)
  if (!owner) {
    return emptyOverview(start, end, totalDays, elapsedDays)
  }

  const definitions = await prisma.kpiDefinition.findMany({
    where: { code: { in: [...HEADLINE_METRICS] } },
    select: { id: true, code: true, name: true, unit: true, direction: true, aggregation: true },
  })
  const definitionIds = definitions.map((d) => d.id)

  const ownerFilter = { ownerType: owner.ownerType, ownerId: owner.ownerId }

  // Ngày cuối cùng đã có dữ liệu, dùng làm mốc tính mục tiêu luỹ kế.
  const lastElapsedDay = new Date(start.getTime() + (elapsedDays - 1) * 86_400_000)

  const [targets, targetsToDate, actuals, prevActuals, dayActuals, dayTargets, deptRows] = await Promise.all([
    prisma.kpiTarget.findMany({
      where: { ...ownerFilter, kpiDefinitionId: { in: definitionIds }, periodType: 'MONTH', periodStart: start },
      select: { kpiDefinitionId: true, targetValue: true },
    }),
    prisma.kpiTarget.groupBy({
      by: ['kpiDefinitionId'],
      where: {
        ...ownerFilter,
        kpiDefinitionId: { in: definitionIds },
        periodType: 'DAY',
        periodStart: { gte: start, lte: lastElapsedDay },
      },
      _sum: { targetValue: true },
    }),
    prisma.kpiActual.findMany({
      where: { ...ownerFilter, kpiDefinitionId: { in: definitionIds }, periodType: 'MONTH', periodStart: start },
      select: { kpiDefinitionId: true, actualValue: true, numeratorSum: true, denominatorSum: true },
    }),
    prisma.kpiActual.findMany({
      where: { ...ownerFilter, kpiDefinitionId: { in: definitionIds }, periodType: 'MONTH', periodStart: prev.start },
      select: { kpiDefinitionId: true, actualValue: true },
    }),
    // Xu hướng theo ngày dùng metric LEAD làm đại diện
    prisma.kpiActual.findMany({
      where: {
        ...ownerFilter,
        periodType: 'DAY',
        periodStart: { gte: start, lte: end },
        kpiDefinition: { code: 'LEAD' },
      },
      select: { periodStart: true, actualValue: true },
      orderBy: { periodStart: 'asc' },
    }),
    prisma.kpiTarget.findMany({
      where: {
        ...ownerFilter,
        periodType: 'DAY',
        periodStart: { gte: start, lte: end },
        kpiDefinition: { code: 'LEAD' },
      },
      select: { periodStart: true, targetValue: true },
      orderBy: { periodStart: 'asc' },
    }),
    getDepartmentPerformance(start, owner, scope),
  ])

  const targetByDef = new Map(targets.map((t) => [t.kpiDefinitionId, t.targetValue]))
  const targetToDateByDef = new Map(
    targetsToDate.map((t) => [t.kpiDefinitionId, t._sum.targetValue]),
  )
  const actualByDef = new Map(actuals.map((a) => [a.kpiDefinitionId, a]))
  const prevByDef = new Map(prevActuals.map((a) => [a.kpiDefinitionId, a.actualValue]))

  const tiles: KpiTileData[] = HEADLINE_METRICS.map((code) => {
    const def = definitions.find((d) => d.code === code)
    if (!def) {
      return {
        code, name: code, unit: '', direction: 'HIGHER_BETTER',
        actual: null, target: null, targetToDate: null, attainment: null, delta: null,
      }
    }

    const actualRow = actualByDef.get(def.id)
    const target = toNumber(targetByDef.get(def.id) ?? null)
    const actual = resolveActual(actualRow)
    const previous = toNumber(prevByDef.get(def.id) ?? null)

    // Metric RATIO không chia nhỏ theo ngày — mục tiêu kỳ áp dụng nguyên vẹn.
    const targetToDate =
      def.aggregation === 'RATIO' ? target : toNumber(targetToDateByDef.get(def.id) ?? null)

    return {
      code: def.code,
      name: def.name,
      unit: def.unit,
      direction: def.direction,
      actual,
      target,
      targetToDate,
      attainment: computeAttainment(actual, targetToDate, def.direction),
      delta: previous !== null && previous !== 0 && actual !== null ? (actual - previous) / previous : null,
    }
  })

  const targetByDay = new Map(dayTargets.map((t) => [t.periodStart.getTime(), toNumber(t.targetValue)]))
  const actualByDay = new Map(dayActuals.map((a) => [a.periodStart.getTime(), toNumber(a.actualValue)]))

  const trend: TrendPoint[] = []
  for (let i = 0; i < totalDays; i++) {
    const day = new Date(start.getTime() + i * 86_400_000)
    const key = day.getTime()
    trend.push({
      date: day.toISOString().slice(0, 10),
      // Ngày tương lai chưa có thực tế — để null để đường biểu đồ dừng lại,
      // không kéo về 0 gây hiểu nhầm là kết quả bằng 0.
      actual: i < elapsedDays ? (actualByDay.get(key) ?? 0) : null,
      target: targetByDay.get(key) ?? null,
    })
  }

  const leadTile = tiles.find((t) => t.code === 'LEAD')
  const forecast = buildForecast(leadTile, trend, elapsedDays, totalDays)

  const hasData = tiles.some((t) => t.target !== null || t.actual !== null)

  return {
    period: { start, end, totalDays, elapsedDays },
    hasData,
    tiles,
    trend,
    departments: deptRows,
    forecast,
  }
}

/** Metric RATIO phải tính lại từ tử/mẫu đã cộng dồn, không dùng giá trị đã lưu. */
function resolveActual(row: {
  actualValue: Decimal
  numeratorSum: Decimal | null
  denominatorSum: Decimal | null
} | undefined): number | null {
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

function buildForecast(
  tile: KpiTileData | undefined,
  trend: TrendPoint[],
  elapsedDays: number,
  totalDays: number,
): OverviewData['forecast'] {
  if (!tile) return null

  const actualToDate = trend
    .slice(0, elapsedDays)
    .reduce((sum, p) => sum + (p.actual ?? 0), 0)

  const result = forecastPeriod({ actualToDate, daysElapsed: elapsedDays, totalDays })
  const value = result.value === null ? null : result.value.toNumber()

  return {
    metricName: tile.name,
    value,
    target: tile.target,
    attainment: value !== null && tile.target ? value / tile.target : null,
    reason: result.reason,
  }
}

async function getDepartmentPerformance(
  periodStart: Date,
  owner: DashboardOwner,
  scope: Scope,
): Promise<DepartmentPerformance[]> {
  // EMPLOYEE không được so sánh giữa các bộ phận — họ chỉ thấy dữ liệu cá nhân.
  if (owner.ownerType === 'EMPLOYEE') return []

  const departments = await prisma.department.findMany({
    where: {
      parentId: owner.ownerId,
      deletedAt: null,
      // Chỉ liệt kê bộ phận nằm trong phạm vi cho phép.
      ...(scope.departmentIds === null ? {} : { id: { in: scope.departmentIds } }),
    },
    select: { id: true, code: true, name: true },
    orderBy: { sortOrder: 'asc' },
  })

  const summaries = await prisma.kpiSummary.findMany({
    where: {
      ownerType: 'DEPARTMENT',
      ownerId: { in: departments.map((d) => d.id) },
      periodType: 'MONTH',
      periodStart,
    },
    select: { ownerId: true, score: true },
  })
  const scoreByOwner = new Map(summaries.map((s) => [s.ownerId, toNumber(s.score)]))

  return departments
    .map((d) => {
      const score = scoreByOwner.get(d.id) ?? null
      return {
        code: d.code,
        name: d.name,
        score,
        attainment: score === null ? null : score / 100,
      }
    })
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
}

interface DashboardOwner {
  ownerType: 'DEPARTMENT' | 'EMPLOYEE'
  ownerId: string
}

/**
 * Đối tượng mà dashboard tổng quan hiển thị dữ liệu.
 *
 * - `EMPLOYEE` → **chính họ**, không phải phòng ban của họ. Đặc tả mục 20:
 *   "Nhân viên chỉ xem KPI cá nhân". Trả về phòng ban ở đây là rò rỉ dữ liệu
 *   của cả bộ phận cho một nhân viên.
 * - Vai trò khác → phòng Marketing nếu trong phạm vi, ngược lại là phòng ban
 *   cao nhất họ được xem (Leader bộ phận con thấy bộ phận mình).
 */
async function resolveOwner(user: SessionUser, scope: Scope): Promise<DashboardOwner | null> {
  if (scope.userIds !== null) {
    return { ownerType: 'EMPLOYEE', ownerId: user.id }
  }

  const marketing = await prisma.department.findUnique({
    where: { code: DEPARTMENT_CODES.MARKETING },
    select: { id: true },
  })

  if (scope.departmentIds === null) {
    return marketing ? { ownerType: 'DEPARTMENT', ownerId: marketing.id } : null
  }
  if (marketing && scope.departmentIds.includes(marketing.id)) {
    return { ownerType: 'DEPARTMENT', ownerId: marketing.id }
  }
  if (scope.departmentIds.length === 0) return null

  const highest = await prisma.department.findFirst({
    where: { id: { in: scope.departmentIds }, deletedAt: null },
    select: { id: true },
    orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
  })
  return highest ? { ownerType: 'DEPARTMENT', ownerId: highest.id } : null
}

function emptyOverview(
  start: Date,
  end: Date,
  totalDays: number,
  elapsedDays: number,
): OverviewData {
  return {
    period: { start, end, totalDays, elapsedDays },
    hasData: false,
    tiles: [],
    trend: [],
    departments: [],
    forecast: null,
  }
}
