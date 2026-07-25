import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireScope } from '@/server/auth/guard'
import { getCampaign } from '@/server/campaigns/campaign-service'
import { TrendChart } from '@/components/charts/TrendChart'
import { ProgressBar } from '@/components/kpi/ProgressBar'
import { Alert, Card, PageHeader } from '@/components/ui/primitives'
import {
  EM_DASH,
  formatByUnit,
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  formatNumber,
  formatPercent,
} from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { user } = await requireScope()
  if (user.role === 'EMPLOYEE') notFound()

  const campaign = await getCampaign(id)

  if (!campaign) notFound()

  const { metrics } = campaign

  return (
    <div className="mx-auto max-w-[1600px] p-4 lg:p-6">
      <PageHeader
        title={campaign.name}
        description={`${campaign.code} · ${formatDate(campaign.startDate)} – ${formatDate(campaign.endDate)} · ${campaign.isActive ? 'đang chạy' : 'đã dừng'}`}
        actions={
          <Link href="/campaigns" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
            ← Danh sách chiến dịch
          </Link>
        }
      />

      {metrics.overBudget ? (
        <div className="mb-4">
          <Alert tone="error">
            Chiến dịch đã dùng{' '}
            <strong>{formatPercent(metrics.budgetUsage?.toNumber() ?? 0)}</strong> ngân sách
            ({formatCurrency(metrics.spend.toString())} / {formatCurrency(campaign.budget ?? '0')}).
          </Alert>
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <Tile label="Chi phí" value={formatCurrencyCompact(metrics.spend.toString())} />
          <Tile label="Doanh thu" value={formatCurrencyCompact(metrics.revenue.toString())} />
          <Tile
            label="ROI"
            value={metrics.roi === null ? EM_DASH : `${metrics.roi.toDecimalPlaces(2)}×`}
            emphasis
          />
          <Tile
            label="ROAS"
            value={metrics.roas === null ? EM_DASH : `${metrics.roas.toDecimalPlaces(2)}×`}
          />
          <Tile label="Lead" value={formatNumber(metrics.leads)} />
          <Tile
            label="CPA"
            value={metrics.cpa === null ? EM_DASH : formatCurrencyCompact(metrics.cpa.toFixed(0))}
          />
        </div>

        {campaign.budget ? (
          <Card title="Tiến độ ngân sách">
            <div className="flex items-center gap-3">
              <ProgressBar attainment={metrics.budgetUsage?.toNumber() ?? null} className="flex-1" />
              <span className="w-40 text-right text-sm tabular-nums text-slate-700 dark:text-slate-300">
                {formatCurrency(metrics.spend.toString())} / {formatCurrency(campaign.budget)}
              </span>
            </div>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card
            className="xl:col-span-2"
            title="Chi phí và doanh thu theo ngày"
            subtitle="Nguồn: dữ liệu quảng cáo đã đồng bộ"
          >
            {campaign.daily.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">
                Chưa có dữ liệu quảng cáo cho chiến dịch này. Dữ liệu sẽ xuất hiện sau khi kết nối
                nền tảng quảng cáo và chạy đồng bộ.
              </p>
            ) : (
              <TrendChart
                data={campaign.daily.map((d) => ({
                  date: d.date,
                  actual: d.spend,
                  target: d.revenue,
                }))}
                unit="VND"
                ariaLabel={`Biểu đồ chi phí và doanh thu theo ngày của chiến dịch ${campaign.name}`}
              />
            )}
          </Card>

          <Card title="Theo nền tảng" subtitle="Chi phí và hiệu quả từng kênh">
            {campaign.platforms.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">
                Chưa có dữ liệu quảng cáo.
              </p>
            ) : (
              <table className="w-full text-sm">
                <caption className="sr-only">Chi phí theo nền tảng quảng cáo</caption>
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800">
                    <th scope="col" className="pb-2 text-left font-medium">Nền tảng</th>
                    <th scope="col" className="pb-2 text-right font-medium">Chi phí</th>
                    <th scope="col" className="pb-2 text-right font-medium">Lead</th>
                    <th scope="col" className="pb-2 text-right font-medium">CPA</th>
                  </tr>
                </thead>
                <tbody>
                  {campaign.platforms.map((p) => (
                    <tr key={p.platform} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                      <td className="py-2 text-slate-800 dark:text-slate-200">{p.platform}</td>
                      <td className="py-2 text-right tabular-nums">{formatCurrencyCompact(p.spend)}</td>
                      <td className="py-2 text-right tabular-nums">{formatNumber(p.leads)}</td>
                      <td className="py-2 text-right tabular-nums">
                        {p.cpa === null ? EM_DASH : formatCurrencyCompact(p.cpa)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <Card
          title="Đóng góp theo bộ phận"
          subtitle="Tổng hợp từ báo cáo đã duyệt gắn với chiến dịch này"
        >
          {campaign.contributions.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              Chưa có báo cáo nào đã duyệt gắn với chiến dịch này.
            </p>
          ) : (
            <table className="w-full text-sm">
              <caption className="sr-only">Đóng góp của từng bộ phận vào chiến dịch</caption>
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800">
                  <th scope="col" className="pb-2 text-left font-medium">Bộ phận</th>
                  <th scope="col" className="pb-2 text-left font-medium">Chỉ số</th>
                  <th scope="col" className="pb-2 text-right font-medium">Giá trị</th>
                </tr>
              </thead>
              <tbody>
                {campaign.contributions.map((c, i) => (
                  <tr key={`${c.departmentName}-${c.metricName}-${i}`} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <td className="py-2 text-slate-800 dark:text-slate-200">{c.departmentName}</td>
                    <td className="py-2 text-slate-600 dark:text-slate-400">{c.metricName}</td>
                    <td className="py-2 text-right tabular-nums text-slate-900 dark:text-slate-100">
                      {formatByUnit(c.value, c.unit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  )
}

function Tile({
  label,
  value,
  emphasis,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div
        className={`mt-1 tabular-nums font-semibold text-slate-900 dark:text-slate-100 ${
          emphasis ? 'text-2xl' : 'text-lg'
        }`}
      >
        {value}
      </div>
    </div>
  )
}
