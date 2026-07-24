import { describe, expect, it } from 'vitest'
import {
  collectSubtree,
  computeScope,
  isDepartmentInScope,
  isUserInScope,
  scopedOwnerFilter,
  type DepartmentNode,
  type SessionUser,
} from './scope'

/**
 * Cây phòng ban 4 tầng, giống cơ cấu thật:
 *
 *   COMPANY
 *   └── MARKETING
 *       ├── PERFORMANCE
 *       │   ├── TEAM_ADS
 *       │   └── TEAM_CREATIVE
 *       ├── CONTENT
 *       └── TRADE
 *   └── SALES            (ngoài Marketing — dùng để phát hiện rò rỉ)
 */
const TREE: DepartmentNode[] = [
  { id: 'COMPANY', parentId: null },
  { id: 'MARKETING', parentId: 'COMPANY' },
  { id: 'PERFORMANCE', parentId: 'MARKETING' },
  { id: 'TEAM_ADS', parentId: 'PERFORMANCE' },
  { id: 'TEAM_CREATIVE', parentId: 'PERFORMANCE' },
  { id: 'CONTENT', parentId: 'MARKETING' },
  { id: 'TRADE', parentId: 'MARKETING' },
  { id: 'SALES', parentId: 'COMPANY' },
]

const MARKETING_ID = 'MARKETING'

function user(role: SessionUser['role'], departmentId: string | null, id = 'u1'): SessionUser {
  return { id, role, departmentId }
}

describe('collectSubtree', () => {
  it('lấy đệ quy toàn bộ cây con, không chỉ con trực tiếp', () => {
    expect(collectSubtree(TREE, 'PERFORMANCE').sort()).toEqual(
      ['PERFORMANCE', 'TEAM_ADS', 'TEAM_CREATIVE'].sort(),
    )
  })

  it('bao gồm chính node gốc', () => {
    expect(collectSubtree(TREE, 'TEAM_ADS')).toEqual(['TEAM_ADS'])
  })

  it('không lấy nhánh anh em', () => {
    const subtree = collectSubtree(TREE, 'CONTENT')
    expect(subtree).not.toContain('PERFORMANCE')
    expect(subtree).not.toContain('SALES')
  })

  it('không treo khi dữ liệu cây bị vòng lặp', () => {
    const broken: DepartmentNode[] = [
      { id: 'A', parentId: 'B' },
      { id: 'B', parentId: 'A' },
    ]
    expect(collectSubtree(broken, 'A').sort()).toEqual(['A', 'B'])
  })

  it('trả về chính nó khi phòng ban không có con', () => {
    expect(collectSubtree(TREE, 'SALES')).toEqual(['SALES'])
  })
})

describe('computeScope — ADMIN', () => {
  const scope = computeScope(user('ADMIN', null), TREE, MARKETING_ID)

  it('thấy toàn hệ thống', () => {
    expect(scope.departmentIds).toBeNull()
    expect(scope.userIds).toBeNull()
  })

  it('được duyệt và được quản trị KPI', () => {
    expect(scope.canApprove).toBe(true)
    expect(scope.canManageKpi).toBe(true)
  })
})

describe('computeScope — MARKETING_MANAGER', () => {
  const scope = computeScope(user('MARKETING_MANAGER', 'MARKETING'), TREE, MARKETING_ID)

  it('thấy toàn bộ subtree Marketing', () => {
    expect(scope.departmentIds?.sort()).toEqual(
      ['MARKETING', 'PERFORMANCE', 'TEAM_ADS', 'TEAM_CREATIVE', 'CONTENT', 'TRADE'].sort(),
    )
  })

  it('KHÔNG thấy phòng ban ngoài Marketing', () => {
    expect(scope.departmentIds).not.toContain('SALES')
    expect(scope.departmentIds).not.toContain('COMPANY')
  })

  it('được duyệt nhưng không được sửa cấu hình KPI', () => {
    expect(scope.canApprove).toBe(true)
    expect(scope.canManageKpi).toBe(false)
  })

  it('không tìm thấy gốc Marketing thì phạm vi rỗng, không mở toàn hệ thống', () => {
    const broken = computeScope(user('MARKETING_MANAGER', 'MARKETING'), TREE, null)
    expect(broken.departmentIds).toEqual([])
  })
})

describe('computeScope — LEADER', () => {
  const scope = computeScope(user('LEADER', 'PERFORMANCE'), TREE, MARKETING_ID)

  it('thấy subtree đệ quy của phòng ban mình, không chỉ phòng ban trực tiếp', () => {
    expect(scope.departmentIds?.sort()).toEqual(
      ['PERFORMANCE', 'TEAM_ADS', 'TEAM_CREATIVE'].sort(),
    )
  })

  it('KHÔNG thấy phòng ban ngang hàng', () => {
    expect(scope.departmentIds).not.toContain('CONTENT')
    expect(scope.departmentIds).not.toContain('TRADE')
  })

  it('KHÔNG thấy phòng ban cấp trên', () => {
    expect(scope.departmentIds).not.toContain('MARKETING')
  })

  it('leader chưa được gán phòng ban thì phạm vi rỗng', () => {
    const orphan = computeScope(user('LEADER', null), TREE, MARKETING_ID)
    expect(orphan.departmentIds).toEqual([])
  })

  it('không được sửa cấu hình KPI', () => {
    expect(scope.canManageKpi).toBe(false)
  })
})

describe('computeScope — EMPLOYEE', () => {
  const scope = computeScope(user('EMPLOYEE', 'TEAM_ADS', 'nhan-vien-a'), TREE, MARKETING_ID)

  it('chỉ thấy phòng ban trực tiếp của mình', () => {
    expect(scope.departmentIds).toEqual(['TEAM_ADS'])
  })

  it('chỉ thấy dữ liệu của chính mình', () => {
    expect(scope.userIds).toEqual(['nhan-vien-a'])
  })

  it('KHÔNG thấy dữ liệu người khác cùng phòng', () => {
    expect(isUserInScope(scope, 'nhan-vien-b')).toBe(false)
    expect(isUserInScope(scope, 'nhan-vien-a')).toBe(true)
  })

  it('không được duyệt báo cáo', () => {
    expect(scope.canApprove).toBe(false)
  })
})

describe('isDepartmentInScope — chặn sửa tham số URL', () => {
  it('Leader Performance đổi dept sang Content bị chặn', () => {
    const scope = computeScope(user('LEADER', 'PERFORMANCE'), TREE, MARKETING_ID)
    expect(isDepartmentInScope(scope, 'CONTENT')).toBe(false)
    expect(isDepartmentInScope(scope, 'TEAM_ADS')).toBe(true)
  })

  it('Manager đổi dept sang phòng ngoài Marketing bị chặn', () => {
    const scope = computeScope(user('MARKETING_MANAGER', 'MARKETING'), TREE, MARKETING_ID)
    expect(isDepartmentInScope(scope, 'SALES')).toBe(false)
  })

  it('Admin không bị chặn', () => {
    const scope = computeScope(user('ADMIN', null), TREE, MARKETING_ID)
    expect(isDepartmentInScope(scope, 'SALES')).toBe(true)
  })
})

describe('scopedOwnerFilter', () => {
  it('Admin không thêm điều kiện lọc', () => {
    const scope = computeScope(user('ADMIN', null), TREE, MARKETING_ID)
    expect(scopedOwnerFilter(scope)).toEqual({})
  })

  it('Leader lọc theo subtree', () => {
    const scope = computeScope(user('LEADER', 'PERFORMANCE'), TREE, MARKETING_ID)
    const filter = scopedOwnerFilter(scope) as { ownerId: { in: string[] } }
    expect(filter.ownerId.in.sort()).toEqual(['PERFORMANCE', 'TEAM_ADS', 'TEAM_CREATIVE'].sort())
  })

  it('Employee lọc theo cả phòng ban lẫn chính mình', () => {
    const scope = computeScope(user('EMPLOYEE', 'TEAM_ADS', 'nv-a'), TREE, MARKETING_ID)
    const filter = scopedOwnerFilter(scope) as { ownerId: { in: string[] } }
    expect(filter.ownerId.in.sort()).toEqual(['TEAM_ADS', 'nv-a'].sort())
  })

  it('phạm vi rỗng trả về điều kiện không khớp gì, không phải điều kiện rỗng', () => {
    const scope = computeScope(user('LEADER', null), TREE, MARKETING_ID)
    expect(scopedOwnerFilter(scope)).toEqual({ ownerId: { in: [] } })
  })
})
