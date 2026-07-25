import { notFound } from 'next/navigation'
import { getDepartmentDashboard } from '@/server/dashboard/department'
import { getChannelDashboard } from '@/server/dashboard/channels'
import { resolveDateRange } from '@/server/dashboard/date-range'
import { DepartmentDashboard } from '@/components/kpi/DepartmentDashboard'
import { ChannelStatsSection } from '@/components/dashboard/ChannelStatsSection'
import { ErrorState } from '@/components/ui/primitives'
import { DEPARTMENT_CODES } from '@/lib/departments'
import { requireScope } from '@/server/auth/guard'

export const dynamic = 'force-dynamic'

export default async function PerformancePage() {
  let data: Awaited<ReturnType<typeof getDepartmentDashboard>>
  let channels: Awaited<ReturnType<typeof getChannelDashboard>>
  let canManage = false

  try {
    // Ngày hiện tại lấy ở biên ngoài rồi truyền vào — hàm nghiệp vụ không tự đọc thời gian.
    const today = new Date()
    const { user, scope } = await requireScope()
    canManage = user.role === 'ADMIN' || user.role === 'MARKETING_MANAGER'

    // Performance là bộ phận chạy ads (đặc tả mục 7): kèm thống kê đầy đủ các
    // kênh quảng cáo trong cùng kỳ với dashboard KPI (tháng hiện tại).
    ;[data, channels] = await Promise.all([
      getDepartmentDashboard(DEPARTMENT_CODES.PERFORMANCE, today, scope),
      getChannelDashboard(resolveDateRange({ preset: 'this-month' }, today)),
    ])
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

  return (
    <DepartmentDashboard
      data={data}
      afterHeadline={
        <ChannelStatsSection
          channels={channels.channels}
          total={channels.total.metrics}
          trend={channels.trend}
          canManage={canManage}
        />
      }
    />
  )
}
