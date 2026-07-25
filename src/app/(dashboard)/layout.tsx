import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { UserMenu } from '@/components/layout/UserMenu'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { getCurrentUser } from '@/server/auth/guard'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Quản trị viên',
  MARKETING_MANAGER: 'Trưởng phòng Marketing',
  LEADER: 'Trưởng bộ phận',
  EMPLOYEE: 'Nhân viên',
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  // Guard: chưa đăng nhập thì không vào được bất kỳ màn hình nào trong nhóm này.
  // Đây là lớp bảo vệ thứ nhất; mỗi truy vấn dữ liệu vẫn tự áp scope riêng.
  if (!user) redirect('/login')

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { fullName: true, department: { select: { name: true } } },
  })

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar role={user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center justify-end gap-3 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
          <NotificationBell userId={user.id} />
          <div className="text-right leading-tight">
            <div className="text-sm text-slate-800 dark:text-slate-200">
              {profile?.fullName ?? 'Người dùng'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {ROLE_LABEL[user.role] ?? user.role}
              {profile?.department?.name ? ` · ${profile.department.name}` : ''}
            </div>
          </div>
          <UserMenu />
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
