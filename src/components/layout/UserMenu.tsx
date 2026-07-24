import { redirect } from 'next/navigation'
import { signOut } from '@/server/auth/config'
import { buttonClass } from '@/components/ui/primitives'

export function UserMenu() {
  async function logout() {
    'use server'
    await signOut({ redirect: false })
    redirect('/login')
  }

  return (
    <form action={logout}>
      <button type="submit" className={buttonClass('secondary', 'px-2 py-1 text-xs')}>
        Đăng xuất
      </button>
    </form>
  )
}
