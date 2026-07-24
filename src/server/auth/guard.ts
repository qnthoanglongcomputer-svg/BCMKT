import { auth } from './config'
import { isDepartmentInScope, isUserInScope, resolveScope, type Role, type Scope, type SessionUser } from './scope'

/**
 * Kiểm quyền ở **server**. Ẩn menu hay disable nút ở UI chỉ là trải nghiệm,
 * không phải bảo mật — mọi route handler và server action đều phải tự kiểm.
 */

export class UnauthorizedError extends Error {
  constructor(message = 'Bạn cần đăng nhập để tiếp tục.') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Bạn không có quyền thực hiện thao tác này.') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

/** Người dùng hiện tại, hoặc null khi chưa đăng nhập. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth()
  if (!session?.user?.id) return null
  return {
    id: session.user.id,
    role: session.user.role,
    departmentId: session.user.departmentId,
  }
}

/** Bắt buộc đã đăng nhập. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) throw new UnauthorizedError()
  return user
}

/** Bắt buộc đã đăng nhập và thuộc một trong các vai trò cho phép. */
export async function requireRole(roles: readonly Role[]): Promise<SessionUser> {
  const user = await requireUser()
  if (!roles.includes(user.role)) throw new ForbiddenError()
  return user
}

/** Lấy người dùng kèm phạm vi dữ liệu — dùng ở mọi màn hình đọc dữ liệu. */
export async function requireScope(): Promise<{ user: SessionUser; scope: Scope }> {
  const user = await requireUser()
  const scope = await resolveScope(user)
  return { user, scope }
}

/**
 * Chặn truy cập phòng ban ngoài phạm vi.
 *
 * Ném `ForbiddenError`; **route đọc dữ liệu nên bắt lỗi này và trả 404**
 * thay vì 403, để không tiết lộ phòng ban đó có tồn tại hay không.
 */
export function assertDepartmentInScope(scope: Scope, departmentId: string): void {
  if (!isDepartmentInScope(scope, departmentId)) {
    throw new ForbiddenError('Bạn không có quyền xem dữ liệu của bộ phận này.')
  }
}

export function assertUserInScope(scope: Scope, userId: string): void {
  if (!isUserInScope(scope, userId)) {
    throw new ForbiddenError('Bạn không có quyền xem dữ liệu của nhân sự này.')
  }
}

/** Bắt buộc có quyền quản trị KPI (hiện tại: chỉ ADMIN). */
export function assertCanManageKpi(scope: Scope): void {
  if (!scope.canManageKpi) {
    throw new ForbiddenError('Chỉ quản trị viên mới được thay đổi cấu hình KPI.')
  }
}
