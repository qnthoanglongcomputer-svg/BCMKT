import type { AuditAction, Prisma } from '@prisma/client'

/**
 * Đường **duy nhất** ghi nhật ký hệ thống. Không viết trực tiếp vào bảng
 * `audit_log` ở bất kỳ nơi nào khác.
 *
 * Nhận `tx` làm tham số bắt buộc: audit phải ghi trong **cùng transaction** với
 * thay đổi dữ liệu gây ra nó. Transaction rollback thì audit cũng rollback —
 * không ghi lại việc chưa xảy ra.
 *
 * Bảng này **chỉ append**. Không có hàm update/delete ở đây, và không được
 * thêm — kể cả cho ADMIN.
 */

export interface AuditChange {
  field: string
  oldValue: string | null
  newValue: string | null
}

export interface AuditEntry {
  /** null cho hành động của hệ thống (cron rollup, sync ads) */
  actorId: string | null
  action: AuditAction
  /** Tên bảng nghiệp vụ: 'kpi_plan', 'report', 'user', … */
  entityType: string
  entityId: string
  changes?: AuditChange[]
  ipAddress?: string | null
  userAgent?: string | null
}

/** Giá trị dài hơn ngưỡng này bị cắt để không làm phình bảng. */
const MAX_VALUE_LENGTH = 1000

function truncate(value: string | null): string | null {
  if (value === null) return null
  if (value.length <= MAX_VALUE_LENGTH) return value
  return `${value.slice(0, MAX_VALUE_LENGTH)}… (đã cắt bớt)`
}

export async function logAudit(
  tx: Prisma.TransactionClient,
  entry: AuditEntry,
): Promise<void> {
  const changes = entry.changes?.length
    ? entry.changes
    : [{ field: null, oldValue: null, newValue: null }]

  await tx.auditLog.createMany({
    data: changes.map((change) => ({
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      field: 'field' in change ? change.field : null,
      oldValue: truncate(change.oldValue),
      newValue: truncate(change.newValue),
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
    })),
  })
}

/**
 * Sinh danh sách thay đổi bằng cách so hai bản ghi trên các trường chỉ định.
 * Chỉ trả về trường thực sự đổi — không ghi audit rỗng.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T | null,
  after: T,
  fields: ReadonlyArray<keyof T & string>,
): AuditChange[] {
  const changes: AuditChange[] = []
  for (const field of fields) {
    const oldValue = before ? stringify(before[field]) : null
    const newValue = stringify(after[field])
    if (oldValue !== newValue) {
      changes.push({ field, oldValue, newValue })
    }
  }
  return changes
}

function stringify(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value instanceof Date) return value.toISOString()
  // Decimal của Prisma và các object khác đều có toString hữu ích hơn JSON.
  if (typeof (value as { toString?: () => string }).toString === 'function') {
    const s = String(value)
    if (s !== '[object Object]') return s
  }
  return JSON.stringify(value)
}
