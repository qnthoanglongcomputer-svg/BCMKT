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
import { EM_DASH, formatCompact, formatCurrency, formatDateShort } from '@/lib/format'

export interface SpendRevenuePoint {
  date: string
  spend: number
  revenue: number
}

/**
 * Biểu đồ chi phí và doanh thu theo ngày, dùng **hai trục Y riêng**.
 *
 * Doanh thu thường gấp nhiều lần chi phí (ROAS cao), nên nếu vẽ chung một trục
 * thì đường chi phí bị ép sát đáy, không đọc được biến động. Mỗi chuỗi có trục
 * và thang màu riêng: chi phí (xanh) bên trái, doanh thu (xanh lá) bên phải.
 */
export function SpendRevenueChart({
  data,
  ariaLabel,
}: {
  data: SpendRevenuePoint[]
  ariaLabel: string
}) {
  return (
    <div style={{ minHeight: CHART_MIN_HEIGHT }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={CHART_MIN_HEIGHT}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
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
            yAxisId="spend"
            orientation="left"
            tickFormatter={(v: number) => formatCompact(v)}
            tick={{ ...AXIS_STYLE, fill: CHART_COLORS.actual }}
            tickLine={false}
            axisLine={false}
            width={48}
            label={{ value: 'Chi phí', position: 'insideTopLeft', offset: -4, fill: CHART_COLORS.actual, fontSize: 11 }}
          />
          <YAxis
            yAxisId="revenue"
            orientation="right"
            tickFormatter={(v: number) => formatCompact(v)}
            tick={{ ...AXIS_STYLE, fill: CHART_COLORS.positive }}
            tickLine={false}
            axisLine={false}
            width={52}
            label={{ value: 'Doanh thu', position: 'insideTopRight', offset: -4, fill: CHART_COLORS.positive, fontSize: 11 }}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelFormatter={(v) => formatDateShort(String(v))}
            formatter={(value, name) => [
              value === null || value === undefined ? EM_DASH : formatCurrency(Number(value)),
              name === 'spend' ? 'Chi phí' : 'Doanh thu',
            ]}
          />
          <Line
            yAxisId="spend"
            type="monotone"
            dataKey="spend"
            stroke={CHART_COLORS.actual}
            strokeWidth={2}
            dot={false}
            name="spend"
          />
          <Line
            yAxisId="revenue"
            type="monotone"
            dataKey="revenue"
            stroke={CHART_COLORS.positive}
            strokeWidth={2}
            dot={false}
            name="revenue"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
