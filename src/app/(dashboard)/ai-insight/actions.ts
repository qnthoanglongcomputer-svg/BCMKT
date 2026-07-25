'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireScope } from '@/server/auth/guard'
import { getInsight } from '@/server/ai/insight-service'
import { toActionError, type ActionResult } from '@/server/action-result'

const analyzeSchema = z.object({
  departmentCode: z.string().min(1, 'Chưa chọn bộ phận'),
})

/**
 * Phân tích lại, bỏ qua cache.
 *
 * Chỉ Admin và Trưởng phòng được chạy — mỗi lần bấm là một lần gọi API tính phí.
 */
export async function reanalyzeAction(raw: unknown): Promise<ActionResult> {
  const parsed = analyzeSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Tham số không hợp lệ' }

  try {
    const { user, scope } = await requireScope()
    if (user.role !== 'ADMIN' && user.role !== 'MARKETING_MANAGER') {
      return { ok: false, error: 'Chỉ quản trị viên và trưởng phòng mới chạy được phân tích lại.' }
    }

    const result = await getInsight(parsed.data.departmentCode, new Date(), scope, {
      force: true,
    })
    if (!result) {
      return { ok: false, error: 'Không có dữ liệu để phân tích cho bộ phận này.' }
    }

    revalidatePath('/ai-insight')
    return { ok: true }
  } catch (error) {
    return { ok: false, error: toActionError(error) }
  }
}
