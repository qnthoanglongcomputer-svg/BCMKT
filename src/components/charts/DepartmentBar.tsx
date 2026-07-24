import { StatusBadge } from '@/components/kpi/StatusBadge'
import { ProgressBar } from '@/components/kpi/ProgressBar'
import { EM_DASH, formatPercent, formatScore, kpiStatus } from '@/lib/format'

export interface DepartmentRow {
  code: string
  name: string
  score: number | null
  attainment: number | null
}

/**
 * So sánh hiệu suất giữa các bộ phận.
 *
 * Dùng bảng có thanh nền thay vì biểu đồ cột: với ≤ 6 nhóm, bảng đọc nhanh hơn,
 * hiển thị được cả điểm số lẫn nhãn trạng thái, và không cần JS ở client.
 */
export function DepartmentBar({ rows }: { rows: DepartmentRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-500">
        Chưa có bộ phận nào để so sánh.
      </p>
    )
  }

  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Hiệu suất theo bộ phận</caption>
      <thead>
        <tr className="text-xs text-slate-500 dark:text-slate-400">
          <th scope="col" className="pb-2 text-left font-medium">Bộ phận</th>
          <th scope="col" className="pb-2 text-right font-medium">Điểm</th>
          <th scope="col" className="pb-2 pl-3 text-left font-medium">Tiến độ</th>
          <th scope="col" className="pb-2 text-center font-medium">Trạng thái</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.code} className="border-t border-slate-100 dark:border-slate-800">
            <th scope="row" className="py-2.5 pr-3 text-left font-normal text-slate-800 dark:text-slate-200">
              {row.name}
            </th>
            <td className="py-2.5 text-right tabular-nums font-medium text-slate-900 dark:text-slate-100">
              {row.score === null ? EM_DASH : formatScore(row.score)}
            </td>
            <td className="w-1/2 py-2.5 pl-3">
              <div className="flex items-center gap-2">
                <ProgressBar attainment={row.attainment} className="flex-1" />
                <span className="w-12 text-right text-xs tabular-nums text-slate-500">
                  {row.attainment === null ? EM_DASH : formatPercent(row.attainment, 0)}
                </span>
              </div>
            </td>
            <td className="py-2.5 text-center">
              <StatusBadge status={kpiStatus(row.attainment)} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
