import Link from 'next/link'
import { requireScope } from '@/server/auth/guard'
import { buildExportPayload } from '@/server/reports/export-data'
import { prisma } from '@/lib/prisma'
import { Alert, Card, ErrorState, PageHeader, buttonClass, inputClass } from '@/components/ui/primitives'
import { EM_DASH, formatByUnit, formatDate, formatPercent, formatScore } from '@/lib/format'

export const dynamic = 'force-dynamic'

const PERIOD_LABEL = {
  MONTH: 'Tháng',
  QUARTER: 'Quý',
  YEAR: 'Năm',
} as const

type PeriodKey = keyof typeof PERIOD_LABEL

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ periodType?: string; anchor?: string; departmentId?: string }>
}) {
  const { user, scope } = await requireScope()
  const params = await searchParams

  const periodType = (
    params.periodType && params.periodType in PERIOD_LABEL ? params.periodType : 'MONTH'
  ) as PeriodKey

  const today = new Date()
  const anchorStr =
    params.anchor ?? today.toISOString().slice(0, 10)
  const anchor = new Date(`${anchorStr}T00:00:00Z`)

  try {
    const [payload, departments, profile] = await Promise.all([
      buildExportPayload(
        { periodType, anchor, departmentId: params.departmentId || undefined },
        scope,
        'Xem trước',
        today,
      ),
      prisma.department.findMany({
        where: {
          deletedAt: null,
          ...(scope.departmentIds === null ? {} : { id: { in: scope.departmentIds } }),
        },
        select: { id: true, name: true, level: true },
        orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
      }),
      prisma.user.findUnique({ where: { id: user.id }, select: { fullName: true } }),
    ])

    const exportQuery = new URLSearchParams({ periodType, anchor: anchorStr })
    if (params.departmentId) exportQuery.set('departmentId', params.departmentId)

    return (
      <div className="mx-auto max-w-[1600px] p-4 lg:p-6">
        <PageHeader
          title="Báo cáo"
          description={`${payload.meta.periodLabel} · ${payload.meta.departmentFilter} · ${payload.rows.length} dòng dữ liệu`}
          actions={
            <>
              <Link
                href={`/reports/print?${exportQuery.toString()}`}
                target="_blank"
                className={buttonClass('secondary')}
              >
                Bản in / PDF
              </Link>
              <a
                href={`/api/reports/export?${exportQuery.toString()}`}
                className={buttonClass('primary')}
              >
                Tải Excel
              </a>
            </>
          }
        />

        <Card className="mb-4">
          <form method="get" action="/reports" className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Loại kỳ
              </span>
              <select name="periodType" defaultValue={periodType} className={inputClass}>
                {Object.entries(PERIOD_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Ngày trong kỳ
              </span>
              <input type="date" name="anchor" defaultValue={anchorStr} className={inputClass} />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Bộ phận
              </span>
              <select
                name="departmentId"
                defaultValue={params.departmentId ?? ''}
                className={inputClass}
              >
                <option value="">Toàn bộ phạm vi</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {' '.repeat(d.level * 2)}
                    {d.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end">
              <button type="submit" className={buttonClass('primary')}>
                Áp dụng
              </button>
            </div>
          </form>
        </Card>

        <div className="mb-4">
          <Alert tone="info">
            Dữ liệu trong báo cáo được giới hạn theo phạm vi của bạn
            {profile?.fullName ? ` (${profile.fullName})` : ''}. Mỗi lần tải file đều được ghi vào
            nhật ký hệ thống.
          </Alert>
        </div>

        {payload.rows.length === 0 ? (
          <Card>
            <p className="py-10 text-center text-sm text-slate-500">
              Không có dữ liệu KPI cho kỳ này trong phạm vi của bạn. File xuất ra sẽ chỉ có phần
              tiêu đề.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card title="Điểm KPI theo bộ phận" subtitle={payload.meta.periodLabel}>
              <table className="w-full text-sm">
                <caption className="sr-only">Điểm KPI từng bộ phận</caption>
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800">
                    <th scope="col" className="pb-2 text-left font-medium">Bộ phận</th>
                    <th scope="col" className="pb-2 text-right font-medium">Điểm KPI</th>
                    <th scope="col" className="pb-2 text-center font-medium">Xếp loại</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.summary.map((s) => (
                    <tr key={s.departmentName} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                      <td className="py-2 text-slate-800 dark:text-slate-200">{s.departmentName}</td>
                      <td className="py-2 text-right tabular-nums">
                        {s.score === null ? EM_DASH : formatScore(s.score)}
                      </td>
                      <td className="py-2 text-center">{s.grade ?? EM_DASH}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <Card title="Chi tiết KPI" subtitle={`${payload.rows.length} dòng`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Chi tiết mục tiêu và thực tế từng chỉ số</caption>
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800">
                      <th scope="col" className="pb-2 text-left font-medium">Bộ phận</th>
                      <th scope="col" className="pb-2 text-left font-medium">Chỉ số</th>
                      <th scope="col" className="pb-2 text-right font-medium">Mục tiêu</th>
                      <th scope="col" className="pb-2 text-right font-medium">Thực tế</th>
                      <th scope="col" className="pb-2 text-right font-medium">% đạt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.rows.slice(0, 100).map((row, i) => (
                      <tr
                        key={`${row.departmentName}-${row.metricCode}-${i}`}
                        className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                      >
                        <td className="py-2 text-slate-700 dark:text-slate-300">{row.departmentName}</td>
                        <td className="py-2 text-slate-800 dark:text-slate-200">{row.metricName}</td>
                        <td className="py-2 text-right tabular-nums">
                          {formatByUnit(row.target, row.unit)}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {formatByUnit(row.actual, row.unit)}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {row.attainment === null ? EM_DASH : formatPercent(row.attainment)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {payload.rows.length > 100 ? (
                <p className="mt-3 text-xs text-slate-400">
                  Đang hiện 100 dòng đầu. File Excel chứa đủ {payload.rows.length} dòng.
                </p>
              ) : null}
            </Card>
          </div>
        )}

        <p className="mt-4 text-xs text-slate-400">
          Kỳ: {formatDate(payload.meta.periodStart)} – {formatDate(payload.meta.periodEnd)}
        </p>
      </div>
    )
  } catch (error) {
    console.error('Không tải được dữ liệu báo cáo:', error)
    return (
      <div className="mx-auto max-w-[1600px] p-4 lg:p-6">
        <ErrorState message="Kiểm tra kết nối cơ sở dữ liệu rồi tải lại trang." />
      </div>
    )
  }
}
