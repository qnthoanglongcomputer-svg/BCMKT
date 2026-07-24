'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

/**
 * Menu chính theo mục 25 đặc tả.
 *
 * `disabled` = chức năng chưa xây. Hiện mờ và không click được, thay vì ẩn đi —
 * để người dùng thấy được lộ trình và không tưởng hệ thống thiếu chức năng.
 *
 * ⚠️ Chưa lọc theo vai trò. Khi làm xong workflow 01 (auth), menu phải ẩn mục
 * ngoài quyền — nhưng đó chỉ là trải nghiệm, bảo mật vẫn nằm ở server.
 */
const NAV_ITEMS: ReadonlyArray<{ href: string; label: string; icon: string; disabled?: boolean }> = [
  { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { href: '/kpi', label: 'KPI', icon: '🎯' },
  { href: '/kpi/weights', label: 'Trọng số KPI', icon: '⚖️' },
  { href: '/performance', label: 'Performance', icon: '📈' },
  { href: '/content-social', label: 'Content Social', icon: '📱', disabled: true },
  { href: '/content-creator', label: 'Content Creator', icon: '🎥', disabled: true },
  { href: '/designer', label: 'Designer', icon: '🎨', disabled: true },
  { href: '/editor', label: 'Editor', icon: '🎬', disabled: true },
  { href: '/trade', label: 'Trade Marketing', icon: '🏪', disabled: true },
  { href: '/branding', label: 'Branding', icon: '🏷', disabled: true },
  { href: '/campaigns', label: 'Campaign', icon: '📊', disabled: true },
  { href: '/hr', label: 'Nhân sự', icon: '👥', disabled: true },
  { href: '/ai-insight', label: 'AI Insight', icon: '🤖', disabled: true },
  { href: '/reports', label: 'Báo cáo', icon: '📄', disabled: true },
  { href: '/notifications', label: 'Thông báo', icon: '🔔', disabled: true },
  { href: '/admin', label: 'Quản trị', icon: '⚙', disabled: true },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Menu chính"
      className="hidden w-56 shrink-0 border-r border-slate-200 bg-white md:block dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex h-14 items-center border-b border-slate-200 px-4 dark:border-slate-800">
        <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          MPMS
        </span>
      </div>

      <ul className="space-y-0.5 p-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

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
