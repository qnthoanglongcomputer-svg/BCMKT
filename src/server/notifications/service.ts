import Decimal from 'decimal.js'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { monthBounds } from '@/server/dashboard/overview'
import { buildDedupeKey, monthKey, summarizeCount, type NotificationType } from './dedupe'
import type { Scope } from '@/server/auth/scope'

export interface NotificationRow {
  id: string
  type: string
  title: string
  body: string
  linkUrl: string | null
  readAt: Date | null
  createdAt: Date
}

export async function listNotifications(
  userId: string,
  onlyUnread = false,
): Promise<NotificationRow[]> {
  return prisma.notification.findMany({
    where: { userId, ...(onlyUnread ? { readAt: null } : {}) },
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      linkUrl: true,
      readAt: true,
      createdAt: true,
    },
    orderBy: [{ readAt: 'asc' }, { createdAt: 'desc' }],
    take: 100,
  })
}

export async function countUnread(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } })
}

export async function markRead(userId: string, notificationId?: string): Promise<void> {
  await prisma.notification.updateMany({
    // Chỉ đánh dấu thông báo của chính người dùng — không nhận id tuỳ ý từ client.
    where: { userId, readAt: null, ...(notificationId ? { id: notificationId } : {}) },
    data: { readAt: new Date() },
  })
}

/**
 * Tạo thông báo trong cùng transaction với thay đổi dữ liệu gây ra nó.
 *
 * Khoá unique `(userId, dedupeKey)` chặn trùng ở tầng DB — `skipDuplicates`
 * biến việc gửi lại thành no-op thay vì lỗi.
 */
export async function createNotifications(
  tx: Prisma.TransactionClient,
  items: Array<{
    userId: string
    type: NotificationType
    title: string
    body: string
    linkUrl?: string | null
    dedupeKey: string
  }>,
): Promise<number> {
  if (items.length === 0) return 0
  const result = await tx.notification.createMany({
    data: items.map((i) => ({
      userId: i.userId,
      type: i.type,
      title: i.title,
      body: i.body,
      linkUrl: i.linkUrl ?? null,
      dedupeKey: i.dedupeKey,
    })),
    skipDuplicates: true,
  })
  return result.count
}

export interface GenerateResult {
  created: number
  byType: Record<string, number>
}

/**
 * Quét dữ liệu hiện tại và sinh thông báo cho các tình huống cần chú ý.
 *
 * Chạy được lại nhiều lần an toàn: `dedupeKey` bảo đảm cùng một việc trong cùng
 * kỳ chỉ tạo một thông báo. Đây là công việc của cron, không chạy khi người
 * dùng mở màn hình.
 */
export async function generateNotifications(now: Date): Promise<GenerateResult> {
  const { start } = monthBounds(now)
  const period = monthKey(now)
  const byType: Record<string, number> = {}

  const items: Array<{
    userId: string
    type: NotificationType
    title: string
    body: string
    linkUrl?: string | null
    dedupeKey: string
  }> = []

  // ── KPI bộ phận dưới 80 điểm ────────────────────────────────
  const lowScores = await prisma.kpiSummary.findMany({
    where: { ownerType: 'DEPARTMENT', periodType: 'MONTH', periodStart: start, score: { lt: 80 } },
    select: { ownerId: true, score: true, grade: true },
  })

  if (lowScores.length > 0) {
    const departments = await prisma.department.findMany({
      where: { id: { in: lowScores.map((s) => s.ownerId) }, deletedAt: null },
      select: { id: true, name: true },
    })
    const nameById = new Map(departments.map((d) => [d.id, d.name]))

    for (const summary of lowScores) {
      const departmentName = nameById.get(summary.ownerId)
      if (!departmentName) continue

      // Gửi cho Leader của bộ phận đó và toàn bộ Manager/Admin.
      const recipients = await prisma.user.findMany({
        where: {
          deletedAt: null,
          isActive: true,
          OR: [
            { departmentId: summary.ownerId, role: 'LEADER' },
            { role: { in: ['ADMIN', 'MARKETING_MANAGER'] } },
          ],
        },
        select: { id: true },
      })

      const score = new Decimal(summary.score.toString()).toDecimalPlaces(1)
      for (const recipient of recipients) {
        items.push({
          userId: recipient.id,
          type: 'KPI_BELOW_THRESHOLD',
          title: `${departmentName} đang dưới ngưỡng KPI`,
          body: `Điểm KPI tháng này là ${score.toString()} (xếp loại ${summary.grade}), dưới ngưỡng 80.`,
          linkUrl: '/dashboard',
          dedupeKey: buildDedupeKey('KPI_BELOW_THRESHOLD', summary.ownerId, period),
        })
      }
    }
    byType.KPI_BELOW_THRESHOLD = lowScores.length
  }

  // ── Chiến dịch vượt ngân sách ───────────────────────────────
  const campaigns = await prisma.campaign.findMany({
    where: { deletedAt: null, isActive: true, budget: { not: null } },
    select: { id: true, name: true, budget: true },
  })

  if (campaigns.length > 0) {
    const spendRows = await prisma.adsInsight.groupBy({
      by: ['campaignId'],
      where: { campaignId: { in: campaigns.map((c) => c.id) } },
      _sum: { spend: true },
    })
    const spendById = new Map(
      spendRows.map((r) => [r.campaignId, new Decimal(r._sum.spend?.toString() ?? 0)]),
    )

    const managers = await prisma.user.findMany({
      where: { deletedAt: null, isActive: true, role: { in: ['ADMIN', 'MARKETING_MANAGER'] } },
      select: { id: true },
    })

    let overCount = 0
    for (const campaign of campaigns) {
      const budget = new Decimal(campaign.budget?.toString() ?? 0)
      if (budget.isZero()) continue
      const spend = spendById.get(campaign.id) ?? new Decimal(0)
      if (spend.lte(budget)) continue

      overCount++
      const usage = spend.dividedBy(budget).times(100).toDecimalPlaces(1)
      for (const manager of managers) {
        items.push({
          userId: manager.id,
          type: 'CAMPAIGN_OVER_BUDGET',
          title: `Chiến dịch "${campaign.name}" vượt ngân sách`,
          body: `Đã dùng ${usage.toString()}% ngân sách đã duyệt.`,
          linkUrl: `/campaigns/${campaign.id}`,
          dedupeKey: buildDedupeKey('CAMPAIGN_OVER_BUDGET', campaign.id, period),
        })
      }
    }
    if (overCount > 0) byType.CAMPAIGN_OVER_BUDGET = overCount
  }

  // ── Báo cáo chờ duyệt: gộp thành MỘT thông báo mỗi người duyệt ──
  const pendingByDepartment = await prisma.report.groupBy({
    by: ['departmentId'],
    where: { status: 'SUBMITTED' },
    _count: { _all: true },
  })

  for (const group of pendingByDepartment) {
    const approvers = await prisma.user.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        OR: [
          { departmentId: group.departmentId, role: 'LEADER' },
          { role: { in: ['ADMIN', 'MARKETING_MANAGER'] } },
        ],
      },
      select: { id: true },
    })

    for (const approver of approvers) {
      items.push({
        userId: approver.id,
        type: 'REPORT_PENDING_APPROVAL',
        title: 'Có báo cáo chờ duyệt',
        body: `Bạn có ${summarizeCount(group._count._all, 'báo cáo chờ duyệt')}.`,
        linkUrl: '/reports',
        // Số lượng nằm trong khoá: số đổi thì đáng gửi lại, số không đổi thì thôi.
        dedupeKey: buildDedupeKey(
          'REPORT_PENDING_APPROVAL',
          `${group.departmentId}:${group._count._all}`,
          period,
        ),
      })
    }
  }
  if (pendingByDepartment.length > 0) {
    byType.REPORT_PENDING_APPROVAL = pendingByDepartment.length
  }

  const created = await prisma.$transaction((tx) => createNotifications(tx, items))
  return { created, byType }
}

/** Thông báo trong phạm vi người dùng — dùng cho widget trên dashboard. */
export async function recentForUser(userId: string, scope: Scope, limit = 5) {
  void scope // thông báo đã gắn trực tiếp userId nên không cần lọc thêm theo scope
  return prisma.notification.findMany({
    where: { userId },
    select: { id: true, title: true, body: true, linkUrl: true, readAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}
