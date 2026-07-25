'use server'

import { revalidatePath } from 'next/cache'
import { requireScope } from '@/server/auth/guard'
import {
  deactivateDepartment,
  saveDepartment,
} from '@/server/org/department-service'
import { resetPassword, savePosition, saveUser } from '@/server/org/user-service'
import {
  deactivateSchema,
  resetPasswordSchema,
  saveDepartmentSchema,
  savePositionSchema,
  saveUserSchema,
} from '@/server/org/schemas'
import { collectFieldErrors, toActionError, type ActionResult } from '@/server/action-result'
import { ForbiddenError } from '@/server/auth/guard'

/**
 * Quản lý tổ chức và nhân sự là thao tác quản trị: chỉ `ADMIN`.
 * Kiểm ở server, không dựa vào việc ẩn nút trên giao diện.
 */
async function requireAdmin() {
  const { user, scope } = await requireScope()
  if (user.role !== 'ADMIN') {
    throw new ForbiddenError('Chỉ quản trị viên mới được thay đổi cơ cấu tổ chức và nhân sự.')
  }
  return { user, scope }
}

export async function saveDepartmentAction(raw: unknown): Promise<ActionResult> {
  const parsed = saveDepartmentSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, ...collectFieldErrors(parsed.error) }

  try {
    const { user } = await requireAdmin()
    await saveDepartment(parsed.data, user.id)
    revalidatePath('/hr')
    revalidatePath('/hr/departments')
    return { ok: true }
  } catch (error) {
    return { ok: false, error: toActionError(error) }
  }
}

export async function deactivateDepartmentAction(raw: unknown): Promise<ActionResult> {
  const parsed = deactivateSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, ...collectFieldErrors(parsed.error) }

  try {
    const { user } = await requireAdmin()
    await deactivateDepartment(parsed.data.id, user.id)
    revalidatePath('/hr/departments')
    return { ok: true }
  } catch (error) {
    return { ok: false, error: toActionError(error) }
  }
}

export async function savePositionAction(raw: unknown): Promise<ActionResult> {
  const parsed = savePositionSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, ...collectFieldErrors(parsed.error) }

  try {
    const { user } = await requireAdmin()
    await savePosition(parsed.data, user.id)
    revalidatePath('/hr/positions')
    return { ok: true }
  } catch (error) {
    return { ok: false, error: toActionError(error) }
  }
}

export async function saveUserAction(raw: unknown): Promise<ActionResult> {
  const parsed = saveUserSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, ...collectFieldErrors(parsed.error) }

  try {
    const { user } = await requireAdmin()
    await saveUser(parsed.data, user)
    revalidatePath('/hr/users')
    return { ok: true }
  } catch (error) {
    return { ok: false, error: toActionError(error) }
  }
}

export async function resetPasswordAction(raw: unknown): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, ...collectFieldErrors(parsed.error) }

  try {
    const { user } = await requireAdmin()
    await resetPassword(parsed.data.userId, parsed.data.password, user)
    revalidatePath('/hr/users')
    return { ok: true }
  } catch (error) {
    return { ok: false, error: toActionError(error) }
  }
}
