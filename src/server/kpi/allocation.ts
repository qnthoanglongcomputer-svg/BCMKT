import Decimal from 'decimal.js'
import type {
  AllocatedPeriod,
  AllocationInput,
  AllocationResult,
  Period,
} from './types'
import {
  daysInMonth,
  dayPeriods,
  monthPeriods,
  monthOf,
  quarterPeriods,
  quarterOfMonth,
  weekPeriods,
  yearPeriod,
} from './period'

/** Số chữ số thập phân của mục tiêu KPI — khớp Decimal(18,2) trong DB. */
export const TARGET_DP = 2

export class AllocationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AllocationError'
  }
}

/**
 * Chia `total` theo danh sách trọng số, làm tròn tới `dp` chữ số thập phân.
 * Sai số làm tròn được dồn hết vào phần tử **cuối cùng** để bảo đảm
 * SUM(kết quả) === total tuyệt đối.
 */
export function distributeWithRemainder(
  total: Decimal.Value,
  weights: Decimal.Value[],
  dp: number = TARGET_DP,
): Decimal[] {
  const totalDec = new Decimal(total)
  if (weights.length === 0) {
    throw new AllocationError('Danh sách trọng số rỗng, không thể phân bổ.')
  }

  const weightSum = weights.reduce<Decimal>((acc, w) => acc.plus(w), new Decimal(0))
  if (weightSum.lte(0)) {
    throw new AllocationError('Tổng trọng số phải lớn hơn 0.')
  }

  const result: Decimal[] = []
  let allocated = new Decimal(0)

  for (let i = 0; i < weights.length - 1; i++) {
    const share = totalDec
      .times(weights[i] as Decimal.Value)
      .dividedBy(weightSum)
      .toDecimalPlaces(dp, Decimal.ROUND_HALF_UP)
    result.push(share)
    allocated = allocated.plus(share)
  }
  result.push(totalDec.minus(allocated))

  return result
}

function toAllocated(periods: Period[], values: Decimal[]): AllocatedPeriod[] {
  return periods.map((p, i) => ({ ...p, value: values[i] as Decimal }))
}

/** Tỷ trọng cơ sở của 12 tháng: theo số ngày thực của từng tháng. */
function baseMonthWeights(year: number): Decimal[] {
  return Array.from({ length: 12 }, (_, i) => new Decimal(daysInMonth(year, i + 1)))
}

function resolveMonthTargets(input: AllocationInput): Decimal[] {
  const { year, yearTarget, strategy } = input
  const total = new Decimal(yearTarget)

  if (total.lt(0)) {
    throw new AllocationError('Mục tiêu năm không được âm.')
  }

  if (strategy === 'EVEN') {
    // Chia theo số ngày thực, không chia đều 12 phần bằng nhau.
    return distributeWithRemainder(total, baseMonthWeights(year))
  }

  if (strategy === 'WEIGHTED') {
    const raw = input.monthWeights
    if (!raw) {
      throw new AllocationError('Chiến lược WEIGHTED yêu cầu monthWeights.')
    }
    const weights: Decimal[] = []
    for (let m = 1; m <= 12; m++) {
      const w = raw[m]
      if (w === undefined) {
        throw new AllocationError(`Thiếu tỷ trọng cho tháng ${m}.`)
      }
      const dec = new Decimal(w)
      if (dec.lt(0)) {
        throw new AllocationError(`Tỷ trọng tháng ${m} không được âm.`)
      }
      weights.push(dec)
    }
    const sum = weights.reduce((a, b) => a.plus(b), new Decimal(0))
    // Cho phép sai số làm tròn 0.0001 khi admin nhập 12 số phần trăm.
    if (sum.minus(1).abs().gt('0.0001')) {
      throw new AllocationError(
        `Tổng tỷ trọng 12 tháng phải bằng 100%, hiện tại là ${sum.times(100).toFixed(2)}%.`,
      )
    }
    return distributeWithRemainder(total, weights)
  }

  // MANUAL: khoá các tháng admin nhập, cân lại phần dư cho các tháng còn lại.
  const locked = input.lockedMonths
  if (!locked || Object.keys(locked).length === 0) {
    throw new AllocationError('Chiến lược MANUAL yêu cầu ít nhất một tháng được nhập tay.')
  }

  const lockedValues = new Map<number, Decimal>()
  for (const [key, value] of Object.entries(locked)) {
    const month = Number(key)
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new AllocationError(`Tháng không hợp lệ: ${key}.`)
    }
    const dec = new Decimal(value)
    if (dec.lt(0)) {
      throw new AllocationError(`Giá trị tháng ${month} không được âm.`)
    }
    lockedValues.set(month, dec.toDecimalPlaces(TARGET_DP, Decimal.ROUND_HALF_UP))
  }

  const lockedSum = [...lockedValues.values()].reduce((a, b) => a.plus(b), new Decimal(0))
  if (lockedSum.gt(total)) {
    throw new AllocationError(
      `Tổng các tháng nhập tay (${lockedSum.toFixed(2)}) vượt mục tiêu năm (${total.toFixed(2)}). ` +
        'Hệ thống không tự cắt bớt — hãy điều chỉnh lại số liệu.',
    )
  }

  const openMonths: number[] = []
  for (let m = 1; m <= 12; m++) {
    if (!lockedValues.has(m)) openMonths.push(m)
  }

  const remainder = total.minus(lockedSum)
  if (openMonths.length === 0) {
    if (!remainder.isZero()) {
      throw new AllocationError(
        `Đã khoá cả 12 tháng nhưng tổng (${lockedSum.toFixed(2)}) không bằng mục tiêu năm ` +
          `(${total.toFixed(2)}). Không còn tháng nào để cân lại.`,
      )
    }
    return Array.from({ length: 12 }, (_, i) => lockedValues.get(i + 1) as Decimal)
  }

  // Tỷ lệ hiện có của các tháng mở: dùng monthWeights nếu admin đã đặt, không thì theo số ngày.
  const base = input.monthWeights
    ? openMonths.map((m) => {
        const w = input.monthWeights?.[m]
        if (w === undefined) {
          throw new AllocationError(`Thiếu tỷ trọng cho tháng ${m}.`)
        }
        return new Decimal(w)
      })
    : openMonths.map((m) => new Decimal(daysInMonth(input.year, m)))

  const openValues = distributeWithRemainder(remainder, base)

  const months: Decimal[] = []
  let openIndex = 0
  for (let m = 1; m <= 12; m++) {
    const lockedValue = lockedValues.get(m)
    if (lockedValue) {
      months.push(lockedValue)
    } else {
      months.push(openValues[openIndex] as Decimal)
      openIndex++
    }
  }
  return months
}

/**
 * Phân bổ mục tiêu KPI năm xuống Quý → Tháng → Tuần → Ngày.
 *
 * Thiết kế: năm → tháng (theo chiến lược), tháng → ngày (đều theo số ngày trong tháng).
 * Quý và tuần được **suy ra** bằng cách cộng dồn, nên các bất biến sau luôn đúng
 * theo cấu trúc, không phụ thuộc vào công thức:
 *   - SUM(tháng) = SUM(quý) = SUM(tuần) = SUM(ngày) = mục tiêu năm
 *   - Tuần cắt qua ranh giới tháng được tách đúng theo ngày thuộc từng tháng
 *
 * Hàm thuần và idempotent: cùng input luôn cho cùng output.
 */
export function allocateYear(input: AllocationInput): AllocationResult {
  const { year } = input
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new AllocationError(`Năm không hợp lệ: ${year}.`)
  }

  const total = new Decimal(input.yearTarget)
  const monthTargets = resolveMonthTargets(input)

  const months = monthPeriods(year)
  const days = dayPeriods(year)

  // Tháng → ngày: chia đều theo số ngày trong tháng đó.
  const dayValueByTime = new Map<number, Decimal>()
  months.forEach((month, index) => {
    const monthDays = days.filter((d) => monthOf(d.start) === index + 1)
    const values = distributeWithRemainder(
      monthTargets[index] as Decimal,
      monthDays.map(() => 1),
    )
    monthDays.forEach((d, i) => {
      dayValueByTime.set(d.start.getTime(), values[i] as Decimal)
    })
  })

  const dayValues = days.map((d) => dayValueByTime.get(d.start.getTime()) as Decimal)

  // Quý = tổng 3 tháng của quý đó.
  const quarters = quarterPeriods(year)
  const quarterValues = quarters.map((_, qIndex) =>
    monthTargets.reduce<Decimal>(
      (acc, value, mIndex) =>
        quarterOfMonth(mIndex + 1) === qIndex + 1 ? acc.plus(value) : acc,
      new Decimal(0),
    ),
  )

  // Tuần = tổng các ngày thuộc tuần đó (tuần đã được cắt về trong năm).
  const weeks = weekPeriods(year)
  const weekValues = weeks.map((week) => {
    let sum = new Decimal(0)
    for (const day of days) {
      if (day.start >= week.start && day.start <= week.end) {
        sum = sum.plus(dayValueByTime.get(day.start.getTime()) as Decimal)
      }
    }
    return sum
  })

  return {
    year: { ...yearPeriod(year), value: total },
    quarters: toAllocated(quarters, quarterValues),
    months: toAllocated(months, monthTargets),
    weeks: toAllocated(weeks, weekValues),
    days: toAllocated(days, dayValues),
  }
}
