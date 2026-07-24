import { prisma } from '@/lib/prisma'

/**
 * Phạm vi dữ liệu một người dùng được phép đọc.
 *
 * **Mọi truy vấn dữ liệu nghiệp vụ phải đi qua đây.** Query Prisma đọc
 * `kpi_*`, `reports`, `users` mà không áp scope là lỗ hổng bảo mật.
 */

export type Role = 'ADMIN' | 'MARKETING_MANAGER' | 'LEADER' | 'EMPLOYEE'

export interface SessionUser {
  id: string
  role: Role
  departmentId: string | null
}

export interface Scope {
  /** Danh sách department_id được phép đọc. `null` = toàn bộ hệ thống. */
  departmentIds: string[] | null
  /** Danh sách user_id được phép đọc. `null` = mọi user trong departmentIds. */
  userIds: string[] | null
  /** Được duyệt báo cáo của người khác hay không */
  canApprove: boolean
  /** Được sửa cấu hình KPI, trọng số, tổ chức hay không */
  canManageKpi: boolean
}

/** Một node trong cây phòng ban, đủ để tính subtree. */
export interface DepartmentNode {
  id: string
  parentId: string | null
}

/** Mã phòng ban gốc của khối Marketing — Manager thấy toàn bộ subtree này. */
export const MARKETING_ROOT_CODE = 'MARKETING'

/**
 * Tính toàn bộ subtree (bao gồm chính nó) của một phòng ban.
 *
 * Hàm thuần để test được. Cây phòng ban chỉ vài chục node nên nạp cả cây trong
 * **một** truy vấn rồi duyệt trong bộ nhớ — không phải N+1, và đơn giản hơn
 * recursive CTE nhiều.
 */
export function collectSubtree(nodes: DepartmentNode[], rootId: string): string[] {
  const childrenByParent = new Map<string, string[]>()
  for (const node of nodes) {
    if (node.parentId === null) continue
    const siblings = childrenByParent.get(node.parentId)
    if (siblings) siblings.push(node.id)
    else childrenByParent.set(node.parentId, [node.id])
  }

  const result: string[] = []
  const seen = new Set<string>()
  const stack = [rootId]

  while (stack.length > 0) {
    const current = stack.pop() as string
    // Chặn vòng lặp: dữ liệu hỏng không được làm treo tiến trình.
    if (seen.has(current)) continue
    seen.add(current)
    result.push(current)

    const children = childrenByParent.get(current)
    if (children) stack.push(...children)
  }

  return result
}

/**
 * Phần thuần của việc phân giải phạm vi: nhận cây phòng ban đã nạp sẵn,
 * trả về phạm vi. Tách ra để test được mà không cần database.
 */
export function computeScope(
  user: SessionUser,
  nodes: DepartmentNode[],
  marketingRootId: string | null,
): Scope {
  switch (user.role) {
    case 'ADMIN':
      return { departmentIds: null, userIds: null, canApprove: true, canManageKpi: true }

    case 'MARKETING_MANAGER':
      return {
        // Không tìm thấy gốc Marketing thì phạm vi rỗng, không mở toàn hệ thống.
        departmentIds: marketingRootId ? collectSubtree(nodes, marketingRootId) : [],
        userIds: null,
        canApprove: true,
        canManageKpi: false,
      }

    case 'LEADER':
      return {
        // Leader chưa được gán phòng ban chỉ thấy dữ liệu của chính mình.
        departmentIds: user.departmentId ? collectSubtree(nodes, user.departmentId) : [],
        userIds: null,
        canApprove: true,
        canManageKpi: false,
      }

    case 'EMPLOYEE':
      return {
        departmentIds: user.departmentId ? [user.departmentId] : [],
        userIds: [user.id],
        canApprove: false,
        canManageKpi: false,
      }
  }
}

/** Nạp cây phòng ban rồi tính phạm vi. Một truy vấn cho cả cây. */
export async function resolveScope(user: SessionUser): Promise<Scope> {
  if (user.role === 'ADMIN') {
    return { departmentIds: null, userIds: null, canApprove: true, canManageKpi: true }
  }

  const departments = await prisma.department.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true, parentId: true },
  })

  const marketingRoot = departments.find((d) => d.code === MARKETING_ROOT_CODE)
  return computeScope(user, departments, marketingRoot?.id ?? null)
}

/** Phạm vi cho phép đọc phòng ban này không? */
export function isDepartmentInScope(scope: Scope, departmentId: string): boolean {
  if (scope.departmentIds === null) return true
  return scope.departmentIds.includes(departmentId)
}

/** Phạm vi cho phép đọc dữ liệu của người này không? */
export function isUserInScope(scope: Scope, userId: string): boolean {
  if (scope.userIds === null) return true
  return scope.userIds.includes(userId)
}

/**
 * Mệnh đề `where` cho các bảng KPI có `ownerType`/`ownerId`.
 *
 * Trả `undefined` khi phạm vi là toàn hệ thống — gộp thẳng vào `where` được.
 * Trả điều kiện không bao giờ khớp khi phạm vi rỗng, để không lộ dữ liệu.
 */
export function scopedOwnerFilter(scope: Scope) {
  if (scope.departmentIds === null) return {}
  if (scope.departmentIds.length === 0) return { ownerId: { in: [] as string[] } }

  // EMPLOYEE: chỉ dữ liệu cá nhân, không phải cả phòng ban.
  if (scope.userIds !== null) {
    return { ownerId: { in: [...scope.departmentIds, ...scope.userIds] } }
  }
  return { ownerId: { in: scope.departmentIds } }
}
