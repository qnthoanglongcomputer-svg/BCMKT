/**
 * Khoá chống trùng cho thông báo.
 *
 * Đây là phần quyết định thông báo có được dùng hay bị người dùng tắt hết.
 * Khoá phải chứa **đủ ngữ cảnh để nhận ra "vẫn là việc cũ"**: cùng một việc
 * chưa đổi tình trạng thì không gửi lại, dù job chạy mỗi giờ.
 *
 * Hàm thuần, không chạm DB — dễ test và dễ soi khi thông báo bị lặp.
 */

export type NotificationType =
  | 'KPI_BELOW_THRESHOLD'
  | 'KPI_FORECAST_MISS'
  | 'KPI_ACHIEVED'
  | 'CAMPAIGN_OVER_BUDGET'
  | 'REPORT_PENDING_APPROVAL'
  | 'REPORT_MISSING'
  | 'ADS_SYNC_FAILED'

/**
 * Khoá gồm: loại · đối tượng · kỳ (hoặc mốc trạng thái).
 *
 * Không đưa thời điểm gửi vào khoá — làm vậy là mỗi lần chạy lại tạo khoá mới
 * và thông báo lặp vô hạn.
 */
export function buildDedupeKey(
  type: NotificationType,
  subjectId: string,
  periodKey: string,
): string {
  return `${type}:${subjectId}:${periodKey}`
}

/** Khoá kỳ dạng `2026-07` cho thông báo theo tháng. */
export function monthKey(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/** Khoá kỳ dạng `2026-07-24` cho thông báo theo ngày. */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Gộp nhiều việc cùng loại thành một thông báo.
 *
 * 12 báo cáo chờ duyệt phải là **một** thông báo "Bạn có 12 báo cáo chờ duyệt",
 * không phải 12 thông báo riêng lẻ.
 */
export function summarizeCount(
  count: number,
  singular: string,
  plural = singular,
): string {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`
}

/** Giờ làm việc theo múi giờ nghiệp vụ; ngoài khung này chỉ gửi mức nghiêm trọng. */
export const QUIET_HOURS = { startHour: 20, endHour: 7 } as const

export function isQuietHour(date: Date, timeZone = 'Asia/Ho_Chi_Minh'): boolean {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      hour12: false,
    }).format(date),
  )
  return hour >= QUIET_HOURS.startHour || hour < QUIET_HOURS.endHour
}
