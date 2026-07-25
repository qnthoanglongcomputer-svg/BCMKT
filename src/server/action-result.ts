import { ForbiddenError, UnauthorizedError } from '@/server/auth/guard'

/** Kết quả trả về từ mọi server action. `error` là tiếng Việt, hiển thị thẳng được. */
export interface ActionResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
  /** Lỗi theo từng trường, dùng để highlight ô nhập */
  fieldErrors?: Record<string, string>
}

/**
 * Chuyển lỗi thành thông báo hiển thị được.
 *
 * Lỗi nghiệp vụ (có `name` kết thúc bằng `Error` và do ta tự định nghĩa) giữ
 * nguyên thông điệp. Lỗi không lường trước bị nuốt thành thông báo chung —
 * **không để lộ stack trace, tên bảng hay câu SQL** ra client.
 */
const BUSINESS_ERRORS = new Set([
  'AllocationError',
  'ScoringError',
  'RollupError',
  'ForecastError',
  'PlanServiceError',
  'WeightServiceError',
  'DepartmentServiceError',
  'UserServiceError',
  'CampaignServiceError',
  'ExportError',
  'AiInsightError',
  'OrgTreeError',
  'AdsEntryError',
])

export function toActionError(error: unknown): string {
  if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
    return error.message
  }
  if (error instanceof Error && BUSINESS_ERRORS.has(error.name)) {
    return error.message
  }
  console.error('Lỗi không lường trước:', error)
  return 'Có lỗi xảy ra khi xử lý. Vui lòng thử lại.'
}

export function collectFieldErrors(error: {
  issues: Array<{ path: PropertyKey[]; message: string }>
}): Pick<ActionResult, 'fieldErrors' | 'error'> {
  const fieldErrors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.') || 'form'
    fieldErrors[key] ??= issue.message
  }
  return { fieldErrors, error: Object.values(fieldErrors)[0] ?? 'Dữ liệu nhập không hợp lệ' }
}
