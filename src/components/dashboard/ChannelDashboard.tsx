import Link from 'next/link'
import { TrendChart } from '@/components/charts/TrendChart'
import { Card, EmptyState, PageHeader, buttonClass } from '@/components/ui/primitives'
import {
  EM_DASH,
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  formatNumber,
  formatPercent,
  formatPeriod,
} from '@/lib/format'
import type { ChannelDashboardData, ChannelRow } from '@/server/dashboard/channels'

/**
 * Dashboard hiệu quả kênh quảng cáo (Facebook, Google, TikTok, Zalo, Cốc Cốc).
 *
 * Trả lời trong 5 giây: kênh nào tiêu nhiều nhất, kênh nào hiệu quả nhất (ROAS),
 * lead và đơn về từ đâu.
 */
export function ChannelDashboard({
  data,
  canManage,
}: {
  data: ChannelDashboardData
  canManage: boolean
}) {
  const { period, total, channels, trend, hasData } = data

  return (
    <div className="mx-auto max-w-[1600px] p-4 lg:p-6">
      <PageHeader
        title="Hiệu quả kênh quảng cáo"
        description={`${formatPeriod('MONTH', period.start)} · ${formatDate(period.start)}–${formatDate(period.end)} · đã qua ${period.elapsedDays}/${period.totalDays} ngày`}
        actions={
          canManage ? (
            <Link href="/ads" className={buttonClass('primary')}>
              Nhập số liệu
            </Link>
          ) : null
        }
      />

      {!hasData ? (
        <EmptyState
          title="Chưa có số liệu quảng cáo cho kỳ này"
          description="Nhập số liệu chi phí, hiển thị, click, lead và đơn hàng theo từng kênh để hệ thống tính hiệu quả (CPC, CTR, ROAS, tỷ lệ chuyển đổi)."
          action={
            canManage ? (
              <Link href="/ads" className={buttonClass('primary')}>
                Nhập số liệu quảng cáo
              </Link>
            ) : null
          }
        />
      ) : (
        <div className="space-y-4">
          <section aria-label="Tổng hợp toàn kênh">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Tile label="Chi phí" value={formatCurrencyCompact(total.spend.toString())} />
              <Tile label="Doanh thu" value={formatCurrencyCompact(total.revenue.toString())} />
              <Tile
                label="ROAS"
                value={total.roas === null ? EM_DASH : `${total.roas.toDecimalPlaces(2)}×`}
                emphasis
              />
              <Tile label="Lead" value={formatNumber(total.leads)} />
              <Tile label="Đơn" value={formatNumber(total.orders)} />
              <Tile
                label="CPC"
                value={total.cpc === null ? EM_DASH : formatCurrencyCompact(total.cpc.toFixed(0))}
              />
            </div>
          </section>

          <Card
            title="Chi phí & doanh thu theo ngày"
            subtitle="Toàn bộ kênh cộng dồn"
          >
            <TrendChart
              data={trend.map((d) => ({ date: d.date, actual: d.spend, target: d.revenue }))}
              unit="VND"
              ariaLabel="Biểu đồ chi phí và doanh thu quảng cáo theo ngày"
            />
            <p className="mt-2 text-xs text-slate-400">
              Đường liền: chi phí · đường nét đứt: doanh thu
            </p>
          </Card>

          <Card
            title="So sánh theo kênh"
            subtitle="Sắp xếp theo chi phí giảm dần"
          >
            <ChannelTable channels={channels} />
          </Card>
        </div>
      )}
    </div>
  )
}

function ChannelTable({ channels }: { channels: ChannelRow[] }) {
  // Kênh chưa có chi phí xuống cuối; còn lại sắp theo chi phí giảm dần.
  const sorted = [...channels].sort((a, b) => {
    const sa = a.metrics.spend.toNumber()
    const sb = b.metrics.spend.toNumber()
    return sb - sa
  })

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Hiệu quả từng kênh quảng cáo</caption>
        <thead>
          <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800">
            <th scope="col" className="pb-2 text-left font-medium">Kênh</th>
            <th scope="col" className="pb-2 text-right font-medium">Chi phí</th>
            <th scope="col" className="pb-2 text-right font-medium">Doanh thu</th>
            <th scope="col" className="pb-2 text-right font-medium">Hiển thị</th>
            <th scope="col" className="pb-2 text-right font-medium">CPC</th>
            <th scope="col" className="pb-2 text-right font-medium">CTR</th>
            <th scope="col" className="pb-2 text-right font-medium">Lead</th>
            <th scope="col" className="pb-2 text-right font-medium">Đơn</th>
            <th scope="col" className="pb-2 text-right font-medium" title="Lead / Click">CR lead</th>
            <th scope="col" className="pb-2 text-right font-medium" title="Đơn / Lead">CR đơn</th>
            <th scope="col" className="pb-2 text-right font-medium">ROAS</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const m = row.metrics
            const noData = m.spend.isZero() && m.impressions === 0
            return (
              <tr
                key={row.platform}
                className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${noData ? 'opacity-50' : ''}`}
              >
                <th scope="row" className="py-2.5 pr-3 text-left font-normal">
                  <div className="relative">
                    {/* Thanh nền tỷ trọng chi phí — đọc nhanh kênh nào tốn nhất */}
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 left-0 -z-0 rounded bg-blue-50 dark:bg-blue-950/40"
                      style={{ width: `${Math.round(row.spendShare * 100)}%` }}
                    />
                    <span className="relative text-slate-800 dark:text-slate-200">{row.label}</span>
                  </div>
                </th>
                <td className="py-2.5 text-right tabular-nums font-medium text-slate-900 dark:text-slate-100">
                  {formatCurrency(m.spend.toString())}
                </td>
                <td className="py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                  {formatCurrency(m.revenue.toString())}
                </td>
                <td className="py-2.5 text-right tabular-nums text-slate-500">
                  {formatNumber(m.impressions)}
                </td>
                <td className="py-2.5 text-right tabular-nums text-slate-500">
                  {m.cpc === null ? EM_DASH : formatCurrency(m.cpc.toFixed(0))}
                </td>
                <td className="py-2.5 text-right tabular-nums text-slate-500">
                  {m.ctr === null ? EM_DASH : formatPercent(m.ctr.toNumber())}
                </td>
                <td className="py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                  {formatNumber(m.leads)}
                </td>
                <td className="py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                  {formatNumber(m.orders)}
                </td>
                <td className="py-2.5 text-right tabular-nums text-slate-500">
                  {m.crLead === null ? EM_DASH : formatPercent(m.crLead.toNumber())}
                </td>
                <td className="py-2.5 text-right tabular-nums text-slate-500">
                  {m.crOrder === null ? EM_DASH : formatPercent(m.crOrder.toNumber())}
                </td>
                <td className="py-2.5 text-right tabular-nums font-medium text-slate-900 dark:text-slate-100">
                  {m.roas === null ? EM_DASH : `${m.roas.toDecimalPlaces(2)}×`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
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
        className={`mt-1 tabular-nums font-semibold text-slate-900 dark:text-slate-100 ${emphasis ? 'text-2xl' : 'text-lg'}`}
      >
        {value}
      </div>
    </div>
  )
}
