import Decimal from 'decimal.js'
import { daysBetweenInclusive } from '@/server/kpi/period'

/**
 * Xử lý khoảng ngày cho dashboard: preset, tùy chọn, kỳ so sánh và phân bổ mục
 * tiêu theo ngày. Hàm thuần, không chạm DB — mọi "hôm nay" truyền vào tường minh.
 *
 * Ngày lịch biểu diễn bằng Date ở UTC-midnight như phần còn lại của hệ thống.
 */

export type RangePreset = 'this-month' | 'last-month' | 'last-7-days' | 'last-30-days' | 'custom'

export interface DateRange {
  from: Date
  to: Date
  preset: RangePreset
  /** Số ngày trong khoảng (đóng cả hai đầu) */
  days: number
  label: string
}

function utc(year: number, month0: number, day: number): Date {
  return new Date(Date.UTC(year, month0, day))
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000)
}

function formatDay(date: Date): string {
  const d = String(date.getUTCDate()).padStart(2, '0')
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${d}/${m}/${date.getUTCFullYear()}`
}

function monthLabel(date: Date): string {
  return `Tháng ${date.getUTCMonth() + 1}/${date.getUTCFullYear()}`
}

function build(from: Date, to: Date, preset: RangePreset, label: string): DateRange {
  return { from, to, preset, days: daysBetweenInclusive(from, to), label }
}

/**
 * Phân giải khoảng ngày từ tham số URL.
 *
 * `custom` cần cả `from` và `to` hợp lệ (yyyy-MM-dd, from ≤ to); thiếu hoặc sai
 * thì lùi về tháng này. Ngày kết thúc bị chặn không vượt quá `today` — không có
 * dữ liệu tương lai để xem.
 */
export function resolveDateRange(
  params: { preset?: string; from?: string; to?: string },
  today: Date,
): DateRange {
  const preset = (params.preset ?? 'this-month') as RangePreset
  const year = today.getUTCFullYear()
  const month = today.getUTCMonth()

  switch (preset) {
    case 'last-month': {
      const from = utc(year, month - 1, 1)
      const to = utc(year, month, 0) // ngày cuối tháng trước
      return build(from, to, 'last-month', monthLabel(from))
    }
    case 'last-7-days': {
      const from = addDays(today, -6)
      return build(from, today, 'last-7-days', '7 ngày gần nhất')
    }
    case 'last-30-days': {
      const from = addDays(today, -29)
      return build(from, today, 'last-30-days', '30 ngày gần nhất')
    }
    case 'custom': {
      const from = parseDay(params.from)
      const to = parseDay(params.to)
      if (from && to && from <= to) {
        // Không cho xem quá hôm nay.
        const cappedTo = to > today ? today : to
        return build(from, cappedTo, 'custom', `${formatDay(from)} – ${formatDay(cappedTo)}`)
      }
      // Tham số hỏng → lùi về tháng này thay vì lỗi.
      break
    }
    case 'this-month':
    default:
      break
  }

  const from = utc(year, month, 1)
  return build(from, today, 'this-month', monthLabel(from))
}

function parseDay(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [y, m, d] = value.split('-').map(Number)
  const date = utc(y as number, (m as number) - 1, d as number)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Kỳ liền trước, cùng độ dài, kết thúc ngay trước khi kỳ hiện tại bắt đầu.
 *
 * Xem 30 ngày → so 30 ngày trước đó. Xem tháng 7 → so đúng số ngày liền kề
 * trước ngày 1/7 (không phải "tháng 6" theo lịch, mà là cùng số ngày — để so
 * sánh công bằng khi kỳ hiện tại chưa trọn tháng).
 */
export function previousRange(range: DateRange): { from: Date; to: Date; days: number } {
  const to = addDays(range.from, -1)
  const from = addDays(to, -(range.days - 1))
  return { from, to, days: range.days }
}

/**
 * Ngày lịch nằm trong `[from, to]` (đóng cả hai đầu).
 * Dùng để đếm/gộp dữ liệu theo khoảng.
 */
export function eachDay(from: Date, to: Date): Date[] {
  const out: Date[] = []
  for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
    out.push(new Date(d))
  }
  return out
}

/**
 * Phân bổ một mục tiêu tháng cho khoảng `[from, to]`.
 *
 * Mục tiêu đặt theo tháng; khi xem một khoảng con (hoặc vắt qua nhiều tháng),
 * mỗi ngày nhận `mục_tiêu_tháng / số_ngày_trong_tháng_đó`, rồi cộng dồn các
 * ngày thuộc khoảng. Nhờ vậy "thực tế tới nay" so đúng với "kế hoạch tới nay".
 *
 * `monthlyTargets`: khoá `"yyyy-M"` (M không đệm 0) → mục tiêu tháng đó.
 * Trả `null` nếu không tháng nào trong khoảng có mục tiêu (chưa đặt kế hoạch).
 */
export function prorateTarget(
  from: Date,
  to: Date,
  monthlyTargets: Map<string, Decimal.Value>,
): Decimal | null {
  let sum = new Decimal(0)
  let matched = false

  for (const day of eachDay(from, to)) {
    const key = `${day.getUTCFullYear()}-${day.getUTCMonth() + 1}`
    const target = monthlyTargets.get(key)
    if (target === undefined) continue
    matched = true
    const daysInMonth = new Date(
      Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0),
    ).getUTCDate()
    sum = sum.plus(new Decimal(target).dividedBy(daysInMonth))
  }

  return matched ? sum : null
}
