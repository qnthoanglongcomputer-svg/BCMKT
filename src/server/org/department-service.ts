import { prisma } from '@/lib/prisma'
import { logAudit } from '@/server/audit/log'
import { buildTree, flattenTree, recomputeLevels, wouldCreateCycle } from './tree'
import type { SaveDepartmentInput } from './schemas'
import type { Scope } from '@/server/auth/scope'

export class DepartmentServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DepartmentServiceError'
  }
}

export interface DepartmentRow {
  id: string
  code: string
  name: string
  parentId: string | null
  level: number
  depth: number
  userCount: number
  positionCount: number
  childCount: number
}

/** Danh sách phòng ban dạng cây phẳng, đã lọc theo phạm vi. */
export async function listDepartments(scope: Scope): Promise<DepartmentRow[]> {
  const departments = await prisma.department.findMany({
    where: {
      deletedAt: null,
      ...(scope.departmentIds === null ? {} : { id: { in: scope.departmentIds } }),
    },
    select: {
      id: true,
      code: true,
      name: true,
      parentId: true,
      level: true,
      sortOrder: true,
      _count: { select: { users: true, positions: true, children: true } },
    },
    orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  })

  const flat = flattenTree(buildTree(departments))
  return flat.map(({ node, depth }) => ({
    id: node.id,
    code: node.code,
    name: node.name,
    parentId: node.parentId,
    level: node.level,
    depth,
    userCount: node._count.users,
    positionCount: node._count.positions,
    childCount: node._count.children,
  }))
}

export async function saveDepartment(
  input: SaveDepartmentInput,
  actorId: string,
): Promise<{ id: string }> {
  const all = await prisma.department.findMany({
    where: { deletedAt: null },
    select: { id: true, parentId: true, level: true, code: true },
  })

  const existing = input.id ? all.find((d) => d.id === input.id) : undefined
  if (input.id && !existing) {
    throw new DepartmentServiceError('Không tìm thấy phòng ban cần sửa.')
  }

  // Mã là khoá tra cứu của dashboard chuyên biệt — đổi mã sẽ làm hỏng chúng.
  if (existing && existing.code !== input.code) {
    throw new DepartmentServiceError(
      `Không được đổi mã phòng ban sau khi tạo (hiện tại: ${existing.code}). ` +
        'Mã này được các màn hình chuyên biệt dùng để tra cứu.',
    )
  }

  const duplicate = all.find((d) => d.code === input.code && d.id !== input.id)
  if (duplicate) {
    throw new DepartmentServiceError(`Mã ${input.code} đã được dùng cho phòng ban khác.`)
  }

  if (input.parentId) {
    const parent = all.find((d) => d.id === input.parentId)
    if (!parent) {
      throw new DepartmentServiceError('Phòng ban cha không tồn tại hoặc đã bị vô hiệu hoá.')
    }
  }

  if (existing && wouldCreateCycle(all, existing.id, input.parentId)) {
    throw new DepartmentServiceError(
      'Không thể đặt phòng ban này làm con của chính nó hoặc của cấp dưới nó — sẽ tạo vòng lặp trong cây tổ chức.',
    )
  }

  const parentLevel = input.parentId
    ? (all.find((d) => d.id === input.parentId)?.level ?? 0)
    : -1
  const newLevel = parentLevel + 1

  return prisma.$transaction(async (tx) => {
    const department = existing
      ? await tx.department.update({
          where: { id: existing.id },
          data: {
            name: input.name,
            parentId: input.parentId,
            level: newLevel,
            sortOrder: input.sortOrder,
            updatedBy: actorId,
          },
        })
      : await tx.department.create({
          data: {
            code: input.code,
            name: input.name,
            parentId: input.parentId,
            level: newLevel,
            sortOrder: input.sortOrder,
            createdBy: actorId,
            updatedBy: actorId,
          },
        })

    // Đổi cha làm lệch level của cả cây con — phải tính lại, không chỉ node này.
    if (existing && existing.parentId !== input.parentId) {
      const updated = all.map((d) =>
        d.id === department.id ? { ...d, parentId: input.parentId } : d,
      )
      const levels = recomputeLevels(updated, department.id, newLevel)
      for (const [id, level] of levels) {
        if (id === department.id) continue
        await tx.department.update({ where: { id }, data: { level } })
      }
    }

    await logAudit(tx, {
      actorId,
      action: existing ? 'UPDATE' : 'CREATE',
      entityType: 'department',
      entityId: department.id,
      changes: existing
        ? [
            { field: 'name', oldValue: null, newValue: input.name },
            { field: 'parentId', oldValue: existing.parentId, newValue: input.parentId },
          ]
        : [{ field: 'code', oldValue: null, newValue: input.code }],
    })

    return { id: department.id }
  })
}

/**
 * Vô hiệu hoá (soft delete). Chặn khi còn nhân sự hoặc phòng ban con đang hoạt
 * động — xoá phòng ban còn người sẽ làm dữ liệu KPI mồ côi.
 */
export async function deactivateDepartment(id: string, actorId: string): Promise<void> {
  const department = await prisma.department.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      deletedAt: true,
      _count: { select: { users: true, children: true } },
    },
  })

  if (!department || department.deletedAt) {
    throw new DepartmentServiceError('Phòng ban không tồn tại hoặc đã bị vô hiệu hoá.')
  }

  const activeUsers = await prisma.user.count({ where: { departmentId: id, deletedAt: null } })
  if (activeUsers > 0) {
    throw new DepartmentServiceError(
      `Phòng ban "${department.name}" còn ${activeUsers} nhân sự đang hoạt động. ` +
        'Chuyển họ sang phòng ban khác trước khi vô hiệu hoá.',
    )
  }

  const activeChildren = await prisma.department.count({
    where: { parentId: id, deletedAt: null },
  })
  if (activeChildren > 0) {
    throw new DepartmentServiceError(
      `Phòng ban "${department.name}" còn ${activeChildren} phòng ban con đang hoạt động. ` +
        'Vô hiệu hoá các phòng ban con trước.',
    )
  }

  await prisma.$transaction(async (tx) => {
    await tx.department.update({ where: { id }, data: { deletedAt: new Date(), updatedBy: actorId } })
    await logAudit(tx, {
      actorId,
      action: 'DELETE',
      entityType: 'department',
      entityId: id,
      changes: [{ field: 'deletedAt', oldValue: null, newValue: new Date().toISOString() }],
    })
  })
}
