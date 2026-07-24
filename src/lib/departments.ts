/**
 * Mã phòng ban dùng cho dashboard chuyên biệt — **nguồn duy nhất**.
 *
 * Đây là chỗ hardcode DUY NHẤT được phép liên quan tới bộ phận, và chỉ hardcode
 * `code`, không bao giờ hardcode tên tiếng Việt. Tên hiển thị luôn đọc từ DB
 * để đổi tên phòng ban không cần sửa code.
 *
 * Bộ phận mới thêm qua UI mà chưa có dashboard riêng sẽ dùng dashboard mặc định.
 */
export const DEPARTMENT_CODES = {
  COMPANY: 'COMPANY',
  MARKETING: 'MARKETING',
  PERFORMANCE: 'PERFORMANCE',
  CONTENT_SOCIAL: 'CONTENT_SOCIAL',
  TRADE: 'TRADE',
  BRANDING: 'BRANDING',
} as const

export type DepartmentCode = (typeof DEPARTMENT_CODES)[keyof typeof DEPARTMENT_CODES]

/** Bộ phận có dashboard chuyên biệt, theo thứ tự hiển thị trên sidebar. */
export const DASHBOARD_DEPARTMENTS: ReadonlyArray<{ code: DepartmentCode; path: string }> = [
  { code: DEPARTMENT_CODES.PERFORMANCE, path: '/performance' },
  { code: DEPARTMENT_CODES.CONTENT_SOCIAL, path: '/content-social' },
  { code: DEPARTMENT_CODES.TRADE, path: '/trade' },
  { code: DEPARTMENT_CODES.BRANDING, path: '/branding' },
]
