'use server'

import { revalidatePath } from 'next/cache'
import { savePlan, previewAllocation, PlanServiceError } from '@/server/kpi/plan-service'
import { saveWeightGroup, WeightServiceError } from '@/server/kpi/weight-service'
import { savePlanSchema, saveWeightGroupSchema } from '@/server/kpi/schemas'
import { AllocationError } from '@/server/kpi/allocation'
import { ScoringError } from '@/server/kpi/scoring'
import {
  ForbiddenError,
  UnauthorizedError,
  assertCanManageKpi,
  assertDepartmentInScope,
  requireScope,
} from '@/server/auth/guard'

/**
 * Mọi action ở đây theo đúng thứ tự: lấy user từ session → kiểm quyền → validate
 * → áp scope → gọi service → trả kết quả. **Không tin bất cứ thứ gì từ client**,
 * kể cả `ownerId` — nó luôn được kiểm lại với phạm vi của người đang đăng nhập.
 */

export interface ActionResult<T = unknown> {
  ok: boolean
  data?: T
  /** Thông báo tiếng Việt, hiển thị được thẳng cho người dùng */
  error?: string
  /** Lỗi theo từng trường, dùng để highlight ô nhập */
  fieldErrors?: Record<string, string>
}

/** Chuyển lỗi nghiệp vụ thành thông báo hiển thị được, giấu chi tiết kỹ thuật. */
function toMessage(error: unknown): string {
  if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
    return error.message
  }
  if (
    error instanceof AllocationError ||
    error instanceof ScoringError ||
    error instanceof PlanServiceError ||
    error instanceof WeightServiceError
  ) {
    return error.message
  }
  console.error('Lỗi không lường trước:', error)
  return 'Có lỗi xảy ra khi xử lý. Vui lòng thử lại.'
}

export async function previewAllocationAction(raw: unknown): Promise<ActionResult> {
  const parsed = savePlanSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, ...collectFieldErrors(parsed.error) }
  }

  try {
    const { scope } = await requireScope()
    assertCanManageKpi(scope)
    assertDepartmentInScope(scope, parsed.data.ownerId)

    const result = await previewAllocation(parsed.data)
    return {
      ok: true,
      data: {
        year: result.year.value.toString(),
        months: result.months.map((m) => ({
          start: m.start.toISOString(),
          days: m.days,
          value: m.value.toString(),
        })),
        quarters: result.quarters.map((q) => ({
          start: q.start.toISOString(),
          value: q.value.toString(),
        })),
        weekCount: result.weeks.length,
        dayCount: result.days.length,
      },
    }
  } catch (error) {
    return { ok: false, error: toMessage(error) }
  }
}

export async function savePlanAction(raw: unknown): Promise<ActionResult<{ planId: string }>> {
  const parsed = savePlanSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, ...collectFieldErrors(parsed.error) }
  }

  try {
    const { user, scope } = await requireScope()
    assertCanManageKpi(scope)
    // Không tin `ownerId` từ client: kiểm lại với phạm vi của người đang đăng nhập.
    assertDepartmentInScope(scope, parsed.data.ownerId)

    const result = await savePlan(parsed.data, user.id)
    revalidatePath('/kpi')
    revalidatePath('/dashboard')
    revalidatePath('/performance')
    return { ok: true, data: { planId: result.planId } }
  } catch (error) {
    return { ok: false, error: toMessage(error) }
  }
}

export async function saveWeightGroupAction(raw: unknown): Promise<ActionResult> {
  const parsed = saveWeightGroupSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, ...collectFieldErrors(parsed.error) }
  }

  try {
    const { user, scope } = await requireScope()
    assertCanManageKpi(scope)

    await saveWeightGroup(parsed.data, user.id)
    revalidatePath('/kpi/weights')
    return { ok: true }
  } catch (error) {
    return { ok: false, error: toMessage(error) }
  }
}

function collectFieldErrors(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  const fieldErrors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.') || 'form'
    fieldErrors[key] ??= issue.message
  }
  const first = Object.values(fieldErrors)[0]
  return { fieldErrors, error: first ?? 'Dữ liệu nhập không hợp lệ' }
}
