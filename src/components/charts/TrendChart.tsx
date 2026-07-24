'use client'

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AXIS_STYLE, CHART_COLORS, CHART_GRID, CHART_MIN_HEIGHT, TOOLTIP_STYLE } from './chart-theme'
import { EM_DASH, formatCompact, formatDateShort, formatNumber } from '@/lib/format'

export interface TrendPoint {
  date: string
  actual: number | null
  target: number | null
}

/**
 * Xu hướng theo thời gian: đường thực tế (liền) và đường mục tiêu (nét đứt).
 *
 * Ngày tương lai có `actual = null` — Recharts sẽ dừng đường ở đó thay vì kéo
 * về 0, tránh hiểu nhầm là kết quả bằng 0.
 */
export function TrendChart({
  data,
  unit,
  ariaLabel,
}: {
  data: TrendPoint[]
  unit: string
  ariaLabel: string
}) {
  return (
    <div style={{ minHeight: CHART_MIN_HEIGHT }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={CHART_MIN_HEIGHT}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
          <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(v: string) => formatDateShort(v)}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={{ stroke: CHART_GRID }}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={(v: number) => formatCompact(v)}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            width={48}
            label={{ value: unit, position: 'insideTopLeft', offset: -4, ...AXIS_STYLE }}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelFormatter={(v) => formatDateShort(String(v))}
            formatter={(value, name) => [
              value === null || value === undefined ? EM_DASH : formatNumber(Number(value)),
              name === 'actual' ? 'Thực tế' : 'Mục tiêu',
            ]}
          />
          <Line
            type="monotone"
            dataKey="target"
            stroke={CHART_COLORS.target}
            strokeDasharray="4 4"
            strokeWidth={1.5}
            dot={false}
            name="target"
          />
          <Line
            type="monotone"
            dataKey="actual"
            stroke={CHART_COLORS.actual}
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            name="actual"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
