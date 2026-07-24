import Decimal from 'decimal.js'
import { AllocationError, TARGET_DP } from './allocation'
import {
  dayPeriods,
  monthOf,
  monthPeriods,
  quarterPeriods,
  weekPeriods,
  yearPeriod,
} from './period'
import type { AllocatedPeriod, AllocationResult } from './types'

/**
 * Phân bổ mục tiêu cho metric **tỷ lệ** (CPA, CPC, CTR, ROAS, AOV, ROS).
 *
 * Khác hoàn toàn với metric cộng dồn: không thể chia nhỏ "CPA ≤ 100.000₫" cho
 * 12 tháng — mục tiêu tỷ lệ không phải là một lượng để chia. Vì vậy admin nhập
 * thẳng 12 giá trị tháng, và:
 *
 *   - MONTH   = giá trị admin nhập
 *   - DAY     = kế thừa nguyên giá trị của tháng chứa nó
 *   - WEEK    = trung bình có trọng số theo số ngày (tuần vắt qua 2 tháng lấy
 *               trung bình theo số ngày thuộc mỗi tháng)
 *   - QUARTER = trung bình có trọng số theo số ngày của 3 tháng
 *   - YEAR    = trung bình có trọng số theo số ngày của 12 tháng
 *
 * ⚠️ Trung bình có trọng số ở đây CHỈ áp dụng cho **mục tiêu do người quản lý
 * đặt ra** — những con số không có tử/mẫu để tính lại. Tuyệt đối KHÔNG dùng
 * cách này cho kết quả **thực tế**: actual của metric tỷ lệ luôn phải tính lại
 * từ tử số và mẫu số đã cộng dồn (xem rollup.ts). Lẫn lộn hai chỗ này là lỗi
 * số liệu nghiêm trọng.
 */
export function allocateRatioYear(input: {
  year: number
  /** 12 giá trị mục tiêu, khoá là tháng 1–12 */
  monthlyValues: Record<number, Decimal.Value>
}): AllocationResult {
  const { year, monthlyValues } = input

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new AllocationError(`Năm không hợp lệ: ${year}.`)
  }

  const months = monthPeriods(year)
  const values: Decimal[] = []

  for (let m = 1; m <= 12; m++) {
    const raw = monthlyValues[m]
    if (raw === undefined || raw === '') {
      throw new AllocationError(`Thiếu mục tiêu cho tháng ${m}.`)
    }
    const dec = new Decimal(raw)
    if (dec.lt(0)) {
      throw new AllocationError(`Mục tiêu tháng ${m} không được âm.`)
    }
    values.push(dec.toDecimalPlaces(TARGET_DP, Decimal.ROUND_HALF_UP))
  }

  const monthValue = (index: number) => values[index] as Decimal
  const monthDays = (index: number) => new Decimal((months[index] as { days: number }).days)

  /** Trung bình có trọng số theo số ngày của các tháng được chọn. */
  const weightedAverage = (indices: number[]): Decimal => {
    let weightedSum = new Decimal(0)
    let totalDays = new Decimal(0)
    for (const i of indices) {
      weightedSum = weightedSum.plus(monthValue(i).times(monthDays(i)))
      totalDays = totalDays.plus(monthDays(i))
    }
    if (totalDays.isZero()) return new Decimal(0)
    return weightedSum.dividedBy(totalDays).toDecimalPlaces(TARGET_DP, Decimal.ROUND_HALF_UP)
  }

  const allMonths = Array.from({ length: 12 }, (_, i) => i)

  const days = dayPeriods(year).map<AllocatedPeriod>((d) => ({
    ...d,
    value: monthValue(monthOf(d.start) - 1),
  }))

  // Tuần vắt qua ranh giới tháng: trung bình theo số ngày thuộc mỗi tháng.
  // Dùng lại chính giá trị ngày nên không cần biết tuần nằm ở đâu.
  const weeks = weekPeriodsWithAverage(year, days)

  return {
    year: { ...yearPeriod(year), value: weightedAverage(allMonths) },
    quarters: quarterPeriods(year).map<AllocatedPeriod>((q, qi) => ({
      ...q,
      value: weightedAverage([qi * 3, qi * 3 + 1, qi * 3 + 2]),
    })),
    months: months.map<AllocatedPeriod>((m, i) => ({ ...m, value: monthValue(i) })),
    weeks,
    days,
  }
}

function weekPeriodsWithAverage(year: number, days: AllocatedPeriod[]): AllocatedPeriod[] {
  return weekPeriods(year).map<AllocatedPeriod>((week) => {
    const inWeek = days.filter((d) => d.start >= week.start && d.start <= week.end)
    const sum = inWeek.reduce<Decimal>((acc, d) => acc.plus(d.value), new Decimal(0))
    const value =
      inWeek.length === 0
        ? new Decimal(0)
        : sum.dividedBy(inWeek.length).toDecimalPlaces(TARGET_DP, Decimal.ROUND_HALF_UP)
    return { ...week, value }
  })
}
