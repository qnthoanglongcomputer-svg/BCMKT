import { prisma } from '@/lib/prisma'
import { logAudit } from '@/server/audit/log'
import { hashPassword, validatePasswordStrength } from '@/server/auth/password'
import type { Scope, SessionUser } from '@/server/auth/scope'
import type { SavePositionInput, SaveUserInput } from './schemas'

export class UserServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserServiceError'
  }
}

export interface UserRow {
  id: string
  email: string
  fullName: string
  role: string
  departmentName: string | null
  positionName: string | null
  isActive: boolean
}

export async function listUsers(scope: Scope): Promise<UserRow[]> {
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      ...(scope.departmentIds === null
        ? {}
        : { departmentId: { in: scope.departmentIds } }),
      // EMPLOYEE chỉ thấy chính mình.
      ...(scope.userIds === null ? {} : { id: { in: scope.userIds } }),
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
      department: { select: { name: true } },
      position: { select: { name: true } },
    },
    orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
  })

  return users.map((u) => ({
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    departmentName: u.department?.name ?? null,
    positionName: u.position?.name ?? null,
    isActive: u.isActive,
  }))
}

export async function getUserFormOptions(scope: Scope) {
  const [departments, positions] = await Promise.all([
    prisma.department.findMany({
      where: {
        deletedAt: null,
        ...(scope.departmentIds === null ? {} : { id: { in: scope.departmentIds } }),
      },
      select: { id: true, name: true, level: true },
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
    }),
    prisma.position.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, departmentId: true, department: { select: { name: true } } },
      orderBy: { name: 'asc' },
    }),
  ])
  return { departments, positions }
}

export async function getUser(id: string, scope: Scope) {
  const user = await prisma.user.findFirst({
    where: {
      id,
      deletedAt: null,
      ...(scope.departmentIds === null ? {} : { departmentId: { in: scope.departmentIds } }),
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      departmentId: true,
      positionId: true,
      isActive: true,
    },
  })
  return user
}

/**
 * Tạo hoặc sửa người dùng.
 *
 * Mật khẩu chỉ được đặt khi tạo mới — đổi mật khẩu người khác đi qua
 * `resetPassword` để tách bạch trong audit log.
 */
export async function saveUser(
  input: SaveUserInput,
  actor: SessionUser,
): Promise<{ id: string }> {
  const existing = input.id
    ? await prisma.user.findUnique({
        where: { id: input.id },
        select: { id: true, email: true, role: true, departmentId: true, isActive: true },
      })
    : null

  if (input.id && !existing) {
    throw new UserServiceError('Không tìm thấy người dùng cần sửa.')
  }

  const duplicate = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  })
  if (duplicate && duplicate.id !== input.id) {
    throw new UserServiceError(`Email ${input.email} đã được dùng cho tài khoản khác.`)
  }

  // Không cho tự hạ quyền hoặc tự vô hiệu hoá chính mình: dễ tự khoá mình ra
  // khỏi hệ thống khi đây là admin duy nhất.
  if (existing && existing.id === actor.id) {
    if (input.role !== existing.role) {
      throw new UserServiceError('Không thể tự đổi vai trò của chính mình.')
    }
    if (!input.isActive) {
      throw new UserServiceError('Không thể tự vô hiệu hoá tài khoản của chính mình.')
    }
  }

  // Hạ cấp hoặc vô hiệu hoá admin cuối cùng sẽ khoá cả hệ thống.
  if (existing?.role === 'ADMIN' && (input.role !== 'ADMIN' || !input.isActive)) {
    const otherAdmins = await prisma.user.count({
      where: { role: 'ADMIN', isActive: true, deletedAt: null, id: { not: existing.id } },
    })
    if (otherAdmins === 0) {
      throw new UserServiceError(
        'Đây là quản trị viên đang hoạt động duy nhất. Tạo quản trị viên khác trước khi thay đổi tài khoản này.',
      )
    }
  }

  let passwordHash: string | undefined
  if (!existing) {
    if (!input.password) {
      throw new UserServiceError('Chưa nhập mật khẩu cho tài khoản mới.')
    }
    const weak = validatePasswordStrength(input.password)
    if (weak) throw new UserServiceError(weak)
    passwordHash = await hashPassword(input.password)
  }

  return prisma.$transaction(async (tx) => {
    const user = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: {
            email: input.email,
            fullName: input.fullName,
            role: input.role,
            departmentId: input.departmentId,
            positionId: input.positionId,
            isActive: input.isActive,
            updatedBy: actor.id,
          },
        })
      : await tx.user.create({
          data: {
            email: input.email,
            fullName: input.fullName,
            role: input.role,
            departmentId: input.departmentId,
            positionId: input.positionId,
            isActive: input.isActive,
            passwordHash: passwordHash as string,
            createdBy: actor.id,
            updatedBy: actor.id,
          },
        })

    // Không bao giờ ghi mật khẩu hay hash vào audit log.
    await logAudit(tx, {
      actorId: actor.id,
      action: existing ? 'UPDATE' : 'CREATE',
      entityType: 'user',
      entityId: user.id,
      changes: existing
        ? [
            { field: 'email', oldValue: existing.email, newValue: input.email },
            { field: 'role', oldValue: existing.role, newValue: input.role },
            { field: 'departmentId', oldValue: existing.departmentId, newValue: input.departmentId },
            { field: 'isActive', oldValue: String(existing.isActive), newValue: String(input.isActive) },
          ]
        : [
            { field: 'email', oldValue: null, newValue: input.email },
            { field: 'role', oldValue: null, newValue: input.role },
          ],
    })

    return { id: user.id }
  })
}

/** Đặt lại mật khẩu. Ghi audit sự kiện, **không ghi giá trị mật khẩu**. */
export async function resetPassword(
  userId: string,
  password: string,
  actor: SessionUser,
): Promise<void> {
  const weak = validatePasswordStrength(password)
  if (weak) throw new UserServiceError(weak)

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
  if (!user) throw new UserServiceError('Không tìm thấy người dùng.')

  const passwordHash = await hashPassword(password)

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash, updatedBy: actor.id } })
    await logAudit(tx, {
      actorId: actor.id,
      action: 'UPDATE',
      entityType: 'user',
      entityId: userId,
      changes: [{ field: 'password', oldValue: null, newValue: '(đã đặt lại)' }],
    })
  })
}

// ─────────────────────────────────────────────────────────────
// Vị trí công việc
// ─────────────────────────────────────────────────────────────

export interface PositionRow {
  id: string
  code: string
  name: string
  departmentName: string
  userCount: number
}

export async function listPositions(scope: Scope): Promise<PositionRow[]> {
  const positions = await prisma.position.findMany({
    where: {
      deletedAt: null,
      ...(scope.departmentIds === null
        ? {}
        : { departmentId: { in: scope.departmentIds } }),
    },
    select: {
      id: true,
      code: true,
      name: true,
      department: { select: { name: true } },
      _count: { select: { users: true } },
    },
    orderBy: { name: 'asc' },
  })

  return positions.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    departmentName: p.department.name,
    userCount: p._count.users,
  }))
}

export async function savePosition(
  input: SavePositionInput,
  actorId: string,
): Promise<{ id: string }> {
  const existing = input.id
    ? await prisma.position.findUnique({
        where: { id: input.id },
        select: { id: true, code: true },
      })
    : null

  if (input.id && !existing) {
    throw new UserServiceError('Không tìm thấy vị trí cần sửa.')
  }
  if (existing && existing.code !== input.code) {
    throw new UserServiceError(`Không được đổi mã vị trí sau khi tạo (hiện tại: ${existing.code}).`)
  }

  const duplicate = await prisma.position.findUnique({
    where: { code: input.code },
    select: { id: true },
  })
  if (duplicate && duplicate.id !== input.id) {
    throw new UserServiceError(`Mã ${input.code} đã được dùng cho vị trí khác.`)
  }

  const department = await prisma.department.findFirst({
    where: { id: input.departmentId, deletedAt: null },
    select: { id: true },
  })
  if (!department) {
    throw new UserServiceError('Phòng ban không tồn tại hoặc đã bị vô hiệu hoá.')
  }

  return prisma.$transaction(async (tx) => {
    const position = existing
      ? await tx.position.update({
          where: { id: existing.id },
          data: { name: input.name, departmentId: input.departmentId, updatedBy: actorId },
        })
      : await tx.position.create({
          data: {
            code: input.code,
            name: input.name,
            departmentId: input.departmentId,
            createdBy: actorId,
            updatedBy: actorId,
          },
        })

    await logAudit(tx, {
      actorId,
      action: existing ? 'UPDATE' : 'CREATE',
      entityType: 'position',
      entityId: position.id,
      changes: [{ field: 'name', oldValue: null, newValue: input.name }],
    })

    return { id: position.id }
  })
}
