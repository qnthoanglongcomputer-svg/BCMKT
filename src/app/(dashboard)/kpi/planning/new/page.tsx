import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPlanFormOptions } from '@/server/kpi/plan-service'
import { requireScope } from '@/server/auth/guard'
import { PlanForm } from '@/components/kpi/PlanForm'
import { PageHeader } from '@/components/ui/primitives'

export const dynamic = 'force-dynamic'

export default async function NewPlanPage() {
  const { scope } = await requireScope()
  // Không đủ quyền tạo kế hoạch → coi như trang không tồn tại.
  if (!scope.canManageKpi) notFound()

  const options = await getPlanFormOptions(scope)

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
