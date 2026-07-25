import { describe, expect, it } from 'vitest'
import {
  buildTree,
  directChildren,
  flattenTree,
  recomputeLevels,
  wouldCreateCycle,
  type TreeNode,
} from './tree'

/**
 *   COMPANY
 *   └── MARKETING
 *       ├── PERFORMANCE
 *       │   └── TEAM_ADS
 *       └── CONTENT
 */
const TREE: TreeNode[] = [
  { id: 'COMPANY', parentId: null },
  { id: 'MARKETING', parentId: 'COMPANY' },
  { id: 'PERFORMANCE', parentId: 'MARKETING' },
  { id: 'TEAM_ADS', parentId: 'PERFORMANCE' },
  { id: 'CONTENT', parentId: 'MARKETING' },
]

describe('wouldCreateCycle', () => {
  it('chặn đặt phòng ban làm cha của chính nó', () => {
    expect(wouldCreateCycle(TREE, 'MARKETING', 'MARKETING')).toBe(true)
  })

  it('chặn kéo phòng ban cha vào làm con của cháu nó', () => {
    expect(wouldCreateCycle(TREE, 'MARKETING', 'TEAM_ADS')).toBe(true)
  })

  it('chặn kéo cha vào làm con của con trực tiếp', () => {
    expect(wouldCreateCycle(TREE, 'PERFORMANCE', 'TEAM_ADS')).toBe(true)
  })

  it('cho phép chuyển sang nhánh khác', () => {
    expect(wouldCreateCycle(TREE, 'TEAM_ADS', 'CONTENT')).toBe(false)
  })

  it('cho phép đưa lên làm gốc', () => {
    expect(wouldCreateCycle(TREE, 'PERFORMANCE', null)).toBe(false)
  })

  it('không lặp vô hạn khi dữ liệu đã hỏng sẵn', () => {
    const broken: TreeNode[] = [
      { id: 'A', parentId: 'B' },
      { id: 'B', parentId: 'A' },
      { id: 'C', parentId: null },
    ]
    expect(wouldCreateCycle(broken, 'C', 'A')).toBe(true)
  })
})

describe('recomputeLevels', () => {
  it('tính lại level cho toàn bộ cây con, không chỉ node được chuyển', () => {
    // Chuyển PERFORMANCE lên làm con trực tiếp của COMPANY (level 1)
    const levels = recomputeLevels(TREE, 'PERFORMANCE', 1)
    expect(levels.get('PERFORMANCE')).toBe(1)
    expect(levels.get('TEAM_ADS')).toBe(2)
  })

  it('không đụng tới nhánh khác', () => {
    const levels = recomputeLevels(TREE, 'PERFORMANCE', 1)
    expect(levels.has('CONTENT')).toBe(false)
    expect(levels.has('MARKETING')).toBe(false)
  })

  it('tính đúng level cho cả cây từ gốc', () => {
    const levels = recomputeLevels(TREE, 'COMPANY', 0)
    expect(levels.get('COMPANY')).toBe(0)
    expect(levels.get('MARKETING')).toBe(1)
    expect(levels.get('PERFORMANCE')).toBe(2)
    expect(levels.get('TEAM_ADS')).toBe(3)
  })
})

describe('directChildren', () => {
  it('chỉ lấy con trực tiếp, không lấy cháu', () => {
    expect(directChildren(TREE, 'MARKETING').sort()).toEqual(['CONTENT', 'PERFORMANCE'])
    expect(directChildren(TREE, 'MARKETING')).not.toContain('TEAM_ADS')
  })

  it('trả rỗng cho node lá', () => {
    expect(directChildren(TREE, 'TEAM_ADS')).toEqual([])
  })
})

describe('buildTree và flattenTree', () => {
  it('dựng đúng cấu trúc phân cấp', () => {
    const tree = buildTree(TREE)
    expect(tree).toHaveLength(1)
    expect(tree[0]?.node.id).toBe('COMPANY')
    expect(tree[0]?.children[0]?.node.id).toBe('MARKETING')
  })

  it('duyệt phẳng giữ đúng thứ tự và độ sâu', () => {
    const flat = flattenTree(buildTree(TREE))
    expect(flat.map((f) => `${f.depth}:${f.node.id}`)).toEqual([
      '0:COMPANY',
      '1:MARKETING',
      '2:PERFORMANCE',
      '3:TEAM_ADS',
      '2:CONTENT',
    ])
  })

  it('node có cha không tồn tại vẫn hiện ra, không bị mất', () => {
    const orphaned: TreeNode[] = [
      { id: 'A', parentId: null },
      { id: 'B', parentId: 'KHONG_TON_TAI' },
    ]
    const flat = flattenTree(buildTree(orphaned))
    expect(flat.map((f) => f.node.id).sort()).toEqual(['A', 'B'])
  })
})
