'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/primitives'
import { reanalyzeAction } from './actions'

export function ReanalyzeButton({ departmentCode }: { departmentCode: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <>
      <Button
        variant="secondary"
        disabled={isPending}
        onClick={() => {
          setError(null)
          startTransition(async () => {
            const result = await reanalyzeAction({ departmentCode })
            if (result.ok) router.refresh()
            else setError(result.error ?? 'Không phân tích lại được')
          })
        }}
      >
        {isPending ? 'Đang phân tích…' : 'Phân tích lại'}
      </Button>
      {error ? (
        <p role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
    </>
  )
}
