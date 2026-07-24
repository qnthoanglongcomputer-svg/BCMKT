import Link from 'next/link'
import { getPlanFormOptions } from '@/server/kpi/plan-service'
import { PlanForm } from '@/components/kpi/PlanForm'
import { PageHeader } from '@/components/ui/primitives'

export const dynamic = 'force-dynamic'

export default async function NewPlanPage() {
  const options = await getPlanFormOptions()

  return (
    <div className="mx-auto max-w-[1400px] p-4 lg:p-6">
      <PageHeader
        title="Thêm kế hoạch KPI"
        description="Nhập mục tiêu một lần cho cả năm. Hệ thống sinh mục tiêu cho từng quý, tháng, tuần và ngày."
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
          year: new Date().getUTCFullYear(),
          ownerId: '',
          kpiDefinitionId: '',
          yearTarget: '',
          strategy: 'EVEN',
        }}
      />
    </div>
  )
}
