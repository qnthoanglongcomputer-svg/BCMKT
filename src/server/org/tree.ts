/**
 * Phép toán thuần trên cây phòng ban. Tách khỏi tầng truy vấn để test được
 * mà không cần database — đây là chỗ sai sẽ làm hỏng cả cơ cấu tổ chức.
 */

export interface TreeNode {
  id: string
  parentId: string | null
}

export class OrgTreeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OrgTreeError'
  }
}

/**
 * Đặt `nodeId` làm con của `newParentId` có tạo ra vòng lặp không?
 *
 * Vòng lặp xảy ra khi cha mới nằm trong chính cây con của node đang chuyển —
 * ví dụ kéo phòng ban cha vào làm con của phòng ban con của nó.
 */
export function wouldCreateCycle(
  nodes: TreeNode[],
  nodeId: string,
  newParentId: string | null,
): boolean {
  if (newParentId === null) return false
  if (newParentId === nodeId) return true

  const parentById = new Map(nodes.map((n) => [n.id, n.parentId]))

  // Đi ngược từ cha mới lên gốc: gặp lại chính node đang chuyển là có vòng lặp.
  let current: string | null = newParentId
  const visited = new Set<string>()

  while (current !== null) {
    if (current === nodeId) return true
    // Dữ liệu đã hỏng sẵn từ trước — dừng lại thay vì lặp vô hạn.
    if (visited.has(current)) return true
    visited.add(current)
    current = parentById.get(current) ?? null
  }

  return false
}

/**
 * Tính lại `level` cho một node và toàn bộ cây con của nó sau khi đổi cha.
 * Trả về map `id -> level` chỉ chứa các node bị ảnh hưởng.
 */
export function recomputeLevels(
  nodes: TreeNode[],
  rootId: string,
  rootLevel: number,
): Map<string, number> {
  const childrenByParent = new Map<string, string[]>()
  for (const node of nodes) {
    if (node.parentId === null) continue
    const list = childrenByParent.get(node.parentId)
    if (list) list.push(node.id)
    else childrenByParent.set(node.parentId, [node.id])
  }

  const levels = new Map<string, number>()
  const stack: Array<{ id: string; level: number }> = [{ id: rootId, level: rootLevel }]

  while (stack.length > 0) {
    const current = stack.pop() as { id: string; level: number }
    if (levels.has(current.id)) continue
    levels.set(current.id, current.level)

    for (const childId of childrenByParent.get(current.id) ?? []) {
      stack.push({ id: childId, level: current.level + 1 })
    }
  }

  return levels
}

/** Con trực tiếp của một node. */
export function directChildren(nodes: TreeNode[], parentId: string): string[] {
  return nodes.filter((n) => n.parentId === parentId).map((n) => n.id)
}

export interface TreeItem<T> {
  node: T
  depth: number
  children: Array<TreeItem<T>>
}

/**
 * Dựng cây lồng nhau từ danh sách phẳng, để render menu/bảng phân cấp.
 * Node có cha không tồn tại (dữ liệu lỗi) được coi như node gốc thay vì bị mất.
 */
export function buildTree<T extends TreeNode>(nodes: T[]): Array<TreeItem<T>> {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const childrenByParent = new Map<string, T[]>()
  const roots: T[] = []

  for (const node of nodes) {
    if (node.parentId === null || !byId.has(node.parentId)) {
      roots.push(node)
      continue
    }
    const list = childrenByParent.get(node.parentId)
    if (list) list.push(node)
    else childrenByParent.set(node.parentId, [node])
  }

  const seen = new Set<string>()
  const build = (node: T, depth: number): TreeItem<T> => {
    seen.add(node.id)
    return {
      node,
      depth,
      children: (childrenByParent.get(node.id) ?? [])
        .filter((child) => !seen.has(child.id))
        .map((child) => build(child, depth + 1)),
    }
  }

  return roots.map((root) => build(root, 0))
}

/** Duyệt cây thành danh sách phẳng kèm độ sâu, giữ đúng thứ tự hiển thị. */
export function flattenTree<T extends TreeNode>(
  items: Array<TreeItem<T>>,
): Array<{ node: T; depth: number }> {
  const result: Array<{ node: T; depth: number }> = []
  const walk = (list: Array<TreeItem<T>>) => {
    for (const item of list) {
      result.push({ node: item.node, depth: item.depth })
      walk(item.children)
    }
  }
  walk(items)
  return result
}
