import Link from 'next/link'
import { getWeightFormOptions } from '@/server/kpi/weight-service'
import { WeightGroupForm } from '@/components/kpi/WeightGroupForm'
import { PageHeader } from '@/components/ui/primitives'

export const dynamic = 'force-dynamic'

export default async function NewWeightGroupPage() {
  const options = await getWeightFormOptions()

  return (
    <div className="mx-auto max-w-[1200px] p-4 lg:p-6">
      <PageHeader
        title="Thêm nhóm trọng số"
        description="Chọn các chỉ số dùng để chấm điểm cho một vị trí, tổng trọng số phải bằng 100%."
        actions={
          <Link href="/kpi/weights" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
            ← Danh sách nhóm
          </Link>
        }
      />

      <WeightGroupForm
        options={options}
        initial={{
          name: '',
          positionId: '',
          effectiveYear: new Date().getUTCFullYear(),
          weights: [],
        }}
      />
    </div>
  )
}
