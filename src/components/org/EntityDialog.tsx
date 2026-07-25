'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Button } from '@/components/ui/primitives'
import type { ActionResult } from '@/server/action-result'

/**
 * Hộp thoại dùng chung cho các form quản trị ngắn (phòng ban, vị trí, người dùng).
 *
 * Dùng `<dialog>` gốc của trình duyệt: đã có sẵn bẫy tiêu điểm bàn phím, đóng
 * bằng Esc, và lớp phủ — không cần dựng lại bằng JS.
 */
export function EntityDialog({
  trigger,
  title,
  description,
  children,
  onSubmit,
  submitLabel = 'Lưu',
}: {
  trigger: React.ReactNode
  title: string
  description?: string
  children: React.ReactNode
  onSubmit: (formData: FormData) => Promise<ActionResult>
  submitLabel?: string
}) {
  const router = useRouter()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setError(null)

    startTransition(async () => {
      const result = await onSubmit(formData)
      if (result.ok) {
        setOpen(false)
        router.refresh()
      } else {
        setError(result.error ?? 'Không lưu được')
      }
    })
  }

  return (
    <>
      <span onClick={() => setOpen(true)} className="contents">
        {trigger}
      </span>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-0 backdrop:bg-slate-900/40 dark:border-slate-800 dark:bg-slate-900"
      >
        <form onSubmit={handleSubmit} className="p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>
          ) : null}

          <div className="mt-4 space-y-3">{children}</div>

          {error ? (
            <div className="mt-3">
              <Alert tone="error">{error}</Alert>
            </div>
          ) : null}

          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Huỷ
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Đang lưu…' : submitLabel}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  )
}

/** Nút thực hiện một hành động cần xác nhận (vô hiệu hoá, đặt lại mật khẩu…). */
export function ConfirmButton({
  label,
  confirmText,
  onConfirm,
  className,
}: {
  label: string
  confirmText: string
  onConfirm: () => Promise<ActionResult>
  className?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleClick() {
    if (!window.confirm(confirmText)) return
    setError(null)
    startTransition(async () => {
      const result = await onConfirm()
      if (result.ok) router.refresh()
      else setError(result.error ?? 'Không thực hiện được')
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={className ?? 'text-sm text-rose-600 hover:underline disabled:opacity-50 dark:text-rose-400'}
      >
        {isPending ? '…' : label}
      </button>
      {error ? (
        <p role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
    </>
  )
}
