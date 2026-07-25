import Link from 'next/link'
import { countUnread } from '@/server/notifications/service'

/**
 * Chuông thông báo trên thanh header.
 *
 * Server Component: chỉ đếm số chưa đọc, không cần JS ở client. Danh sách đầy
 * đủ nằm ở `/notifications`.
 */
export async function NotificationBell({ userId }: { userId: string }) {
  let unread = 0
  try {
    unread = await countUnread(userId)
  } catch (error) {
    // Chuông hỏng không được làm sập cả layout.
    console.error('Không đếm được thông báo chưa đọc:', error)
  }

  return (
    <Link
      href="/notifications"
      className="relative flex h-8 w-8 items-center justify-center rounded hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:hover:bg-slate-800"
      aria-label={unread > 0 ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'}
    >
      <span aria-hidden="true">🔔</span>
      {unread > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[0.625rem] font-medium text-white">
          {unread > 99 ? '99+' : unread}
        </span>
      ) : null}
    </Link>
  )
}
