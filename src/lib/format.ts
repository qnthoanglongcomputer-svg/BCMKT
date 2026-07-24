/**
 * Định dạng số cho toàn hệ thống. **Không tự viết lại ở component.**
 *
 * Quy ước: giá trị `null` nghĩa là "chưa xác định" (mẫu số bằng 0, chưa có
 * dữ liệu) — luôn hiển thị `—`, tuyệt đối không hiển thị `0`. Hai thứ này
 * mang ý nghĩa khác nhau với người đọc báo cáo.
 */

/** Ký hiệu hiển thị cho giá trị chưa xác định. */
export const EM_DASH = '—'

const VI = 'vi-VN'

type Nullable = number | string | null | undefined

function toNumber(value: Nullable): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(n) ? n : null
}

/** Số lượng: phân cách nghìn. `72000` → `72.000` */
export function formatNumber(value: Nullable, maximumFractionDigits = 0): string {
  const n = toNumber(value)
  if (n === null) return EM_DASH
  return n.toLocaleString(VI, { maximumFractionDigits })
}

/** Tiền VND đầy đủ. `1250000` → `1.250.000 ₫` */
export function formatCurrency(value: Nullable): string {
  const n = toNumber(value)
  if (n === null) return EM_DASH
  return `${n.toLocaleString(VI, { maximumFractionDigits: 0 })} ₫`
}

/**
 * Rút gọn số lớn. `72000` → `72K`, `1200000000` → `1,2 tỷ`
 * **Chỉ dùng ở KPI tile.** Bảng dữ liệu luôn hiện số đầy đủ để người dùng đối chiếu.
 */
export function formatCompact(value: Nullable): string {
  const n = toNumber(value)
  if (n === null) return EM_DASH

  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''

  if (abs >= 1_000_000_000) return `${sign}${trim(abs / 1_000_000_000)} tỷ`
  if (abs >= 1_000_000) return `${sign}${trim(abs / 1_000_000)} triệu`
  if (abs >= 1_000) return `${sign}${trim(abs / 1_000)}K`
  return n.toLocaleString(VI, { maximumFractionDigits: 0 })
}

/** Tiền rút gọn cho tile. `1800000000` → `1,8 tỷ ₫` */
export function formatCurrencyCompact(value: Nullable): string {
  const n = toNumber(value)
  if (n === null) return EM_DASH
  return `${formatCompact(n)} ₫`
}

function trim(n: number): string {
  // Một chữ số thập phân, bỏ ",0" thừa: 1.0 → "1", 1.2 → "1,2"
  return n.toLocaleString(VI, { maximumFractionDigits: 1 })
}

/** Phần trăm từ **tỷ lệ**. `0.843` → `84,3%` */
export function formatPercent(ratio: Nullable, fractionDigits = 1): string {
  const n = toNumber(ratio)
  if (n === null) return EM_DASH
  return `${(n * 100).toLocaleString(VI, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}%`
}

/** Phần trăm từ số đã nhân 100 sẵn. `84.3` → `84,3%` */
export function formatPercentValue(value: Nullable, fractionDigits = 1): string {
  const n = toNumber(value)
  if (n === null) return EM_DASH
  return `${n.toLocaleString(VI, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}%`
}

/** Điểm KPI: tối đa 1 chữ số thập phân. `92.6` → `92,6` */
export function formatScore(value: Nullable): string {
  const n = toNumber(value)
  if (n === null) return EM_DASH
  return n.toLocaleString(VI, { maximumFractionDigits: 1 })
}

/**
 * Định dạng theo đơn vị của metric (`kpi_definitions.unit`).
 * `compact` chỉ bật ở KPI tile.
 */
export function formatByUnit(
  value: Nullable,
  unit: string,
  options: { compact?: boolean } = {},
): string {
  const n = toNumber(value)
  if (n === null) return EM_DASH

  if (unit === 'VND') {
    return options.compact ? formatCurrencyCompact(n) : formatCurrency(n)
  }
  if (unit === '%') {
    return formatPercentValue(n)
  }
  if (unit === 'lần') {
    return n.toLocaleString(VI, { maximumFractionDigits: 2 })
  }
  return options.compact ? formatCompact(n) : formatNumber(n)
}

// ─────────────────────────────────────────────────────────────
// Ngày và kỳ
// ─────────────────────────────────────────────────────────────

/** `dd/MM/yyyy`. Dùng getUTC* vì ngày lịch lưu ở UTC-midnight. */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return EM_DASH
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return EM_DASH
  const day = String(d.getUTCDate()).padStart(2, '0')
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${d.getUTCFullYear()}`
}

/** `01/07` — dùng cho trục biểu đồ, tiết kiệm chỗ. */
export function formatDateShort(date: Date | string | null | undefined): string {
  if (!date) return EM_DASH
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return EM_DASH
  const day = String(d.getUTCDate()).padStart(2, '0')
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${day}/${month}`
}

export type PeriodType = 'YEAR' | 'QUARTER' | 'MONTH' | 'WEEK' | 'DAY'

/** `Tháng 7/2026` · `Quý 3/2026` · `Năm 2026` */
export function formatPeriod(periodType: PeriodType, start: Date | string): string {
  const d = typeof start === 'string' ? new Date(start) : start
  if (Number.isNaN(d.getTime())) return EM_DASH

  const year = d.getUTCFullYear()
  const month = d.getUTCMonth() + 1

  switch (periodType) {
    case 'YEAR':
      return `Năm ${year}`
    case 'QUARTER':
      return `Quý ${Math.floor((month - 1) / 3) + 1}/${year}`
    case 'MONTH':
      return `Tháng ${month}/${year}`
    case 'WEEK':
      return `Tuần ${isoWeekNumber(d)}/${year}`
    case 'DAY':
      return formatDate(d)
  }
}

function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  // Dời về thứ Năm cùng tuần — định nghĩa tuần ISO neo vào thứ Năm
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
}

// ─────────────────────────────────────────────────────────────
// Trạng thái KPI
// ─────────────────────────────────────────────────────────────

export type KpiStatus = 'ACHIEVED' | 'AT_RISK' | 'MISSED' | 'NO_DATA'

/**
 * Trạng thái theo % đạt (attainment là **tỷ lệ**, 0.84 = 84%).
 * Ngưỡng thống nhất toàn hệ thống — không hardcode 0.8/1.0 ở nơi khác.
 */
export function kpiStatus(attainment: number | null | undefined): KpiStatus {
  if (attainment === null || attainment === undefined) return 'NO_DATA'
  if (attainment >= 1) return 'ACHIEVED'
  if (attainment >= 0.8) return 'AT_RISK'
  return 'MISSED'
}

/** Nhãn chữ đi kèm màu — màu không bao giờ là tín hiệu duy nhất. */
export const KPI_STATUS_LABEL: Record<KpiStatus, string> = {
  ACHIEVED: 'Đạt',
  AT_RISK: 'Gần đạt',
  MISSED: 'Không đạt',
  NO_DATA: 'Chưa có dữ liệu',
}

/**
 * Chiều "tốt" của một thay đổi, đã tính tới metric nghịch.
 * CPA giảm 12% là tin **tốt** → trả 'good'.
 */
export function changeTone(
  delta: number | null | undefined,
  direction: 'HIGHER_BETTER' | 'LOWER_BETTER',
): 'good' | 'bad' | 'neutral' {
  if (delta === null || delta === undefined || delta === 0) return 'neutral'
  const isUp = delta > 0
  const upIsGood = direction === 'HIGHER_BETTER'
  return isUp === upIsGood ? 'good' : 'bad'
}

/** Thay đổi so kỳ trước, luôn có dấu. `0.12` → `+12,0%` */
export function formatDelta(delta: number | null | undefined): string {
  if (delta === null || delta === undefined) return EM_DASH
  const sign = delta > 0 ? '+' : ''
  return `${sign}${(delta * 100).toLocaleString(VI, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`
}
