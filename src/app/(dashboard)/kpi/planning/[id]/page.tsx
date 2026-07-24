import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getPlan, getPlanFormOptions } from '@/server/kpi/plan-service'
import { PlanForm } from '@/components/kpi/PlanForm'
import { PageHeader } from '@/components/ui/primitives'

export const dynamic = 'force-dynamic'

/** JSON từ Prisma là `unknown` — thu hẹp về bản ghi tháng→chuỗi trước khi dùng. */
function toMonthRecord(value: unknown): Record<string, string> | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  const out: Record<string, string> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (raw === null || raw === undefined) continue
    out[key] = String(raw)
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export default async function EditPlanPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [plan, options] = await Promise.all([getPlan(id), getPlanFormOptions()])

  // Chỉ số bị xoá khỏi danh mục thì kế hoạch không còn ý nghĩa để sửa.
  if (!plan || !plan.kpiDefinition) notFound()

  const definition = plan.kpiDefinition
  const isRatio = definition.aggregation === 'RATIO'
  const stored = toMonthRecord(plan.lockedMonths)

  const actualCount = await prisma.kpiActual.count({
    where: { ownerId: plan.ownerId, kpiDefinitionId: plan.kpiDefinitionId },
  })

  return (
    <div className="mx-auto max-w-[1400px] p-4 lg:p-6">
      <PageHeader
        title={`Sửa kế hoạch: ${definition.name}`}
        description={`Năm ${plan.year} · ${isRatio ? 'chỉ số tỷ lệ' : 'chỉ số cộng dồn'} · đơn vị ${definition.unit}`}
        actions={
          <Link
            href="/kpi"
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            ← Danh sách kế hoạch
          </Link>
        }
      />

      <PlanForm
        options={options}
        initial={{
          planId: plan.id,
          year: plan.year,
          ownerId: plan.ownerId,
          kpiDefinitionId: plan.kpiDefinitionId,
          yearTarget: plan.yearTarget.toString(),
          strategy: plan.strategy,
          monthWeights: toMonthRecord(plan.monthWeights),
          lockedMonths: isRatio ? undefined : stored,
          monthlyValues: isRatio ? stored : undefined,
          hasActuals: actualCount > 0,
        }}
      />
    </div>
  )
}
