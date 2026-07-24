/**
 * Bảng màu và thông số chung cho mọi biểu đồ.
 * Một hệ màu duy nhất, dùng được ở cả light và dark mode.
 */

export const CHART_COLORS = {
  actual: '#2563eb',
  target: '#94a3b8',
  positive: '#059669',
  warning: '#d97706',
  negative: '#e11d48',
  series: ['#2563eb', '#059669', '#d97706', '#7c3aed', '#0891b2', '#e11d48'],
} as const

export const CHART_GRID = '#e2e8f0'
export const CHART_GRID_DARK = '#1e293b'

/** Chiều cao tối thiểu cho vùng biểu đồ — đặt trước để không giật layout khi dữ liệu về. */
export const CHART_MIN_HEIGHT = 260

export const AXIS_STYLE = {
  fontSize: 11,
  fill: '#64748b',
} as const

export const TOOLTIP_STYLE = {
  fontSize: 12,
  borderRadius: 6,
  border: '1px solid #e2e8f0',
  backgroundColor: '#ffffff',
  color: '#0f172a',
} as const
