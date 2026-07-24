import { describe, expect, it } from 'vitest'
import {
  daysBetweenInclusive,
  daysInMonth,
  daysInYear,
  dayPeriods,
  isLeapYear,
  monthPeriods,
  quarterPeriods,
  utcDate,
  weekPeriods,
} from './period'

describe('năm nhuận', () => {
  it('nhận diện đúng các trường hợp biên', () => {
    expect(isLeapYear(2024)).toBe(true)
    expect(isLeapYear(2025)).toBe(false)
    expect(isLeapYear(1900)).toBe(false) // chia hết 100 nhưng không chia hết 400
    expect(isLeapYear(2000)).toBe(true) // chia hết 400
  })

  it('trả 366 ngày cho năm nhuận, 365 cho năm thường', () => {
    expect(daysInYear(2024)).toBe(366)
    expect(daysInYear(2026)).toBe(365)
  })

  it('tháng 2 năm nhuận có 29 ngày', () => {
    expect(daysInMonth(2024, 2)).toBe(29)
    expect(daysInMonth(2026, 2)).toBe(28)
  })
})

describe('kỳ theo tháng và quý', () => {
  it('12 tháng phủ kín đúng số ngày trong năm', () => {
    const months = monthPeriods(2026)
    expect(months).toHaveLength(12)
    expect(months.reduce((s, m) => s + m.days, 0)).toBe(365)
  })

  it('4 quý phủ kín năm nhuận', () => {
    const quarters = quarterPeriods(2024)
    expect(quarters).toHaveLength(4)
    expect(quarters.reduce((s, q) => s + q.days, 0)).toBe(366)
    expect(quarters[0]?.days).toBe(91) // Q1 2024: 31 + 29 + 31
  })

  it('sinh đủ số ngày trong năm', () => {
    expect(dayPeriods(2024)).toHaveLength(366)
    expect(dayPeriods(2026)).toHaveLength(365)
  })
})

describe('kỳ theo tuần', () => {
  it('các tuần phủ kín năm không thừa không thiếu', () => {
    for (const year of [2024, 2025, 2026, 2027]) {
      const weeks = weekPeriods(year)
      const total = weeks.reduce((s, w) => s + w.days, 0)
      expect(total).toBe(daysInYear(year))
    }
  })

  it('tuần đầu và tuần cuối được cắt về trong phạm vi năm', () => {
    const weeks = weekPeriods(2026)
    const first = weeks[0]
    const last = weeks[weeks.length - 1]
    expect(first?.start).toEqual(utcDate(2026, 1, 1))
    expect(last?.end).toEqual(utcDate(2026, 12, 31))
  })

  it('các tuần liền mạch, không chồng lấn và không hở', () => {
    const weeks = weekPeriods(2026)
    for (let i = 1; i < weeks.length; i++) {
      const prevEnd = weeks[i - 1]?.end as Date
      const currStart = weeks[i]?.start as Date
      expect(daysBetweenInclusive(prevEnd, currStart)).toBe(2) // liền kề: end + 1 ngày = start
    }
  })
})
