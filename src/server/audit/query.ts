import type { AuditAction, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * Đọc nhật ký hệ thống. Chỉ đọc — bảng này **chỉ append**, không có hàm
 * update hay delete ở bất kỳ đâu và không được thêm.
 */

export const PAGE_SIZE = 50

export interface AuditFilter {
  actorId?: string
  entityType?: string
  action?: AuditAction
  from?: Date
  to?: Date
  /** Con trỏ phân trang: id của bản ghi cuối trang trước */
  cursor?: string
}

export interface AuditRow {
  id: string
  createdAt: Date
  actorName: string | null
  action: AuditAction
  entityType: string
  entityId: string
  field: string | null
  oldValue: string | null
  newValue: string | null
  ipAddress: string | null
}

export interface AuditPage {
  rows: AuditRow[]
  /** id để tải trang kế tiếp; null khi hết dữ liệu */
  nextCursor: string | null
}

/**
 * Phân trang bằng **cursor**, không dùng `skip` với offset lớn: bảng audit sẽ
 * rất lớn và `OFFSET 100000` buộc Postgres quét qua toàn bộ số dòng bị bỏ.
 */
export async function listAuditLog(filter: AuditFilter): Promise<AuditPage> {
  const where: Prisma.AuditLogWhereInput = {}

  if (filter.actorId) where.actorId = filter.actorId
  if (filter.entityType) where.entityType = filter.entityType
  if (filter.action) where.action = filter.action
  if (filter.from || filter.to) {
    where.createdAt = {
      ...(filter.from ? { gte: filter.from } : {}),
      ...(filter.to ? { lte: filter.to } : {}),
    }
  }

  const rows = await prisma.auditLog.findMany({
    where,
    select: {
      id: true,
      createdAt: true,
      action: true,
      entityType: true,
      entityId: true,
      field: true,
      oldValue: true,
      newValue: true,
      ipAddress: true,
      actor: { select: { fullName: true } },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: PAGE_SIZE + 1,
    ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
  })

  const hasMore = rows.length > PAGE_SIZE
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows

  return {
    rows: page.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      // actor null = hành động của hệ thống (cron rollup, đồng bộ ads)
      actorName: r.actor?.fullName ?? null,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      field: r.field,
      oldValue: r.oldValue,
      newValue: r.newValue,
      ipAddress: r.ipAddress,
    })),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
  }
}

/** Các giá trị có thật trong dữ liệu, để dựng bộ lọc không có lựa chọn rỗng. */
export async function getAuditFilterOptions() {
  const [entityTypes, actors] = await Promise.all([
    prisma.auditLog.findMany({
      select: { entityType: true },
      distinct: ['entityType'],
      orderBy: { entityType: 'asc' },
    }),
    prisma.user.findMany({
      where: { deletedAt: null },
      select: { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
    }),
  ])

  return {
    entityTypes: entityTypes.map((e) => e.entityType),
    actors,
  }
}

/** Lịch sử thay đổi của một bản ghi cụ thể — nhúng vào màn hình chi tiết. */
export async function getEntityHistory(
  entityType: string,
  entityId: string,
  limit = 10,
): Promise<AuditRow[]> {
  const rows = await prisma.auditLog.findMany({
    where: { entityType, entityId },
    select: {
      id: true,
      createdAt: true,
      action: true,
      entityType: true,
      entityId: true,
      field: true,
      oldValue: true,
      newValue: true,
      ipAddress: true,
      actor: { select: { fullName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    actorName: r.actor?.fullName ?? null,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    field: r.field,
    oldValue: r.oldValue,
    newValue: r.newValue,
    ipAddress: r.ipAddress,
  }))
}
