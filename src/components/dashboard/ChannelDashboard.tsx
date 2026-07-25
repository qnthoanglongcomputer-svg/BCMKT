import Link from 'next/link'
import { TrendChart } from '@/components/charts/TrendChart'
import { RangeFilter } from './RangeFilter'
import { Card, EmptyState, PageHeader, buttonClass } from '@/components/ui/primitives'
import {
  EM_DASH,
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  formatDelta,
  formatNumber,
  formatPercent,
} from '@/lib/format'
import type {
  ChannelDashboardData,
  ChannelDelta,
  ChannelRow,
} from '@/server/dashboard/channels'

/**
 * Dashboard hiệu quả kênh quảng cáo (Facebook, Google, TikTok, Zalo, Cốc Cốc).
 *
 * Ba trục so sánh: thực tế trong kỳ, so kỳ liền trước (delta), và so kế hoạch
 * (% đạt). Bộ lọc kỳ nằm trên URL để chia sẻ và back/forward hoạt động.
 */
export function ChannelDashboard({
  data,
  canManage,
}: {
  data: ChannelDashboardData
  canManage: boolean
}) {
  const { range, previous, total, channels, trend, hasData } = data

  return (
    <div className="mx-auto max-w-[1600px] p-4 lg:p-6">
      <PageHeader
        title="Hiệu quả kênh quảng cáo"
        description={`${range.label} · ${range.days} ngày · so với ${formatDate(previous.from)}–${formatDate(previous.to)}`}
        actions={
          canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/ads" className={buttonClass('secondary')}>
                Nhập số liệu
              </Link>
              <Link href="/ads/plans" className={buttonClass('secondary')}>
                Đặt mục tiêu
              </Link>
            </div>
          ) : null
        }
      />

      <div className="mb-4">
        <RangeFilter
          preset={range.preset}
          from={range.from.toISOString().slice(0, 10)}
          to={range.to.toISOString().slice(0, 10)}
        />
      </div>

      {!hasData ? (
        <EmptyState
          title="Chưa có số liệu quảng cáo cho kỳ này"
          description="Nhập số liệu chi phí, hiển thị, click, lead và đơn hàng theo từng kênh để hệ thống tính hiệu quả (CPC, CTR, ROAS, tỷ lệ chuyển đổi) và so với kế hoạch."
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
              <Tile
                label="Chi phí"
                value={formatCurrencyCompact(total.metrics.spend.toString())}
                delta={total.previous.spend}
                planPct={ratio(total.metrics.spend.toNumber(), total.plan.spend)}
                /* Chi phí: tiêu ít hơn kế hoạch là tốt, nên chiều đảo */
                lowerBetter
              />
              <Tile
                label="Doanh thu"
                value={formatCurrencyCompact(total.metrics.revenue.toString())}
                delta={total.previous.revenue}
                planPct={ratio(total.metrics.revenue.toNumber(), total.plan.revenue)}
              />
              <Tile
                label="ROAS"
                value={total.metrics.roas === null ? EM_DASH : `${total.metrics.roas.toDecimalPlaces(2)}×`}
                delta={total.previous.roas}
                emphasis
              />
              <Tile
                label="Lead"
                value={formatNumber(total.metrics.leads)}
                delta={total.previous.leads}
                planPct={ratio(total.metrics.leads, total.plan.leads)}
              />
              <Tile
                label="Đơn"
                value={formatNumber(total.metrics.orders)}
                delta={total.previous.orders}
                planPct={ratio(total.metrics.orders, total.plan.orders)}
              />
              <Tile
                label="CPC"
                value={total.metrics.cpc === null ? EM_DASH : formatCurrencyCompact(total.metrics.cpc.toFixed(0))}
              />
            </div>
          </section>

          <Card title="Chi phí & doanh thu theo ngày" subtitle="Toàn bộ kênh cộng dồn">
            <TrendChart
              data={trend.map((d) => ({ date: d.date, actual: d.spend, target: d.revenue }))}
              unit="VND"
              ariaLabel="Biểu đồ chi phí và doanh thu quảng cáo theo ngày"
            />
            <p className="mt-2 text-xs text-slate-400">
              Đường liền: chi phí · đường nét đứt: doanh thu
            </p>
          </Card>

          <Card title="So sánh theo kênh" subtitle="Sắp xếp theo chi phí giảm dần">
            <ChannelTable channels={channels} />
          </Card>
        </div>
      )}
    </div>
  )
}

function ratio(value: number, target: number | null): number | null {
  if (target === null || target === 0) return null
  return value / target
}

function ChannelTable({ channels }: { channels: ChannelRow[] }) {
  const sorted = [...channels].sort((a, b) => b.metrics.spend.toNumber() - a.metrics.spend.toNumber())

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Hiệu quả từng kênh quảng cáo</caption>
        <thead>
          <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800">
            <th scope="col" className="pb-2 text-left font-medium">Kênh</th>
            <th scope="col" className="pb-2 text-right font-medium">Chi phí</th>
            <th scope="col" className="pb-2 text-right font-medium" title="So kế hoạch / so kỳ trước">
              CP: KH · Kỳ
            </th>
            <th scope="col" className="pb-2 text-right font-medium">Doanh thu</th>
            <th scope="col" className="pb-2 text-right font-medium" title="So kế hoạch / so kỳ trước">
              DT: KH · Kỳ
            </th>
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
                <td className="py-2.5 text-right">
                  <DeltaCell delta={row.spendDelta} lowerBetter />
                </td>
                <td className="py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                  {formatCurrency(m.revenue.toString())}
                </td>
                <td className="py-2.5 text-right">
                  <DeltaCell delta={row.revenueDelta} />
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
      <p className="mt-3 text-xs text-slate-400">
        Cột <strong>KH</strong>: % đạt so kế hoạch (mục tiêu tháng phân bổ theo số ngày đang xem).
        Cột <strong>Kỳ</strong>: thay đổi so kỳ liền trước cùng độ dài. {EM_DASH} nghĩa là chưa
        đặt kế hoạch hoặc kỳ trước không có dữ liệu.
      </p>
    </div>
  )
}

/** Ô nhỏ hiển thị "%đạt kế hoạch · Δ kỳ trước" trong bảng kênh. */
function DeltaCell({ delta, lowerBetter }: { delta: ChannelDelta; lowerBetter?: boolean }) {
  const planTone =
    delta.vsPlan === null
      ? 'text-slate-400'
      : lowerBetter
        ? delta.vsPlan <= 1
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-rose-600 dark:text-rose-400'
        : delta.vsPlan >= 1
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-amber-600 dark:text-amber-400'

  return (
    <span className="inline-flex flex-col items-end text-xs tabular-nums leading-tight">
      <span className={planTone} title="So kế hoạch">
        {delta.vsPlan === null ? EM_DASH : formatPercent(delta.vsPlan, 0)}
      </span>
      <PrevDelta value={delta.vsPrevious} lowerBetter={lowerBetter} />
    </span>
  )
}

function PrevDelta({ value, lowerBetter }: { value: number | null; lowerBetter?: boolean }) {
  if (value === null || value === 0) {
    return <span className="text-slate-400">{EM_DASH}</span>
  }
  const isUp = value > 0
  // Chi phí tăng là xấu (lowerBetter); doanh thu tăng là tốt.
  const good = lowerBetter ? !isUp : isUp
  const tone = good ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
  return (
    <span className={tone} title="So kỳ trước">
      {isUp ? '▲' : '▼'} {formatDelta(value)}
    </span>
  )
}

function Tile({
  label,
  value,
  delta,
  planPct,
  emphasis,
  lowerBetter,
}: {
  label: string
  value: string
  delta?: number | null
  planPct?: number | null
  emphasis?: boolean
  lowerBetter?: boolean
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div
        className={`mt-1 tabular-nums font-semibold text-slate-900 dark:text-slate-100 ${emphasis ? 'text-2xl' : 'text-lg'}`}
      >
        {value}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs">
        {delta !== undefined ? <PrevDelta value={delta ?? null} lowerBetter={lowerBetter} /> : null}
        {planPct !== undefined && planPct !== null ? (
          <span className="text-slate-400" title="So kế hoạch">
            KH {formatPercent(planPct, 0)}
          </span>
        ) : null}
      </div>
    </div>
  )
}
