'use server'

import { revalidatePath } from 'next/cache'
import { savePlan, previewAllocation, PlanServiceError } from '@/server/kpi/plan-service'
import { saveWeightGroup, WeightServiceError } from '@/server/kpi/weight-service'
import { savePlanSchema, saveWeightGroupSchema } from '@/server/kpi/schemas'
import { AllocationError } from '@/server/kpi/allocation'
import { ScoringError } from '@/server/kpi/scoring'

/**
 * ⚠️ CHƯA KIỂM QUYỀN — module xác thực (workflow 01) chưa được xây.
 * Khi làm xong 01, mọi action ở đây phải:
 *   1. Lấy user từ session (chưa đăng nhập → lỗi)
 *   2. Kiểm vai trò (chỉ ADMIN được sửa KPI)
 *   3. Áp resolveScope để chặn sửa KPI ngoài phạm vi
 * Hiện tại actorId = null nghĩa là "hệ thống" trong audit log.
 */
const ACTOR_ID: string | null = null

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
    const result = await savePlan(parsed.data, ACTOR_ID)
    revalidatePath('/kpi')
    revalidatePath('/dashboard')
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
    await saveWeightGroup(parsed.data, ACTOR_ID)
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
