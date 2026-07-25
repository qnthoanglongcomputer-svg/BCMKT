import Link from 'next/link'
import { Card } from '@/components/ui/primitives'
import { EM_DASH, formatCurrency, formatCurrencyCompact, formatNumber, formatPercent } from '@/lib/format'
import type { ChannelMetrics } from '@/server/dashboard/channel-metrics'
import type { ChannelRow } from '@/server/dashboard/channels'

/**
 * Thống kê đầy đủ các kênh quảng cáo cho dashboard bộ phận Performance.
 *
 * Liệt kê cả 5 kênh (Facebook, Google, TikTok, Zalo, Cốc Cốc), đánh dấu kênh
 * nào đang chạy (có chi phí trong kỳ) và kênh nào dừng, kèm chỉ số hiệu quả
 * đặc thù quảng cáo theo đặc tả mục 7: chi phí, doanh thu, CPC, CTR, CPA, AOV,
 * ROS, ROAS, lead, đơn.
 */
export function ChannelStatsSection({
  channels,
  total,
  canManage,
}: {
  channels: ChannelRow[]
  total: ChannelMetrics
  canManage: boolean
}) {
  const active = channels.filter((c) => !c.metrics.spend.isZero())
  const activeCount = active.length

  if (activeCount === 0) {
    return (
      <Card title="Kênh quảng cáo" subtitle="Chưa có kênh nào chạy trong kỳ">
        <p className="py-6 text-center text-sm text-slate-500">
          Chưa có số liệu quảng cáo trong kỳ.{' '}
          {canManage ? (
            <Link href="/ads" className="text-blue-600 hover:underline dark:text-blue-400">
              Nhập số liệu →
            </Link>
          ) : null}
        </p>
      </Card>
    )
  }

  // Kênh đang chạy lên trên, sắp theo chi phí giảm dần; kênh dừng xuống cuối.
  const sorted = [...channels].sort((a, b) => {
    const aActive = a.metrics.spend.isZero() ? 0 : 1
    const bActive = b.metrics.spend.isZero() ? 0 : 1
    if (aActive !== bActive) return bActive - aActive
    return b.metrics.spend.toNumber() - a.metrics.spend.toNumber()
  })

  return (
    <Card
      title="Kênh quảng cáo"
      subtitle={`${activeCount}/${channels.length} kênh đang chạy · tổng chi phí ${formatCurrencyCompact(total.spend.toString())} · ROAS ${total.roas === null ? EM_DASH : `${total.roas.toDecimalPlaces(2)}×`}`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Thống kê hiệu quả các kênh quảng cáo</caption>
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800">
              <th scope="col" className="pb-2 pr-4 text-left font-medium">Kênh</th>
              <th scope="col" className="pb-2 px-3 text-center font-medium">Trạng thái</th>
              <th scope="col" className="pb-2 px-3 text-right font-medium">Chi phí</th>
              <th scope="col" className="pb-2 px-3 text-right font-medium">Doanh thu</th>
              <th scope="col" className="pb-2 px-3 text-right font-medium">CPC</th>
              <th scope="col" className="pb-2 px-3 text-right font-medium">CTR</th>
              <th scope="col" className="pb-2 px-3 text-right font-medium">CPA</th>
              <th scope="col" className="pb-2 px-3 text-right font-medium">AOV</th>
              <th scope="col" className="pb-2 px-3 text-right font-medium">Lead</th>
              <th scope="col" className="pb-2 px-3 text-right font-medium">Đơn</th>
              <th scope="col" className="pb-2 px-3 text-right font-medium">ROAS</th>
              <th scope="col" className="pb-2 pl-3 text-right font-medium" title="Chi phí / Doanh thu">ROS</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const m = row.metrics
              const running = !m.spend.isZero()
              return (
                <tr
                  key={row.platform}
                  className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${running ? '' : 'opacity-50'}`}
                >
                  <th scope="row" className="py-2.5 pr-4 text-left font-normal text-slate-800 dark:text-slate-200">
                    {row.label}
                  </th>
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={
                        running
                          ? 'inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }
                    >
                      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${running ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      {running ? 'Đang chạy' : 'Dừng'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-medium text-slate-900 dark:text-slate-100">
                    {formatCurrency(m.spend.toString())}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                    {formatCurrency(m.revenue.toString())}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-slate-500">
                    {m.cpc === null ? EM_DASH : formatCurrency(m.cpc.toFixed(0))}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-slate-500">
                    {m.ctr === null ? EM_DASH : formatPercent(m.ctr.toNumber())}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-slate-500">
                    {m.cpa === null ? EM_DASH : formatCurrency(m.cpa.toFixed(0))}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-slate-500">
                    {m.aov === null ? EM_DASH : formatCurrency(m.aov.toFixed(0))}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                    {formatNumber(m.leads)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                    {formatNumber(m.orders)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-medium text-slate-900 dark:text-slate-100">
                    {m.roas === null ? EM_DASH : `${m.roas.toDecimalPlaces(2)}×`}
                  </td>
                  <td className="py-2.5 pl-3 text-right tabular-nums text-slate-500">
                    {m.ros === null ? EM_DASH : formatPercent(m.ros.toNumber())}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Kênh &ldquo;Dừng&rdquo; là kênh chưa có chi phí trong kỳ. Số liệu quảng cáo nhập tại{' '}
        <Link href="/ads" className="text-blue-600 hover:underline dark:text-blue-400">
          Số liệu quảng cáo
        </Link>
        .
      </p>
    </Card>
  )
}
