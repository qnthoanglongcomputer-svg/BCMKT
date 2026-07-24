import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { allocateRatioYear } from './allocation-ratio'
import { AllocationError } from './allocation'
import { daysInMonth, monthOf } from './period'

/** 12 tháng cùng một mục tiêu CPA. */
function flat(value: string): Record<number, string> {
  return Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, value]))
}

describe('allocateRatioYear — mục tiêu giống nhau mọi tháng', () => {
  const result = allocateRatioYear({ year: 2026, monthlyValues: flat('100000') })

  it('mọi cấp kỳ đều bằng đúng giá trị đã nhập', () => {
    expect(result.year.value.toString()).toBe('100000')
    expect(result.quarters.every((q) => q.value.toString() === '100000')).toBe(true)
    expect(result.months.every((m) => m.value.toString() === '100000')).toBe(true)
    expect(result.weeks.every((w) => w.value.toString() === '100000')).toBe(true)
    expect(result.days.every((d) => d.value.toString() === '100000')).toBe(true)
  })

  it('KHÔNG cộng dồn các kỳ con — mục tiêu tỷ lệ không phải lượng để chia', () => {
    const monthSum = result.months.reduce<Decimal>((a, m) => a.plus(m.value), new Decimal(0))
    expect(monthSum.toString()).toBe('1200000')
    expect(result.year.value.toString()).toBe('100000')
  })
})

describe('allocateRatioYear — mục tiêu khác nhau theo tháng', () => {
  // Mùa cao điểm cuối năm cho phép CPA cao hơn
  const monthlyValues: Record<number, string> = {
    1: '90000', 2: '90000', 3: '95000', 4: '95000',
    5: '100000', 6: '100000', 7: '100000', 8: '100000',
    9: '105000', 10: '110000', 11: '120000', 12: '130000',
  }
  const result = allocateRatioYear({ year: 2026, monthlyValues })

  it('tháng giữ nguyên giá trị admin nhập', () => {
    expect(result.months[0]?.value.toString()).toBe('90000')
    expect(result.months[11]?.value.toString()).toBe('130000')
  })

  it('ngày kế thừa nguyên giá trị của tháng chứa nó', () => {
    for (let m = 1; m <= 12; m++) {
      const daysOfMonth = result.days.filter((d) => monthOf(d.start) === m)
      expect(daysOfMonth).toHaveLength(daysInMonth(2026, m))
      const expected = monthlyValues[m]
      expect(daysOfMonth.every((d) => d.value.toString() === expected)).toBe(true)
    }
  })

  it('quý là trung bình có trọng số theo số ngày của 3 tháng', () => {
    // Q1 2026: T1 90000×31 + T2 90000×28 + T3 95000×31 = 8.435.000, / 90 ngày
    const q1 = result.quarters[0]?.value
    const expected = new Decimal(90000)
      .times(31)
      .plus(new Decimal(90000).times(28))
      .plus(new Decimal(95000).times(31))
      .dividedBy(90)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    expect(q1?.toString()).toBe(expected.toString())
  })

  it('năm nằm trong khoảng giữa tháng thấp nhất và cao nhất', () => {
    const year = result.year.value
    expect(year.gte(90000)).toBe(true)
    expect(year.lte(130000)).toBe(true)
  })

  it('tuần vắt qua ranh giới tháng lấy trung bình theo số ngày thuộc mỗi tháng', () => {
    // Tuần chứa 31/01 và 01/02: 90000 cả hai tháng nên bằng 90000.
    // Chọn tuần vắt T3→T4 (95000 → 95000) và T10→T11 (110000 → 120000) để thấy khác biệt.
    const crossing = result.weeks.find(
      (w) => monthOf(w.start) === 10 && monthOf(w.end) === 11,
    )
    expect(crossing).toBeDefined()
    const value = crossing?.value as Decimal
    expect(value.gt(110000)).toBe(true)
    expect(value.lt(120000)).toBe(true)
  })
})

describe('allocateRatioYear — năm nhuận', () => {
  it('sinh đủ 366 ngày, tháng 2 có 29 ngày', () => {
    const result = allocateRatioYear({ year: 2024, monthlyValues: flat('100000') })
    expect(result.days).toHaveLength(366)
    expect(result.days.filter((d) => monthOf(d.start) === 2)).toHaveLength(29)
  })
})

describe('allocateRatioYear — idempotent', () => {
  it('chạy hai lần cho kết quả giống hệt', () => {
    const input = { year: 2026, monthlyValues: flat('100000') }
    const a = allocateRatioYear(input)
    const b = allocateRatioYear(input)
    expect(a.months.map((m) => m.value.toString())).toEqual(
      b.months.map((m) => m.value.toString()),
    )
  })
})

describe('allocateRatioYear — đầu vào không hợp lệ', () => {
  it('từ chối khi thiếu mục tiêu của một tháng', () => {
    const missing = flat('100000')
    delete missing[7]
    expect(() => allocateRatioYear({ year: 2026, monthlyValues: missing })).toThrow(
      /Thiếu mục tiêu cho tháng 7/,
    )
  })

  it('từ chối mục tiêu âm', () => {
    const negative = { ...flat('100000'), 3: '-1' }
    expect(() => allocateRatioYear({ year: 2026, monthlyValues: negative })).toThrow(
      /không được âm/,
    )
  })

  it('từ chối năm ngoài khoảng cho phép', () => {
    expect(() => allocateRatioYear({ year: 1800, monthlyValues: flat('1') })).toThrow(
      AllocationError,
    )
  })

  it('chấp nhận mục tiêu bằng 0', () => {
    const result = allocateRatioYear({ year: 2026, monthlyValues: flat('0') })
    expect(result.year.value.toString()).toBe('0')
  })
})
