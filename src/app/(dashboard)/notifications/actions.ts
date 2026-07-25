'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireUser } from '@/server/auth/guard'
import { generateNotifications, markRead } from '@/server/notifications/service'
import { toActionError, type ActionResult } from '@/server/action-result'

const markReadSchema = z.object({ notificationId: z.string().optional() })

export async function markReadAction(raw: unknown): Promise<ActionResult> {
  const parsed = markReadSchema.safeParse(raw ?? {})
  if (!parsed.success) return { ok: false, error: 'Tham số không hợp lệ' }

  try {
    const user = await requireUser()
    // Chỉ đánh dấu thông báo của chính người đang đăng nhập.
    await markRead(user.id, parsed.data.notificationId)
    revalidatePath('/notifications')
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (error) {
    return { ok: false, error: toActionError(error) }
  }
}

/**
 * Chạy quét sinh thông báo thủ công.
 *
 * Bình thường việc này do cron làm. Nút bấm ở màn hình chỉ để quản trị viên
 * kiểm tra ngay sau khi đổi ngưỡng, không phải cách vận hành chính.
 */
export async function generateNotificationsAction(): Promise<ActionResult<{ created: number }>> {
  try {
    const user = await requireUser()
    if (user.role !== 'ADMIN') {
      return { ok: false, error: 'Chỉ quản trị viên mới chạy được quét thông báo.' }
    }

    const result = await generateNotifications(new Date())
    revalidatePath('/notifications')
    return { ok: true, data: { created: result.created } }
  } catch (error) {
    return { ok: false, error: toActionError(error) }
  }
}
