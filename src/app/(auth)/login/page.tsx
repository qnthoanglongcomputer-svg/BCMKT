import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/server/auth/guard'
import { LoginForm } from './LoginForm'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  // Đã đăng nhập thì không cần vào lại màn hình này.
  const user = await getCurrentUser()
  if (user) redirect('/dashboard')

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">MPMS</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Hệ thống quản trị hiệu suất Marketing
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <Suspense fallback={<div className="h-52" />}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          Quên mật khẩu? Liên hệ quản trị viên hệ thống.
        </p>
      </div>
    </main>
  )
}
