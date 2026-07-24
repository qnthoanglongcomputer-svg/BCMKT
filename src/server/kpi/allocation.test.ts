import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { AllocationError, allocateYear, distributeWithRemainder } from './allocation'
import { daysInMonth, monthOf } from './period'
import type { AllocatedPeriod, AllocationResult } from './types'

function sum(items: AllocatedPeriod[]): Decimal {
  return items.reduce<Decimal>((acc, i) => acc.plus(i.value), new Decimal(0))
}

function expectAllInvariants(result: AllocationResult, expectedTotal: Decimal.Value) {
  const total = new Decimal(expectedTotal)
  expect(sum(result.months).toString()).toBe(total.toString())
  expect(sum(result.quarters).toString()).toBe(total.toString())
  expect(sum(result.weeks).toString()).toBe(total.toString())
  expect(sum(result.days).toString()).toBe(total.toString())
}

describe('distributeWithRemainder', () => {
  it('tổng các phần luôn bằng đúng tổng ban đầu, kể cả khi chia lẻ', () => {
    const parts = distributeWithRemainder(100, [1, 1, 1])
    expect(parts.reduce((a, b) => a.plus(b), new Decimal(0)).toString()).toBe('100')
  })

  it('dồn sai số làm tròn vào phần tử cuối cùng', () => {
    const parts = distributeWithRemainder(10, [1, 1, 1])
    expect(parts[0]?.toString()).toBe('3.33')
    expect(parts[1]?.toString()).toBe('3.33')
    expect(parts[2]?.toString()).toBe('3.34')
  })

  it('từ chối tổng trọng số bằng 0', () => {
    expect(() => distributeWithRemainder(100, [0, 0])).toThrow(AllocationError)
  })
})

describe('allocateYear — EVEN', () => {
  it('giữ nguyên bất biến tổng ở mọi cấp kỳ', () => {
    const result = allocateYear({ year: 2026, yearTarget: 72000, strategy: 'EVEN' })
    expectAllInvariants(result, 72000)
  })

  it('chia theo số ngày thực, không chia đều 12 phần bằng nhau', () => {
    const result = allocateYear({ year: 2026, yearTarget: 36500, strategy: 'EVEN' })
    const jan = result.months[0]?.value as Decimal
    const feb = result.months[1]?.value as Decimal
    // Tháng 1 có 31 ngày, tháng 2 có 28 ngày → tháng 1 phải lớn hơn
    expect(jan.gt(feb)).toBe(true)
    expect(jan.toString()).toBe('3100')
    expect(feb.toString()).toBe('2800')
  })

  it('xử lý đúng năm nhuận: 366 ngày, tháng 2 có 29 ngày', () => {
    const result = allocateYear({ year: 2024, yearTarget: 73200, strategy: 'EVEN' })
    expect(result.days).toHaveLength(366)
    const febDays = result.days.filter((d) => monthOf(d.start) === 2)
    expect(febDays).toHaveLength(29)
    expectAllInvariants(result, 73200)
  })

  it('phân bổ ngày trong mỗi tháng cộng lại đúng bằng mục tiêu tháng đó', () => {
    const result = allocateYear({ year: 2026, yearTarget: 72000, strategy: 'EVEN' })
    for (let m = 1; m <= 12; m++) {
      const monthDays = result.days.filter((d) => monthOf(d.start) === m)
      expect(monthDays).toHaveLength(daysInMonth(2026, m))
      const daySum = sum(monthDays)
      expect(daySum.toString()).toBe((result.months[m - 1]?.value as Decimal).toString())
    }
  })

  it('idempotent: chạy hai lần cho kết quả giống hệt', () => {
    const input = { year: 2026, yearTarget: 72000, strategy: 'EVEN' as const }
    const a = allocateYear(input)
    const b = allocateYear(input)
    expect(a.days.map((d) => d.value.toString())).toEqual(
      b.days.map((d) => d.value.toString()),
    )
  })

  it('chấp nhận mục tiêu bằng 0', () => {
    const result = allocateYear({ year: 2026, yearTarget: 0, strategy: 'EVEN' })
    expect(sum(result.months).toString()).toBe('0')
  })

  it('từ chối mục tiêu âm', () => {
    expect(() =>
      allocateYear({ year: 2026, yearTarget: -100, strategy: 'EVEN' }),
    ).toThrow(AllocationError)
  })
})

describe('allocateYear — WEIGHTED', () => {
  const weights: Record<number, string> = {
    1: '0.05',
    2: '0.06',
    3: '0.07',
    4: '0.07',
    5: '0.08',
    6: '0.08',
    7: '0.08',
    8: '0.08',
    9: '0.07',
    10: '0.06',
    11: '0.14',
    12: '0.16',
  }

  it('phân bổ theo đúng tỷ trọng và giữ bất biến tổng', () => {
    const result = allocateYear({
      year: 2026,
      yearTarget: 100000,
      strategy: 'WEIGHTED',
      monthWeights: weights,
    })
    expect(result.months[0]?.value.toString()).toBe('5000')
    expect(result.months[10]?.value.toString()).toBe('14000')
    expectAllInvariants(result, 100000)
  })

  it('từ chối khi tổng tỷ trọng khác 100%', () => {
    const bad = { ...weights, 12: '0.20' }
    expect(() =>
      allocateYear({
        year: 2026,
        yearTarget: 100000,
        strategy: 'WEIGHTED',
        monthWeights: bad,
      }),
    ).toThrow(/Tổng tỷ trọng 12 tháng phải bằng 100%/)
  })

  it('từ chối khi thiếu tỷ trọng của một tháng', () => {
    const missing = { ...weights }
    delete missing[7]
    expect(() =>
      allocateYear({
        year: 2026,
        yearTarget: 100000,
        strategy: 'WEIGHTED',
        monthWeights: missing,
      }),
    ).toThrow(/Thiếu tỷ trọng cho tháng 7/)
  })

  it('yêu cầu monthWeights', () => {
    expect(() =>
      allocateYear({ year: 2026, yearTarget: 100000, strategy: 'WEIGHTED' }),
    ).toThrow(/yêu cầu monthWeights/)
  })
})

describe('allocateYear — MANUAL', () => {
  it('giữ nguyên tháng bị khoá và cân lại các tháng còn lại', () => {
    const result = allocateYear({
      year: 2026,
      yearTarget: 72000,
      strategy: 'MANUAL',
      lockedMonths: { 12: 8000 },
    })
    expect(result.months[11]?.value.toString()).toBe('8000')
    expectAllInvariants(result, 72000)
    // 11 tháng còn lại chia 64.000 theo số ngày
    const rest = sum(result.months.slice(0, 11))
    expect(rest.toString()).toBe('64000')
  })

  it('xử lý nhiều tháng bị khoá cùng lúc', () => {
    const result = allocateYear({
      year: 2026,
      yearTarget: 72000,
      strategy: 'MANUAL',
      lockedMonths: { 1: 3000, 11: 9000, 12: 10000 },
    })
    expect(result.months[0]?.value.toString()).toBe('3000')
    expect(result.months[10]?.value.toString()).toBe('9000')
    expect(result.months[11]?.value.toString()).toBe('10000')
    expectAllInvariants(result, 72000)
  })

  it('từ chối khi tổng tháng khoá vượt mục tiêu năm, không tự cắt bớt', () => {
    expect(() =>
      allocateYear({
        year: 2026,
        yearTarget: 10000,
        strategy: 'MANUAL',
        lockedMonths: { 11: 6000, 12: 8000 },
      }),
    ).toThrow(/vượt mục tiêu năm/)
  })

  it('báo lỗi rõ khi khoá đủ 12 tháng nhưng tổng không khớp', () => {
    const locked: Record<number, number> = {}
    for (let m = 1; m <= 12; m++) locked[m] = 1000
    expect(() =>
      allocateYear({
        year: 2026,
        yearTarget: 20000,
        strategy: 'MANUAL',
        lockedMonths: locked,
      }),
    ).toThrow(/Không còn tháng nào để cân lại/)
  })

  it('chấp nhận khi khoá đủ 12 tháng và tổng khớp chính xác', () => {
    const locked: Record<number, number> = {}
    for (let m = 1; m <= 12; m++) locked[m] = 1000
    const result = allocateYear({
      year: 2026,
      yearTarget: 12000,
      strategy: 'MANUAL',
      lockedMonths: locked,
    })
    expectAllInvariants(result, 12000)
  })

  it('yêu cầu ít nhất một tháng được nhập tay', () => {
    expect(() =>
      allocateYear({ year: 2026, yearTarget: 72000, strategy: 'MANUAL' }),
    ).toThrow(/ít nhất một tháng/)
  })

  it('từ chối chỉ số tháng không hợp lệ', () => {
    expect(() =>
      allocateYear({
        year: 2026,
        yearTarget: 72000,
        strategy: 'MANUAL',
        lockedMonths: { 13: 1000 },
      }),
    ).toThrow(/Tháng không hợp lệ/)
  })
})

describe('allocateYear — tuần cắt qua ranh giới tháng', () => {
  it('tổng các tuần bằng đúng tổng các ngày, kể cả khi tuần nằm vắt qua hai tháng', () => {
    for (const year of [2024, 2025, 2026, 2027]) {
      const result = allocateYear({ year, yearTarget: 72000, strategy: 'EVEN' })
      expect(sum(result.weeks).toString()).toBe(sum(result.days).toString())
    }
  })

  it('giá trị mỗi tuần bằng đúng tổng các ngày thuộc tuần đó', () => {
    const result = allocateYear({ year: 2026, yearTarget: 72000, strategy: 'EVEN' })
    for (const week of result.weeks) {
      const daysInWeek = result.days.filter(
        (d) => d.start >= week.start && d.start <= week.end,
      )
      expect(sum(daysInWeek).toString()).toBe(week.value.toString())
    }
  })
})
