import type { Period } from './types'

/**
 * Toàn bộ ngày trong hệ thống là "ngày lịch" theo múi giờ Asia/Ho_Chi_Minh,
 * biểu diễn bằng Date ở UTC-midnight. Mọi phép tính dùng hàm UTC để tránh
 * lệch ngày do timezone của máy chạy.
 */

export const MS_PER_DAY = 86_400_000

export function utcDate(year: number, month1: number, day: number): Date {
  return new Date(Date.UTC(year, month1 - 1, day))
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate()
}

export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365
}

/** Số ngày trong khoảng đóng [start, end]. */
export function daysBetweenInclusive(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY)
}

function makePeriod(type: Period['type'], start: Date, end: Date): Period {
  return { type, start, end, days: daysBetweenInclusive(start, end) }
}

export function yearPeriod(year: number): Period {
  return makePeriod('YEAR', utcDate(year, 1, 1), utcDate(year, 12, 31))
}

export function quarterPeriods(year: number): Period[] {
  return [1, 2, 3, 4].map((q) => {
    const firstMonth = (q - 1) * 3 + 1
    const lastMonth = firstMonth + 2
    return makePeriod(
      'QUARTER',
      utcDate(year, firstMonth, 1),
      utcDate(year, lastMonth, daysInMonth(year, lastMonth)),
    )
  })
}

export function monthPeriods(year: number): Period[] {
  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    return makePeriod('MONTH', utcDate(year, m, 1), utcDate(year, m, daysInMonth(year, m)))
  })
}

export function dayPeriods(year: number): Period[] {
  const total = daysInYear(year)
  const first = utcDate(year, 1, 1)
  return Array.from({ length: total }, (_, i) => {
    const d = addDays(first, i)
    return makePeriod('DAY', d, d)
  })
}

/**
 * Tuần ISO (Thứ Hai → Chủ Nhật), đã **cắt về trong phạm vi năm**.
 * Tuần đầu và tuần cuối có thể ngắn hơn 7 ngày — đây là chủ ý: nhờ vậy
 * tổng các tuần luôn bằng đúng tổng các ngày trong năm.
 */
export function weekPeriods(year: number): Period[] {
  const yearStart = utcDate(year, 1, 1)
  const yearEnd = utcDate(year, 12, 31)

  // getUTCDay: 0=CN → quy về 0=T2 ... 6=CN
  const offsetToMonday = (yearStart.getUTCDay() + 6) % 7
  let cursor = addDays(yearStart, -offsetToMonday)

  const weeks: Period[] = []
  while (cursor <= yearEnd) {
    const weekEnd = addDays(cursor, 6)
    const start = cursor < yearStart ? yearStart : cursor
    const end = weekEnd > yearEnd ? yearEnd : weekEnd
    weeks.push(makePeriod('WEEK', start, end))
    cursor = addDays(cursor, 7)
  }
  return weeks
}

/** Chỉ số tháng (1–12) mà một ngày thuộc về. */
export function monthOf(date: Date): number {
  return date.getUTCMonth() + 1
}

/** Chỉ số quý (1–4) mà một tháng thuộc về. */
export function quarterOfMonth(month1: number): number {
  return Math.floor((month1 - 1) / 3) + 1
}
