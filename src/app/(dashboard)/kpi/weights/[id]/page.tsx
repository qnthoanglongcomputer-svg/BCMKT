import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getWeightFormOptions, getWeightGroup } from '@/server/kpi/weight-service'
import { WeightGroupForm } from '@/components/kpi/WeightGroupForm'
import { PageHeader } from '@/components/ui/primitives'

export const dynamic = 'force-dynamic'

export default async function EditWeightGroupPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [group, options] = await Promise.all([getWeightGroup(id), getWeightFormOptions()])

  if (!group) notFound()

  return (
    <div className="mx-auto max-w-[1200px] p-4 lg:p-6">
      <PageHeader
        title={`Sửa nhóm: ${group.name}`}
        description={`${group.position?.name ?? 'Chưa gắn vị trí'} · ${group.position?.department.name ?? '—'} · năm ${group.effectiveYear}`}
        actions={
          <Link href="/kpi/weights" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
            ← Danh sách nhóm
          </Link>
        }
      />

      <WeightGroupForm
        options={options}
        initial={{
          groupId: group.id,
          name: group.name,
          positionId: group.positionId ?? '',
          effectiveYear: group.effectiveYear,
          weights: group.weights.map((w) => ({
            kpiDefinitionId: w.kpiDefinitionId,
            weight: w.weight.toString(),
          })),
        }}
      />
    </div>
  )
}
