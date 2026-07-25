'use client'

import { useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AXIS_STYLE, CHART_COLORS, CHART_GRID, CHART_MIN_HEIGHT, TOOLTIP_STYLE } from './chart-theme'
import { EM_DASH, formatCompact, formatCurrency, formatNumber } from '@/lib/format'

export interface AdsMetricPoint {
  date: string
  spend: number
  revenue: number
  leads: number
  clicks: number
}

type MetricKey = 'spend' | 'revenue' | 'leads' | 'clicks'

const METRICS: Array<{
  key: MetricKey
  label: string
  color: string
  isMoney: boolean
}> = [
  { key: 'spend', label: 'Chi phí', color: CHART_COLORS.actual, isMoney: true },
  { key: 'revenue', label: 'Doanh thu', color: CHART_COLORS.positive, isMoney: true },
  { key: 'leads', label: 'Lead', color: CHART_COLORS.warning, isMoney: false },
  { key: 'clicks', label: 'Click', color: '#7c3aed', isMoney: false },
]

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

/**
 * Biểu đồ xu hướng quảng cáo theo ngày, cho **chọn một chỉ số tại một thời điểm**.
 *
 * Chi phí, doanh thu, lead và click có thang đo chênh nhau hàng chục lần — vẽ
 * chung một trục thì đường nhỏ bị đè bẹp. Nút chọn cho mỗi chỉ số vẽ riêng trên
 * thang tự động của nó, đọc rõ biến động từng chỉ số.
 */
export function AdsMetricChart({
  data,
  ariaLabel,
}: {
  data: AdsMetricPoint[]
  ariaLabel: string
}) {
  const [selected, setSelected] = useState<MetricKey>('spend')
  const metric = METRICS.find((m) => m.key === selected) as (typeof METRICS)[number]

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Chọn chỉ số">
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={selected === m.key}
            onClick={() => setSelected(m.key)}
            className={
              selected === m.key
                ? 'rounded-md px-2.5 py-1 text-xs font-medium text-white'
                : 'rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
            }
            style={selected === m.key ? { backgroundColor: m.color } : undefined}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div style={{ minHeight: CHART_MIN_HEIGHT }} role="img" aria-label={`${ariaLabel} — ${metric.label}`}>
        <ResponsiveContainer width="100%" height={CHART_MIN_HEIGHT}>
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
            <defs>
              <linearGradient id="adsMetricFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={metric.color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={metric.color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              tick={AXIS_STYLE}
              tickLine={false}
              axisLine={{ stroke: CHART_GRID }}
              minTickGap={24}
            />
            <YAxis
              tickFormatter={(v: number) => formatCompact(v)}
              tick={{ ...AXIS_STYLE, fill: metric.color }}
              tickLine={false}
              axisLine={false}
              width={48}
              label={{ value: metric.label, position: 'insideTopLeft', offset: -4, fill: metric.color, fontSize: 11 }}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelFormatter={(v) => shortDate(String(v))}
              formatter={(value) => [
                value === null || value === undefined
                  ? EM_DASH
                  : metric.isMoney
                    ? formatCurrency(Number(value))
                    : formatNumber(Number(value)),
                metric.label,
              ]}
            />
            <Area
              type="monotone"
              dataKey={selected}
              stroke={metric.color}
              strokeWidth={2}
              fill="url(#adsMetricFill)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
