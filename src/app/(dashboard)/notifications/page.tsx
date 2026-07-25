import { requireUser } from '@/server/auth/guard'
import { countUnread, listNotifications } from '@/server/notifications/service'
import { ErrorState, PageHeader } from '@/components/ui/primitives'
import { NotificationList } from './NotificationList'

export const dynamic = 'force-dynamic'

export default async function NotificationsPage() {
  const user = await requireUser()

  try {
    const [rows, unread] = await Promise.all([
      listNotifications(user.id),
      countUnread(user.id),
    ])

    return (
      <div className="mx-auto max-w-[1000px] p-4 lg:p-6">
        <PageHeader
          title="Thông báo"
          description={
            unread > 0
              ? `${unread} thông báo chưa đọc`
              : 'Không có thông báo chưa đọc'
          }
        />
        <NotificationList rows={rows} isAdmin={user.role === 'ADMIN'} />
      </div>
    )
  } catch (error) {
    console.error('Không tải được thông báo:', error)
    return (
      <div className="mx-auto max-w-[1000px] p-4 lg:p-6">
        <ErrorState message="Kiểm tra kết nối cơ sở dữ liệu rồi tải lại trang." />
      </div>
    )
  }
}
