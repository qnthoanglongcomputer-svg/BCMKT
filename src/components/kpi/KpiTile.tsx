import clsx from 'clsx'
import { StatusBadge } from './StatusBadge'
import { ProgressBar } from './ProgressBar'
import {
  EM_DASH,
  changeTone,
  formatByUnit,
  formatDelta,
  formatPercent,
  kpiStatus,
} from '@/lib/format'
import type { MetricDirection } from '@/server/kpi/types'

interface Props {
  name: string
  unit: string
  direction: MetricDirection
  actual: number | null
  /** Mục tiêu cả kỳ — hiển thị để người dùng biết đích đến */
  target: number | null
  /** Mục tiêu tính tới hôm nay — mẫu số của `attainment` */
  targetToDate: number | null
  /** Tỷ lệ đạt so với **tiến độ kỳ**, không phải so với mục tiêu cả kỳ */
  attainment: number | null
  delta: number | null
}

const TONE_CLASS = {
  good: 'text-emerald-600 dark:text-emerald-400',
  bad: 'text-rose-600 dark:text-rose-400',
  neutral: 'text-slate-500 dark:text-slate-400',
} as const

/**
 * Tile KPI ở hàng đầu dashboard.
 *
 * Điểm dễ sai nhất: metric LOWER_BETTER (CPA, chi phí). CPA giảm 12% là tin TỐT
 * → mũi tên xuống nhưng màu xanh. Chiều màu do `changeTone` quyết định, không
 * suy từ dấu của delta.
 */
export function KpiTile({
  name,
  unit,
  direction,
  actual,
  target,
  targetToDate,
  attainment,
  delta,
}: Props) {
  const status = kpiStatus(attainment)
  const tone = changeTone(delta, direction)
  const arrow = delta === null || delta === 0 ? '' : delta > 0 ? '▲' : '▼'

  return (
    <article className="flex min-h-[7.5rem] flex-col justify-between rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">{name}</h3>
        <StatusBadge status={status} />
      </div>

      <div className="mt-1">
        <div className="text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
          {formatByUnit(actual, unit, { compact: true })}
        </div>
        <div className="mt-0.5 flex items-baseline gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="tabular-nums">
            MT kỳ: {formatByUnit(target, unit, { compact: true })}
          </span>
          <span
            className="tabular-nums font-medium text-slate-700 dark:text-slate-300"
            title={`So với tiến độ kỳ: ${formatByUnit(targetToDate, unit, { compact: true })}`}
          >
            {attainment === null ? EM_DASH : formatPercent(attainment)}
          </span>
          <span className="text-[0.65rem] text-slate-400">theo tiến độ</span>
        </div>
      </div>

      <div className="mt-2 space-y-1.5">
        <ProgressBar attainment={attainment} />
        <div className={clsx('text-xs tabular-nums', TONE_CLASS[tone])}>
          {delta === null ? (
            <span className="text-slate-400">Không có kỳ trước để so</span>
          ) : (
            <>
              {arrow} {formatDelta(delta)}{' '}
              <span className="text-slate-400">so tháng trước</span>
            </>
          )}
        </div>
      </div>
    </article>
  )
}
