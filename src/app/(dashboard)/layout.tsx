import { Sidebar } from '@/components/layout/Sidebar'

/**
 * ⚠️ Chưa có guard xác thực — module auth (workflow 01) chưa được xây.
 * Khi làm xong 01, layout này phải kiểm session và chuyển hướng về /login.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
