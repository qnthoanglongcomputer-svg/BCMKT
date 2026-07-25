import Link from 'next/link'
import { KpiTile } from './KpiTile'
import { MetricTable } from './MetricTable'
import { StatusBadge } from './StatusBadge'
import { TrendChart } from '@/components/charts/TrendChart'
import { Card, EmptyState, PageHeader, buttonClass } from '@/components/ui/primitives'
import {
  EM_DASH,
  formatByUnit,
  formatDate,
  formatPercent,
  formatPeriod,
  formatScore,
  kpiStatus,
} from '@/lib/format'
import type { DepartmentDashboardData } from '@/server/dashboard/department'

/**
 * Khung dashboard dùng chung cho mọi bộ phận.
 *
 * Bố cục và tương tác giống hệt nhau giữa các bộ phận — chỉ khác tập chỉ số,
 * do `DEPARTMENT_METRICS` trong server/dashboard/department.ts quyết định.
 */
export function DepartmentDashboard({
  data,
  footer,
}: {
  data: DepartmentDashboardData
  /** Nội dung bổ sung chèn ở cuối, ví dụ khối thống kê kênh quảng cáo */
  footer?: React.ReactNode
}) {
  const { department, period, groups, trend, trendMetric, score, forecast, hasData } = data
  const headline = groups[0]?.metrics.slice(0, 6) ?? []

  return (
    <div className="mx-auto max-w-[1600px] p-4 lg:p-6">
      <PageHeader
        title={department.name}
        description={`${formatPeriod('MONTH', period.start)} · ${formatDate(period.start)}–${formatDate(period.end)} · đã qua ${period.elapsedDays}/${period.totalDays} ngày`}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">Điểm KPI</span>
            <span className="text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {score.value === null ? EM_DASH : formatScore(score.value)}
            </span>
            {score.grade ? (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                Hạng {score.grade}
              </span>
            ) : null}
          </div>
        }
      />

      {!hasData ? (
        <div className="space-y-4">
          <EmptyState
            title={`Chưa có dữ liệu KPI cho ${department.name}`}
            description="Bộ phận này chưa có kế hoạch KPI cho kỳ hiện tại. Thiết lập mục tiêu năm để hệ thống sinh mục tiêu xuống từng tháng, tuần và ngày."
            action={
              <Link href="/kpi/planning/new" className={buttonClass('primary')}>
                Thiết lập KPI
              </Link>
            }
          />
          {/* Thống kê kênh vẫn hiện dù bộ phận chưa có kế hoạch KPI */}
          {footer}
        </div>
      ) : (
        <div className="space-y-4">
          {headline.length > 0 ? (
            <section aria-label="Chỉ số chính">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {headline.map((m) => (
                  <KpiTile key={m.code} {...m} />
                ))}
              </div>
            </section>
          ) : null}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card
              className="xl:col-span-2"
              title={trendMetric ? `${trendMetric.name} theo ngày` : 'Xu hướng'}
              subtitle="Thực tế so với mục tiêu"
            >
              <TrendChart
                data={trend}
                unit={trendMetric?.unit ?? ''}
                ariaLabel={`Biểu đồ ${trendMetric?.name ?? 'chỉ số'} theo ngày của ${department.name}`}
              />
            </Card>

            <Card title="Dự báo cuối kỳ" subtitle={forecast?.metricName}>
              {forecast && forecast.value !== null ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {formatByUnit(forecast.value, trendMetric?.unit ?? '')}
                    </span>
                    <span className="text-sm text-slate-500">
                      / {formatByUnit(forecast.target, trendMetric?.unit ?? '')}
                    </span>
                    <StatusBadge status={kpiStatus(forecast.attainment)} />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Nếu giữ tốc độ hiện tại, cuối kỳ đạt{' '}
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {forecast.attainment === null ? EM_DASH : formatPercent(forecast.attainment)}
                    </span>{' '}
                    mục tiêu. Tính trên {period.elapsedDays} ngày dữ liệu.
                  </p>
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-slate-500">
                  {forecast?.reason ?? 'Chưa đủ dữ liệu để dự báo.'}
                </p>
              )}
            </Card>
          </div>

          {groups.map((group) => (
            <Card key={group.title} title={group.title}>
              <MetricTable metrics={group.metrics} />
            </Card>
          ))}

          {footer}
        </div>
      )}
    </div>
  )
}
