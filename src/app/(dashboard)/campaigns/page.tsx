import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireScope } from '@/server/auth/guard'
import { listCampaigns } from '@/server/campaigns/campaign-service'
import { CampaignDialog } from '@/components/org/CampaignDialog'
import { Card, EmptyState, ErrorState, PageHeader, buttonClass } from '@/components/ui/primitives'
import { EM_DASH, formatCurrencyCompact, formatDate, formatNumber, formatPercent } from '@/lib/format'

export const dynamic = 'force-dynamic'

function toInputDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export default async function CampaignsPage() {
  const { user } = await requireScope()
  // Chi phí, doanh thu và ROI toàn chiến dịch là dữ liệu điều hành —
  // nhân viên chỉ xem KPI cá nhân (đặc tả mục 20).
  if (user.role === 'EMPLOYEE') notFound()

  const canManage = user.role === 'ADMIN' || user.role === 'MARKETING_MANAGER'

  let campaigns: Awaited<ReturnType<typeof listCampaigns>>
  try {
    campaigns = await listCampaigns()
  } catch (error) {
    console.error('Không tải được danh sách chiến dịch:', error)
    return (
      <div className="mx-auto max-w-[1600px] p-4 lg:p-6">
        <ErrorState message="Kiểm tra kết nối cơ sở dữ liệu rồi tải lại trang." />
      </div>
    )
  }

  const overBudget = campaigns.filter((c) => c.metrics.overBudget).length

  return (
    <div className="mx-auto max-w-[1600px] p-4 lg:p-6">
      <PageHeader
        title="Chiến dịch"
        description={
          `${campaigns.length} chiến dịch` +
          (overBudget > 0 ? ` · ${overBudget} chiến dịch vượt ngân sách` : '')
        }
        actions={
          canManage ? (
            <CampaignDialog
              trigger={<button className={buttonClass('primary')}>Thêm chiến dịch</button>}
            />
          ) : null
        }
      />

      {campaigns.length === 0 ? (
        <EmptyState
          title="Chưa có chiến dịch nào"
          description="Gắn báo cáo và dữ liệu quảng cáo vào chiến dịch để hệ thống tính được ROI, chi phí và đóng góp của từng bộ phận."
          action={
            canManage ? (
              <CampaignDialog
                trigger={<button className={buttonClass('primary')}>Tạo chiến dịch</button>}
              />
            ) : null
          }
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Danh sách chiến dịch, sắp xếp theo ROI giảm dần</caption>
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800">
                  <th scope="col" className="pb-2 text-left font-medium">Chiến dịch</th>
                  <th scope="col" className="pb-2 text-left font-medium">Thời gian</th>
                  <th scope="col" className="pb-2 text-right font-medium">Ngân sách</th>
                  <th scope="col" className="pb-2 text-right font-medium">Đã chi</th>
                  <th scope="col" className="pb-2 text-right font-medium">Doanh thu</th>
                  <th scope="col" className="pb-2 text-right font-medium">ROI</th>
                  <th scope="col" className="pb-2 text-right font-medium">Lead</th>
                  <th scope="col" className="pb-2 text-right font-medium">CPA</th>
                  <th scope="col" className="pb-2 text-center font-medium">Trạng thái</th>
                  <th scope="col" className="pb-2 text-right font-medium">
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <td className="py-2.5">
                      <Link
                        href={`/campaigns/${c.id}`}
                        className="text-slate-800 hover:text-blue-600 hover:underline dark:text-slate-200 dark:hover:text-blue-400"
                      >
                        {c.name}
                      </Link>
                      <div className="font-mono text-xs text-slate-400">{c.code}</div>
                    </td>
                    <td className="py-2.5 text-xs text-slate-500">
                      {formatDate(c.startDate)} – {formatDate(c.endDate)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-400">
                      {c.budget === null ? EM_DASH : formatCurrencyCompact(c.budget)}
                    </td>
                    <td
                      className={`py-2.5 text-right tabular-nums ${
                        c.metrics.overBudget
                          ? 'font-medium text-rose-600 dark:text-rose-400'
                          : 'text-slate-800 dark:text-slate-200'
                      }`}
                      title={
                        c.metrics.budgetUsage
                          ? `Đã dùng ${formatPercent(c.metrics.budgetUsage.toNumber())} ngân sách`
                          : undefined
                      }
                    >
                      {formatCurrencyCompact(c.metrics.spend.toString())}
                      {c.metrics.overBudget ? ' ⚠' : ''}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-slate-800 dark:text-slate-200">
                      {formatCurrencyCompact(c.metrics.revenue.toString())}
                    </td>
                    <td className="py-2.5 text-right tabular-nums font-medium text-slate-900 dark:text-slate-100">
                      {c.metrics.roi === null ? EM_DASH : `${c.metrics.roi.toDecimalPlaces(2)}×`}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-400">
                      {formatNumber(c.metrics.leads)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-400">
                      {c.metrics.cpa === null ? EM_DASH : formatCurrencyCompact(c.metrics.cpa.toFixed(0))}
                    </td>
                    <td className="py-2.5 text-center">
                      <span
                        className={
                          c.isActive
                            ? 'rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }
                      >
                        {c.isActive ? 'Đang chạy' : 'Đã dừng'}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      {canManage ? (
                        <CampaignDialog
                          current={{
                            id: c.id,
                            code: c.code,
                            name: c.name,
                            startDate: toInputDate(c.startDate),
                            endDate: toInputDate(c.endDate),
                            budget: c.budget,
                            isActive: c.isActive,
                          }}
                          trigger={
                            <button className="text-sm text-blue-600 hover:underline dark:text-blue-400">
                              Sửa
                            </button>
                          }
                        />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-slate-400">
            Chi phí gồm cả chi phí quảng cáo đồng bộ từ nền tảng và chi phí nhập tay trong báo cáo
            đã duyệt. ROI = (doanh thu − chi phí) / chi phí; chưa có chi phí thì hiện {EM_DASH}.
          </p>
        </Card>
      )}
    </div>
  )
}
