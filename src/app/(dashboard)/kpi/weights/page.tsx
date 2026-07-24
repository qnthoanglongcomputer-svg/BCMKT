import Link from 'next/link'
import Decimal from 'decimal.js'
import { listWeightGroups } from '@/server/kpi/weight-service'
import { Card, EmptyState, ErrorState, PageHeader, buttonClass } from '@/components/ui/primitives'
import { formatPercentValue } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function WeightGroupListPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const params = await searchParams
  const year = Number(params.year) || new Date().getUTCFullYear()

  let groups: Awaited<ReturnType<typeof listWeightGroups>>
  try {
    groups = await listWeightGroups(year)
  } catch (error) {
    console.error('Không tải được nhóm trọng số:', error)
    return (
      <div className="mx-auto max-w-[1600px] p-4 lg:p-6">
        <ErrorState message="Kiểm tra kết nối cơ sở dữ liệu rồi tải lại trang." />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1600px] p-4 lg:p-6">
      <PageHeader
        title="Trọng số KPI"
        description={`Năm ${year} · ${groups.length} nhóm. Mỗi vị trí có bộ chỉ số và trọng số riêng để chấm điểm.`}
        actions={
          <Link href="/kpi/weights/new" className={buttonClass('primary')}>
            Thêm nhóm
          </Link>
        }
      />

      {groups.length === 0 ? (
        <EmptyState
          title={`Chưa có nhóm trọng số nào cho năm ${year}`}
          description="Không có trọng số thì không chấm được điểm KPI. Mỗi vị trí cần một nhóm với tổng trọng số bằng 100%."
          action={
            <Link href="/kpi/weights/new" className={buttonClass('primary')}>
              Tạo nhóm trọng số
            </Link>
          }
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Danh sách nhóm trọng số năm {year}</caption>
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800">
                  <th scope="col" className="pb-2 text-left font-medium">Nhóm</th>
                  <th scope="col" className="pb-2 text-left font-medium">Vị trí</th>
                  <th scope="col" className="pb-2 text-left font-medium">Bộ phận</th>
                  <th scope="col" className="pb-2 text-right font-medium">Số chỉ số</th>
                  <th scope="col" className="pb-2 text-right font-medium">Tổng trọng số</th>
                  <th scope="col" className="pb-2 text-right font-medium">
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => {
                  const total = new Decimal(group.totalWeight)
                  const ok = total.minus(1).abs().lte('0.0001')
                  return (
                    <tr
                      key={group.id}
                      className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                    >
                      <td className="py-2.5 text-slate-800 dark:text-slate-200">{group.name}</td>
                      <td className="py-2.5 text-slate-600 dark:text-slate-400">
                        {group.positionName}
                      </td>
                      <td className="py-2.5 text-slate-600 dark:text-slate-400">
                        {group.departmentName}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {group.metricCount}
                      </td>
                      <td
                        className={`py-2.5 text-right tabular-nums font-medium ${
                          ok
                            ? 'text-slate-900 dark:text-slate-100'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                        title={ok ? undefined : 'Tổng khác 100% — không chấm điểm đúng được'}
                      >
                        {formatPercentValue(total.times(100).toNumber())}
                        {ok ? '' : ' ⚠'}
                      </td>
                      <td className="py-2.5 text-right">
                        <Link
                          href={`/kpi/weights/${group.id}`}
                          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                        >
                          Sửa
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
