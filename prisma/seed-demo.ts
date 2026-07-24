/**
 * Dữ liệu MẪU để xem thử dashboard khi màn hình lập kế hoạch KPI (workflow 04)
 * chưa được xây. **Không phải dữ liệu thật, không chạy trên production.**
 *
 * Chạy: npm run db:seed-demo
 * Xoá:  npm run db:seed-demo -- --clean
 *
 * Idempotent: xoá sạch dữ liệu KPI cũ rồi sinh lại, không cộng dồn.
 * Dùng chính KPI engine để phân bổ — nếu engine sai, dữ liệu mẫu cũng sai,
 * và đó là điều ta muốn phát hiện sớm.
 */
import { PrismaClient, type Prisma } from '@prisma/client'
import Decimal from 'decimal.js'
import { allocateYear } from '../src/server/kpi/allocation'
import { monthPeriods } from '../src/server/kpi/period'
import { computeScore } from '../src/server/kpi/scoring'

const prisma = new PrismaClient()

const YEAR = 2026
/** Ngày "hôm nay" của dữ liệu mẫu — cố định để chạy lại luôn ra kết quả giống nhau. */
const TODAY = new Date(Date.UTC(2026, 6, 24))

/** Mục tiêu năm cho phòng Marketing, lấy từ ví dụ trong đặc tả mục 4. */
const MARKETING_TARGETS: Record<string, string> = {
  LEAD: '72000',
  REVENUE: '1000000000000',
  SPEND: '120000000000',
  ORDERS: '24000',
}

/** Tỷ trọng đóng góp của từng bộ phận vào mục tiêu phòng. Tổng = 1. */
const DEPARTMENT_SHARE: Record<string, number> = {
  PERFORMANCE: 0.5,
  CONTENT_SOCIAL: 0.25,
  TRADE: 0.15,
  BRANDING: 0.1,
}

/** Mức đạt mục tiêu của từng bộ phận — tạo ra chênh lệch để dashboard có gì để so sánh. */
const DEPARTMENT_ATTAINMENT: Record<string, number> = {
  PERFORMANCE: 0.91,
  CONTENT_SOCIAL: 0.82,
  TRADE: 0.71,
  BRANDING: 0.65,
}

/**
 * Nhiễu giả lập theo ngày, tất định (không dùng Math.random) để chạy lại
 * cho kết quả giống hệt nhau.
 */
function dailyNoise(dayIndex: number, salt: number): number {
  const x = Math.sin((dayIndex + 1) * 12.9898 + salt * 78.233) * 43758.5453
  return 0.75 + (x - Math.floor(x)) * 0.5 // 0.75 – 1.25
}

async function clean() {
  // Thứ tự xoá tôn trọng khoá ngoại.
  await prisma.kpiSummary.deleteMany()
  await prisma.kpiActual.deleteMany()
  await prisma.kpiTarget.deleteMany()
  await prisma.kpiPlan.deleteMany()
  console.log('  Đã xoá toàn bộ dữ liệu KPI mẫu')
}

async function main() {
  const isClean = process.argv.includes('--clean')

  console.log(isClean ? 'Xoá dữ liệu mẫu — bắt đầu' : 'Seed dữ liệu mẫu — bắt đầu')
  await clean()

  if (isClean) {
    console.log('Hoàn tất')
    return
  }

  const marketing = await prisma.department.findUnique({ where: { code: 'MARKETING' } })
  if (!marketing) throw new Error('Chưa có phòng ban MARKETING. Chạy `npm run db:seed` trước.')

  const children = await prisma.department.findMany({
    where: { parentId: marketing.id, deletedAt: null },
    select: { id: true, code: true },
  })

  const definitions = await prisma.kpiDefinition.findMany({
    where: { code: { in: [...Object.keys(MARKETING_TARGETS), 'CPA', 'ROAS'] } },
    select: { id: true, code: true, aggregation: true, direction: true },
  })
  const defByCode = new Map(definitions.map((d) => [d.code, d]))

  const owners = [
    { id: marketing.id, code: 'MARKETING', share: 1, attainment: 0.84 },
    ...children.map((c) => ({
      id: c.id,
      code: c.code,
      share: DEPARTMENT_SHARE[c.code] ?? 0,
      attainment: DEPARTMENT_ATTAINMENT[c.code] ?? 0.8,
    })),
  ].filter((o) => o.share > 0)

  const months = monthPeriods(YEAR)
  const currentMonth = months[TODAY.getUTCMonth()]
  const previousMonth = months[TODAY.getUTCMonth() - 1]
  if (!currentMonth || !previousMonth) throw new Error('Không xác định được kỳ hiện tại')

  const targetRows: Prisma.KpiTargetCreateManyInput[] = []
  const actualRows: Prisma.KpiActualCreateManyInput[] = []

  for (const owner of owners) {
    // Số nguyên liệu của bộ phận này trong tháng hiện tại, dùng lại để tính metric tỷ lệ.
    const monthSums: Record<string, { target: Decimal; actual: Decimal }> = {}

    for (const [code, yearTarget] of Object.entries(MARKETING_TARGETS)) {
      const def = defByCode.get(code)
      if (!def) continue

      const ownerYearTarget = new Decimal(yearTarget).times(owner.share)
      const allocation = allocateYear({
        year: YEAR,
        yearTarget: ownerYearTarget,
        strategy: 'EVEN',
      })

      const base = {
        ownerType: 'DEPARTMENT' as const,
        ownerId: owner.id,
        kpiDefinitionId: def.id,
      }

      // Mục tiêu: lưu đủ 4 cấp kỳ để chứng minh bất biến tổng đúng trên DB thật.
      targetRows.push({
        ...base,
        periodType: 'YEAR',
        periodStart: allocation.year.start,
        periodEnd: allocation.year.end,
        targetValue: allocation.year.value.toFixed(2),
      })
      for (const q of allocation.quarters) {
        targetRows.push({ ...base, periodType: 'QUARTER', periodStart: q.start, periodEnd: q.end, targetValue: q.value.toFixed(2) })
      }
      for (const m of allocation.months) {
        targetRows.push({ ...base, periodType: 'MONTH', periodStart: m.start, periodEnd: m.end, targetValue: m.value.toFixed(2) })
      }
      for (const d of allocation.days) {
        targetRows.push({ ...base, periodType: 'DAY', periodStart: d.start, periodEnd: d.end, targetValue: d.value.toFixed(2) })
      }

      // Thực tế: chỉ sinh cho các ngày đã qua của tháng hiện tại + cả tháng trước.
      const salt = code.length + owner.code.length
      let monthActual = new Decimal(0)

      const currentDays = allocation.days.filter(
        (d) => d.start >= currentMonth.start && d.start <= TODAY,
      )
      currentDays.forEach((d, index) => {
        const value = d.value.times(owner.attainment).times(dailyNoise(index, salt))
        monthActual = monthActual.plus(value)
        actualRows.push({
          ...base,
          periodType: 'DAY',
          periodStart: d.start,
          periodEnd: d.end,
          actualValue: value.toFixed(2),
        })
      })

      const currentMonthTarget = allocation.months[TODAY.getUTCMonth()]
      if (currentMonthTarget) {
        monthSums[code] = { target: currentMonthTarget.value, actual: monthActual }
        actualRows.push({
          ...base,
          periodType: 'MONTH',
          periodStart: currentMonth.start,
          periodEnd: currentMonth.end,
          actualValue: monthActual.toFixed(2),
        })
      }

      // Tháng trước: chỉ cần tổng tháng để tile so sánh kỳ trước có số.
      const prevMonthTarget = allocation.months[TODAY.getUTCMonth() - 1]
      if (prevMonthTarget) {
        actualRows.push({
          ...base,
          periodType: 'MONTH',
          periodStart: previousMonth.start,
          periodEnd: previousMonth.end,
          actualValue: prevMonthTarget.value.times(owner.attainment - 0.04).toFixed(2),
        })
      }
    }

    // Metric tỷ lệ: lưu tử/mẫu để cấp trên tính lại đúng, không lưu mỗi giá trị tỷ lệ.
    pushRatio(targetRows, actualRows, {
      def: defByCode.get('CPA'),
      ownerId: owner.id,
      period: currentMonth,
      numerator: monthSums['SPEND'],
      denominator: monthSums['LEAD'],
    })
    pushRatio(targetRows, actualRows, {
      def: defByCode.get('ROAS'),
      ownerId: owner.id,
      period: currentMonth,
      numerator: monthSums['REVENUE'],
      denominator: monthSums['SPEND'],
    })
  }

  await prisma.kpiTarget.createMany({ data: targetRows })
  console.log(`  Mục tiêu KPI: ${targetRows.length} dòng`)

  await prisma.kpiActual.createMany({ data: actualRows })
  console.log(`  Kết quả thực tế: ${actualRows.length} dòng`)

  // Điểm KPI cấp bộ phận — dùng chính hàm chấm điểm của engine.
  const summaryRows: Prisma.KpiSummaryCreateManyInput[] = []
  for (const owner of owners.filter((o) => o.code !== 'MARKETING')) {
    const result = computeScore([
      { kpiCode: 'LEAD', target: 100, actual: owner.attainment * 100, weight: 0.4, direction: 'HIGHER_BETTER' },
      { kpiCode: 'REVENUE', target: 100, actual: owner.attainment * 100, weight: 0.3, direction: 'HIGHER_BETTER' },
      { kpiCode: 'CPA', target: 100, actual: 100 / owner.attainment, weight: 0.3, direction: 'LOWER_BETTER' },
    ])
    summaryRows.push({
      ownerType: 'DEPARTMENT',
      ownerId: owner.id,
      periodType: 'MONTH',
      periodStart: currentMonth.start,
      periodEnd: currentMonth.end,
      score: result.score.toFixed(4),
      grade: result.grade,
      computedAt: TODAY,
    })
  }
  await prisma.kpiSummary.createMany({ data: summaryRows })
  console.log(`  Điểm KPI bộ phận: ${summaryRows.length} dòng`)

  console.log('Seed dữ liệu mẫu — hoàn tất')
}

function pushRatio(
  targetRows: Prisma.KpiTargetCreateManyInput[],
  actualRows: Prisma.KpiActualCreateManyInput[],
  args: {
    def: { id: string } | undefined
    ownerId: string
    period: { start: Date; end: Date }
    numerator: { target: Decimal; actual: Decimal } | undefined
    denominator: { target: Decimal; actual: Decimal } | undefined
  },
) {
  const { def, ownerId, period, numerator, denominator } = args
  if (!def || !numerator || !denominator || denominator.target.isZero()) return

  const base = { ownerType: 'DEPARTMENT' as const, ownerId, kpiDefinitionId: def.id }

  targetRows.push({
    ...base,
    periodType: 'MONTH',
    periodStart: period.start,
    periodEnd: period.end,
    targetValue: numerator.target.dividedBy(denominator.target).toFixed(2),
  })

  actualRows.push({
    ...base,
    periodType: 'MONTH',
    periodStart: period.start,
    periodEnd: period.end,
    actualValue: denominator.actual.isZero()
      ? '0'
      : numerator.actual.dividedBy(denominator.actual).toFixed(2),
    numeratorSum: numerator.actual.toFixed(2),
    denominatorSum: denominator.actual.toFixed(2),
  })
}

main()
  .catch((error) => {
    console.error('Seed mẫu thất bại:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
