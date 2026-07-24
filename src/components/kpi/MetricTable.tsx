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
import type { MetricRow } from '@/server/dashboard/department'

const TONE_CLASS = {
  good: 'text-emerald-600 dark:text-emerald-400',
  bad: 'text-rose-600 dark:text-rose-400',
  neutral: 'text-slate-400',
} as const

/**
 * Bảng chỉ số chi tiết của một bộ phận.
 *
 * Cột "% tiến độ" so với mục tiêu tính tới hôm nay, không phải mục tiêu cả kỳ —
 * xem giải thích trong `KpiTileData.attainment`.
 */
export function MetricTable({ metrics }: { metrics: MetricRow[] }) {
  if (metrics.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-500">
        Chưa cấu hình chỉ số nào cho nhóm này.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <th scope="col" className="pb-2 text-left font-medium">Chỉ số</th>
            <th scope="col" className="pb-2 text-right font-medium">Thực tế</th>
            <th scope="col" className="pb-2 text-right font-medium">MT tới nay</th>
            <th scope="col" className="pb-2 text-right font-medium">MT cả kỳ</th>
            <th scope="col" className="pb-2 pl-3 text-left font-medium">% tiến độ</th>
            <th scope="col" className="pb-2 text-right font-medium">So kỳ trước</th>
            <th scope="col" className="pb-2 text-center font-medium">Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => {
            const tone = changeTone(m.delta, m.direction)
            const arrow = m.delta === null || m.delta === 0 ? '' : m.delta > 0 ? '▲' : '▼'
            return (
              <tr key={m.code} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <th scope="row" className="py-2.5 pr-3 text-left font-normal">
                  <span className="text-slate-800 dark:text-slate-200">{m.name}</span>
                  {m.direction === 'LOWER_BETTER' ? (
                    <span
                      className="ml-1.5 text-xs text-slate-400"
                      title="Chỉ số nghịch: giá trị thấp hơn là tốt hơn"
                    >
                      ↓ tốt
                    </span>
                  ) : null}
                </th>
                <td className="py-2.5 text-right tabular-nums font-medium text-slate-900 dark:text-slate-100">
                  {formatByUnit(m.actual, m.unit)}
                </td>
                <td className="py-2.5 text-right tabular-nums text-slate-500">
                  {formatByUnit(m.targetToDate, m.unit)}
                </td>
                <td className="py-2.5 text-right tabular-nums text-slate-500">
                  {formatByUnit(m.target, m.unit)}
                </td>
                <td className="w-48 py-2.5 pl-3">
                  <div className="flex items-center gap-2">
                    <ProgressBar attainment={m.attainment} className="flex-1" />
                    <span className="w-12 text-right text-xs tabular-nums text-slate-600 dark:text-slate-400">
                      {m.attainment === null ? EM_DASH : formatPercent(m.attainment, 0)}
                    </span>
                  </div>
                </td>
                <td className={clsx('py-2.5 text-right text-xs tabular-nums', TONE_CLASS[tone])}>
                  {m.delta === null ? EM_DASH : `${arrow} ${formatDelta(m.delta)}`}
                </td>
                <td className="py-2.5 text-center">
                  <StatusBadge status={kpiStatus(m.attainment)} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
