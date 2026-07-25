'use server'

import { revalidatePath } from 'next/cache'
import { ForbiddenError, requireScope } from '@/server/auth/guard'
import { saveAdsEntry, saveAdsEntrySchema } from '@/server/ads/manual-service'
import { saveAdsPlan, saveAdsPlanSchema } from '@/server/ads/plan-service'
import { collectFieldErrors, toActionError, type ActionResult } from '@/server/action-result'

export async function saveAdsEntryAction(raw: unknown): Promise<ActionResult> {
  const parsed = saveAdsEntrySchema.safeParse(raw)
  if (!parsed.success) return { ok: false, ...collectFieldErrors(parsed.error) }

  try {
    const { user } = await requireScope()
    // Số liệu quảng cáo là dữ liệu cấp phòng — chỉ Admin và Trưởng phòng nhập.
    if (user.role !== 'ADMIN' && user.role !== 'MARKETING_MANAGER') {
      throw new ForbiddenError('Chỉ quản trị viên và trưởng phòng mới nhập được số liệu quảng cáo.')
    }

    const result = await saveAdsEntry(parsed.data, user.id)
    revalidatePath('/ads')
    revalidatePath('/dashboard')
    return { ok: true, data: result }
  } catch (error) {
    return { ok: false, error: toActionError(error) }
  }
}

export async function saveAdsPlanAction(raw: unknown): Promise<ActionResult> {
  const parsed = saveAdsPlanSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, ...collectFieldErrors(parsed.error) }

  try {
    const { user } = await requireScope()
    if (user.role !== 'ADMIN' && user.role !== 'MARKETING_MANAGER') {
      throw new ForbiddenError('Chỉ quản trị viên và trưởng phòng mới đặt được mục tiêu quảng cáo.')
    }

    const result = await saveAdsPlan(parsed.data, user.id)
    revalidatePath('/ads/plans')
    revalidatePath('/dashboard')
    return { ok: true, data: result }
  } catch (error) {
    return { ok: false, error: toActionError(error) }
  }
}
