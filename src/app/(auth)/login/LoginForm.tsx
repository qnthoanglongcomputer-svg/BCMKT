'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Alert, Button, Field, inputClass } from '@/components/ui/primitives'
import { loginAction } from './actions'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setError(null)

    startTransition(async () => {
      const result = await loginAction(formData)
      if (result.ok) {
        // Chỉ nhận đường dẫn nội bộ: chặn open redirect qua ?callbackUrl=
        const target = searchParams.get('callbackUrl')
        const safe = target && target.startsWith('/') && !target.startsWith('//') ? target : '/dashboard'
        router.push(safe)
        router.refresh()
      } else {
        setError(result.error ?? 'Không đăng nhập được')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Field label="Email">
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          className={inputClass}
          placeholder="ten@congty.vn"
        />
      </Field>

      <Field label="Mật khẩu">
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </Field>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Đang đăng nhập…' : 'Đăng nhập'}
      </Button>
    </form>
  )
}
