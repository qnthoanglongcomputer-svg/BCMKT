'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import type { Role } from '@/server/auth/scope'

/**
 * Menu chính theo mục 25 đặc tả.
 *
 * `roles` giới hạn vai trò nào **nhìn thấy** mục đó. Đây chỉ là trải nghiệm —
 * bảo mật thật nằm ở guard phía server. Ẩn menu không thay thế được việc kiểm
 * quyền trong route handler và server action.
 *
 * `disabled` = chức năng chưa xây. Hiện mờ thay vì ẩn, để thấy được lộ trình.
 */
const ALL_ROLES: readonly Role[] = ['ADMIN', 'MARKETING_MANAGER', 'LEADER', 'EMPLOYEE']
/** Dashboard bộ phận là dữ liệu tổng hợp — nhân viên chỉ xem KPI cá nhân. */
const NOT_EMPLOYEE: readonly Role[] = ['ADMIN', 'MARKETING_MANAGER', 'LEADER']
const KPI_ADMIN: readonly Role[] = ['ADMIN', 'MARKETING_MANAGER']

const NAV_ITEMS: ReadonlyArray<{
  href: string
  label: string
  icon: string
  roles: readonly Role[]
  disabled?: boolean
}> = [
  { href: '/dashboard', label: 'Dashboard', icon: '🏠', roles: ALL_ROLES },
  // Leader xem được kế hoạch KPI của subtree mình (đặc tả mục 20: "theo dõi Team"),
  // nhưng nút thêm/sửa bị ẩn theo `scope.canManageKpi`.
  { href: '/kpi', label: 'KPI', icon: '🎯', roles: NOT_EMPLOYEE },
  { href: '/kpi/weights', label: 'Trọng số KPI', icon: '⚖️', roles: KPI_ADMIN },
  { href: '/ads', label: 'Số liệu quảng cáo', icon: '📣', roles: KPI_ADMIN },
  { href: '/performance', label: 'Performance', icon: '📈', roles: NOT_EMPLOYEE },
  { href: '/content-social', label: 'Content Social', icon: '📱', roles: NOT_EMPLOYEE, disabled: true },
  { href: '/content-creator', label: 'Content Creator', icon: '🎥', roles: NOT_EMPLOYEE, disabled: true },
  { href: '/designer', label: 'Designer', icon: '🎨', roles: NOT_EMPLOYEE, disabled: true },
  { href: '/editor', label: 'Editor', icon: '🎬', roles: NOT_EMPLOYEE, disabled: true },
  { href: '/trade', label: 'Trade Marketing', icon: '🏪', roles: NOT_EMPLOYEE, disabled: true },
  { href: '/branding', label: 'Branding', icon: '🏷', roles: NOT_EMPLOYEE, disabled: true },
  { href: '/campaigns', label: 'Campaign', icon: '📊', roles: NOT_EMPLOYEE },
  { href: '/hr', label: 'Nhân sự', icon: '👥', roles: NOT_EMPLOYEE },
  { href: '/ai-insight', label: 'AI Insight', icon: '🤖', roles: NOT_EMPLOYEE },
  { href: '/reports', label: 'Báo cáo', icon: '📄', roles: ALL_ROLES },
  { href: '/notifications', label: 'Thông báo', icon: '🔔', roles: ALL_ROLES },
  { href: '/admin', label: 'Quản trị', icon: '⚙', roles: ['ADMIN'] },
]

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname()
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role))

  return (
    <nav
      aria-label="Menu chính"
      className="hidden w-56 shrink-0 border-r border-slate-200 bg-white md:block dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex h-12 items-center border-b border-slate-200 px-4 dark:border-slate-800">
        <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          MPMS
        </span>
      </div>

      <ul className="space-y-0.5 p-2">
        {items.map((item) => {
          // So khớp chính xác để /kpi không sáng khi đang ở /kpi/weights.
          const isActive =
            pathname === item.href ||
            (pathname.startsWith(`${item.href}/`) &&
              !items.some((other) => other !== item && pathname.startsWith(other.href) && other.href.length > item.href.length))

          if (item.disabled) {
            return (
              <li key={item.href}>
                <span
                  className="flex cursor-not-allowed items-center gap-2.5 rounded px-2.5 py-1.5 text-sm text-slate-400 dark:text-slate-600"
                  title="Chức năng đang được xây dựng"
                  aria-disabled="true"
                >
                  <span aria-hidden="true" className="w-4 text-center">{item.icon}</span>
                  {item.label}
                </span>
              </li>
            )
          }

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={clsx(
                  'flex items-center gap-2.5 rounded px-2.5 py-1.5 text-sm transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600',
                  isActive
                    ? 'bg-blue-50 font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                )}
              >
                <span aria-hidden="true" className="w-4 text-center">{item.icon}</span>
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
