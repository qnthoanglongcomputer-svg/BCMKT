import { prisma } from '@/lib/prisma'
import { requireScope } from '@/server/auth/guard'
import { buildExportPayload } from '@/server/reports/export-data'
import { EM_DASH, formatByUnit, formatDate, formatPercent, formatScore } from '@/lib/format'

export const dynamic = 'force-dynamic'

/**
 * Bản in báo cáo. Người dùng dùng chức năng In của trình duyệt để lưu ra PDF.
 *
 * Chọn cách này thay vì render PDF phía server (Puppeteer/react-pdf) vì hai lý
 * do: font tiếng Việt trong PDF server-side phải nhúng file font riêng và rất
 * dễ mất dấu, còn Puppeteer kéo theo cả một bản Chromium. Bản in này dùng font
 * hệ thống nên dấu tiếng Việt luôn đúng.
 */
export default async function ReportPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ periodType?: string; anchor?: string; departmentId?: string }>
}) {
  const { user, scope } = await requireScope()
  const params = await searchParams

  const periodType = (['MONTH', 'QUARTER', 'YEAR'] as const).includes(
    params.periodType as 'MONTH',
  )
    ? (params.periodType as 'MONTH' | 'QUARTER' | 'YEAR')
    : 'MONTH'

  const now = new Date()
  const anchor = params.anchor ? new Date(`${params.anchor}T00:00:00Z`) : now

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { fullName: true },
  })

  const payload = await buildExportPayload(
    { periodType, anchor, departmentId: params.departmentId || undefined },
    scope,
    profile?.fullName ?? 'Không xác định',
    now,
  )

  return (
    <div className="mx-auto max-w-[900px] bg-white p-8 text-slate-900 print:p-0">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 14mm; }
          .no-print { display: none !important; }
          /* Không cắt đôi bảng giữa hai trang */
          table { break-inside: auto; }
          tr { break-inside: avoid; break-after: auto; }
          thead { display: table-header-group; }
        }
      `}</style>

      <div className="no-print mb-6 flex items-center justify-between rounded border border-slate-200 bg-slate-50 p-3">
        <p className="text-sm text-slate-600">
          Dùng chức năng In của trình duyệt (Ctrl+P) rồi chọn &ldquo;Lưu dưới dạng PDF&rdquo;.
        </p>
      </div>

      <header className="mb-6 border-b border-slate-300 pb-4">
        <h1 className="text-xl font-bold">{payload.meta.title}</h1>
        <table className="mt-3 text-sm">
          <tbody>
            <tr>
              <td className="pr-4 font-medium">Kỳ báo cáo</td>
              <td>
                {payload.meta.periodLabel} ({formatDate(payload.meta.periodStart)} –{' '}
                {formatDate(payload.meta.periodEnd)})
              </td>
            </tr>
            <tr>
              <td className="pr-4 font-medium">Phạm vi</td>
              <td>{payload.meta.departmentFilter}</td>
            </tr>
            <tr>
              <td className="pr-4 font-medium">Người xuất</td>
              <td>{payload.meta.generatedBy}</td>
            </tr>
            <tr>
              <td className="pr-4 font-medium">Thời điểm xuất</td>
              <td>
                {new Intl.DateTimeFormat('vi-VN', {
                  timeZone: 'Asia/Ho_Chi_Minh',
                  dateStyle: 'short',
                  timeStyle: 'short',
                }).format(payload.meta.generatedAt)}
              </td>
            </tr>
          </tbody>
        </table>
      </header>

      <section className="mb-6">
        <h2 className="mb-2 text-base font-semibold">Điểm KPI theo bộ phận</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-slate-400">
              <th className="py-1.5 text-left">Bộ phận</th>
              <th className="py-1.5 text-right">Điểm KPI</th>
              <th className="py-1.5 text-center">Xếp loại</th>
            </tr>
          </thead>
          <tbody>
            {payload.summary.map((s) => (
              <tr key={s.departmentName} className="border-b border-slate-200">
                <td className="py-1.5">{s.departmentName}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {s.score === null ? EM_DASH : formatScore(s.score)}
                </td>
                <td className="py-1.5 text-center">{s.grade ?? EM_DASH}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold">
          Chi tiết KPI ({payload.rows.length} dòng)
        </h2>
        {payload.rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            Không có dữ liệu KPI trong kỳ này.
          </p>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-slate-400">
                <th className="py-1.5 text-left">Bộ phận</th>
                <th className="py-1.5 text-left">Chỉ số</th>
                <th className="py-1.5 text-left">Chiều</th>
                <th className="py-1.5 text-right">Mục tiêu</th>
                <th className="py-1.5 text-right">Thực tế</th>
                <th className="py-1.5 text-right">% đạt</th>
              </tr>
            </thead>
            <tbody>
              {payload.rows.map((row, i) => (
                <tr key={`${row.departmentName}-${row.metricCode}-${i}`} className="border-b border-slate-200">
                  <td className="py-1.5">{row.departmentName}</td>
                  <td className="py-1.5">{row.metricName}</td>
                  <td className="py-1.5 text-slate-500">{row.direction}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {formatByUnit(row.target, row.unit)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {formatByUnit(row.actual, row.unit)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {row.attainment === null ? EM_DASH : formatPercent(row.attainment)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer className="mt-8 border-t border-slate-300 pt-3 text-xs text-slate-500">
        MPMS — Hệ thống quản trị hiệu suất Marketing. Giá trị {EM_DASH} nghĩa là chưa xác định
        (chưa có dữ liệu hoặc mẫu số bằng 0), không phải bằng 0.
      </footer>
    </div>
  )
}
