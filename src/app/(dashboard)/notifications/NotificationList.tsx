'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Alert, Button, Card } from '@/components/ui/primitives'
import { generateNotificationsAction, markReadAction } from './actions'
import type { NotificationRow } from '@/server/notifications/service'

const TYPE_LABEL: Record<string, string> = {
  KPI_BELOW_THRESHOLD: 'KPI dưới ngưỡng',
  KPI_FORECAST_MISS: 'Dự báo không đạt',
  KPI_ACHIEVED: 'Hoàn thành KPI',
  CAMPAIGN_OVER_BUDGET: 'Vượt ngân sách',
  REPORT_PENDING_APPROVAL: 'Chờ duyệt',
  REPORT_MISSING: 'Chưa nhập báo cáo',
  ADS_SYNC_FAILED: 'Lỗi đồng bộ',
}

function formatWhen(date: Date): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function NotificationList({
  rows,
  isAdmin,
}: {
  rows: NotificationRow[]
  isAdmin: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const unread = rows.filter((r) => r.readAt === null).length

  function run(action: () => Promise<{ ok: boolean; error?: string; data?: unknown }>, onOk?: (data: unknown) => string) {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const result = await action()
      if (result.ok) {
        if (onOk) setMessage(onOk(result.data))
        router.refresh()
      } else {
        setError(result.error ?? 'Không thực hiện được')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          disabled={isPending || unread === 0}
          onClick={() => run(() => markReadAction({}))}
        >
          Đánh dấu tất cả đã đọc
        </Button>
        {isAdmin ? (
          <Button
            variant="secondary"
            disabled={isPending}
            onClick={() =>
              run(
                () => generateNotificationsAction(),
                (data) => {
                  const count = (data as { created?: number } | undefined)?.created ?? 0
                  return count === 0
                    ? 'Đã quét xong, không có thông báo mới (các việc cũ đã được gửi trước đó).'
                    : `Đã tạo ${count} thông báo mới.`
                },
              )
            }
          >
            Quét sinh thông báo
          </Button>
        ) : null}
      </div>

      {message ? <Alert tone="info">{message}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <Card>
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">
            Chưa có thông báo nào. Hệ thống sẽ báo khi KPI dưới ngưỡng, chiến dịch vượt ngân sách,
            hoặc có báo cáo chờ bạn duyệt.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((row) => (
              <li
                key={row.id}
                className={`flex items-start gap-3 py-3 ${row.readAt === null ? '' : 'opacity-60'}`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    row.readAt === null ? 'bg-blue-600' : 'bg-transparent'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {row.title}
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {TYPE_LABEL[row.type] ?? row.type}
                    </span>
                    <span className="text-xs text-slate-400">{formatWhen(row.createdAt)}</span>
                    {row.readAt === null ? (
                      <span className="sr-only">Chưa đọc</span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{row.body}</p>
                  {row.linkUrl ? (
                    <Link
                      href={row.linkUrl}
                      className="mt-1 inline-block text-xs text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Xem chi tiết →
                    </Link>
                  ) : null}
                </div>
                {row.readAt === null ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => run(() => markReadAction({ notificationId: row.id }))}
                    className="shrink-0 text-xs text-slate-500 hover:underline disabled:opacity-50"
                  >
                    Đã đọc
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
