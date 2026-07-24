import clsx from 'clsx'
import { KPI_STATUS_LABEL, type KpiStatus } from '@/lib/format'

/**
 * Nhãn trạng thái KPI. **Luôn có chữ**, không chỉ có màu — yêu cầu accessibility
 * và để đọc được trên ảnh chụp đen trắng.
 */

const STYLES: Record<KpiStatus, string> = {
  ACHIEVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  AT_RISK: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  MISSED: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
  NO_DATA: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
}

export function StatusBadge({ status, className }: { status: KpiStatus; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap',
        STYLES[status],
        className,
      )}
    >
      {KPI_STATUS_LABEL[status]}
    </span>
  )
}
