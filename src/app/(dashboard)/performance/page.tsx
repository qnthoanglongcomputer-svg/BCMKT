import { notFound } from 'next/navigation'
import { getDepartmentDashboard } from '@/server/dashboard/department'
import { DepartmentDashboard } from '@/components/kpi/DepartmentDashboard'
import { ErrorState } from '@/components/ui/primitives'
import { DEPARTMENT_CODES } from '@/lib/departments'
import { requireScope } from '@/server/auth/guard'

export const dynamic = 'force-dynamic'

export default async function PerformancePage() {
  let data: Awaited<ReturnType<typeof getDepartmentDashboard>>

  try {
    // Ngày hiện tại lấy ở biên ngoài rồi truyền vào — hàm nghiệp vụ không tự đọc thời gian.
    const { scope } = await requireScope()
    data = await getDepartmentDashboard(DEPARTMENT_CODES.PERFORMANCE, new Date(), scope)
  } catch (error) {
    console.error('Không tải được dashboard Performance:', error)
    return (
      <div className="mx-auto max-w-[1600px] p-4 lg:p-6">
        <ErrorState message="Kiểm tra kết nối cơ sở dữ liệu rồi tải lại trang." />
      </div>
    )
  }

  // Bộ phận không tồn tại (hoặc sau này: ngoài phạm vi quyền) → 404,
  // không phải 403, để không tiết lộ bộ phận đó có tồn tại hay không.
  if (!data) notFound()

  return <DepartmentDashboard data={data} />
}
