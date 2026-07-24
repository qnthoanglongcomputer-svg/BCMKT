import clsx from 'clsx'
import { kpiStatus } from '@/lib/format'

const FILL: Record<string, string> = {
  ACHIEVED: 'bg-emerald-500',
  AT_RISK: 'bg-amber-500',
  MISSED: 'bg-rose-500',
  NO_DATA: 'bg-slate-300 dark:bg-slate-700',
}

/**
 * Thanh tiến độ theo % đạt. `attainment` là tỷ lệ (0.84 = 84%).
 * Thanh có thể vượt 100% — cắt hiển thị ở 100% nhưng nhãn số vẫn hiện giá trị thật.
 */
export function ProgressBar({
  attainment,
  className,
}: {
  attainment: number | null
  className?: string
}) {
  const status = kpiStatus(attainment)
  const width = attainment === null ? 0 : Math.min(Math.max(attainment, 0), 1) * 100

  return (
    <div
      className={clsx('h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800', className)}
      role="progressbar"
      aria-valuenow={attainment === null ? undefined : Math.round(attainment * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={clsx('h-full rounded-full transition-all', FILL[status])}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}
