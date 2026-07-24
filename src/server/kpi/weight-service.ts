import Decimal from 'decimal.js'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/server/audit/log'
import { validateWeightGroup } from './scoring'
import type { SaveWeightGroupInput } from './schemas'

export class WeightServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WeightServiceError'
  }
}

export interface WeightGroupListItem {
  id: string
  name: string
  positionName: string
  departmentName: string
  effectiveYear: number
  metricCount: number
  /** Tổng trọng số dạng tỷ lệ. Khác 1 nghĩa là cấu hình đang sai. */
  totalWeight: string
}

export async function listWeightGroups(year: number): Promise<WeightGroupListItem[]> {
  const groups = await prisma.kpiWeightGroup.findMany({
    where: { effectiveYear: year },
    select: {
      id: true,
      name: true,
      effectiveYear: true,
      position: { select: { name: true, department: { select: { name: true } } } },
      weights: { select: { weight: true } },
    },
    orderBy: { name: 'asc' },
  })

  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    positionName: g.position?.name ?? 'Không gắn vị trí',
    departmentName: g.position?.department.name ?? '—',
    effectiveYear: g.effectiveYear,
    metricCount: g.weights.length,
    totalWeight: g.weights
      .reduce<Decimal>((acc, w) => acc.plus(w.weight.toString()), new Decimal(0))
      .toString(),
  }))
}

export async function getWeightGroup(groupId: string) {
  return prisma.kpiWeightGroup.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      positionId: true,
      effectiveYear: true,
      position: { select: { name: true, department: { select: { name: true } } } },
      weights: {
        select: {
          kpiDefinitionId: true,
          weight: true,
          kpiDefinition: { select: { code: true, name: true, unit: true, direction: true } },
        },
      },
    },
  })
}

export async function getWeightFormOptions() {
  const [positions, definitions] = await Promise.all([
    prisma.position.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, department: { select: { name: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.kpiDefinition.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, unit: true, direction: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ])
  return { positions, definitions }
}

/**
 * Lưu nhóm trọng số.
 *
 * Tổng trọng số phải bằng 100% — kiểm hai lớp: Zod ở biên và
 * `validateWeightGroup` của engine ở đây. Trùng lặp có chủ đích: engine là nơi
 * định nghĩa quy tắc, Zod chỉ chặn sớm để báo lỗi đẹp hơn.
 */
export async function saveWeightGroup(
  input: SaveWeightGroupInput,
  actorId: string | null,
): Promise<{ groupId: string }> {
  validateWeightGroup(input.weights.map((w) => w.weight))

  const position = await prisma.position.findUnique({
    where: { id: input.positionId },
    select: { id: true, deletedAt: true },
  })
  if (!position || position.deletedAt) {
    throw new WeightServiceError('Vị trí không tồn tại hoặc đã bị vô hiệu hoá.')
  }

  // Khoá unique có cột nullable (departmentId) nên không dùng upsert được.
  const existing = input.groupId
    ? await prisma.kpiWeightGroup.findUnique({ where: { id: input.groupId } })
    : await prisma.kpiWeightGroup.findFirst({
        where: {
          positionId: input.positionId,
          departmentId: null,
          effectiveYear: input.effectiveYear,
        },
      })

  return prisma.$transaction(async (tx) => {
    const group = existing
      ? await tx.kpiWeightGroup.update({
          where: { id: existing.id },
          data: { name: input.name, updatedBy: actorId },
        })
      : await tx.kpiWeightGroup.create({
          data: {
            name: input.name,
            positionId: input.positionId,
            effectiveYear: input.effectiveYear,
            createdBy: actorId,
            updatedBy: actorId,
          },
        })

    const before = await tx.kpiWeight.findMany({
      where: { groupId: group.id },
      select: { kpiDefinitionId: true, weight: true },
    })
    const beforeByDef = new Map(before.map((w) => [w.kpiDefinitionId, w.weight.toString()]))

    // Xoá và ghi lại: đơn giản hơn so từng dòng, và bảo đảm bỏ metric khỏi nhóm
    // thì trọng số cũ biến mất hẳn.
    await tx.kpiWeight.deleteMany({ where: { groupId: group.id } })
    await tx.kpiWeight.createMany({
      data: input.weights.map((w) => ({
        groupId: group.id,
        kpiDefinitionId: w.kpiDefinitionId,
        weight: w.weight,
      })),
    })

    const changes = input.weights
      .filter((w) => beforeByDef.get(w.kpiDefinitionId) !== w.weight)
      .map((w) => ({
        field: `weight.${w.kpiDefinitionId}`,
        oldValue: beforeByDef.get(w.kpiDefinitionId) ?? null,
        newValue: w.weight,
      }))

    const removed = before
      .filter((b) => !input.weights.some((w) => w.kpiDefinitionId === b.kpiDefinitionId))
      .map((b) => ({
        field: `weight.${b.kpiDefinitionId}`,
        oldValue: b.weight.toString(),
        newValue: null,
      }))

    await logAudit(tx, {
      actorId,
      action: existing ? 'UPDATE' : 'CREATE',
      entityType: 'kpi_weight_group',
      entityId: group.id,
      changes: [...changes, ...removed],
    })

    return { groupId: group.id }
  })
}
