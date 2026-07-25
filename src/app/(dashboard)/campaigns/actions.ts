'use server'

import { revalidatePath } from 'next/cache'
import { ForbiddenError, requireScope } from '@/server/auth/guard'
import { saveCampaign, saveCampaignSchema } from '@/server/campaigns/campaign-service'
import { collectFieldErrors, toActionError, type ActionResult } from '@/server/action-result'

export async function saveCampaignAction(raw: unknown): Promise<ActionResult> {
  const parsed = saveCampaignSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, ...collectFieldErrors(parsed.error) }

  try {
    const { user } = await requireScope()
    // Chiến dịch là dữ liệu cấp phòng — chỉ Admin và Trưởng phòng được sửa.
    if (user.role !== 'ADMIN' && user.role !== 'MARKETING_MANAGER') {
      throw new ForbiddenError('Chỉ quản trị viên và trưởng phòng mới được thay đổi chiến dịch.')
    }

    const result = await saveCampaign(parsed.data, user.id)
    revalidatePath('/campaigns')
    return { ok: true, data: result }
  } catch (error) {
    return { ok: false, error: toActionError(error) }
  }
}
