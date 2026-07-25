import { Suspense } from 'react'
import { getOverview } from '@/server/dashboard/overview'
import { getChannelDashboard } from '@/server/dashboard/channels'
import { resolveDateRange } from '@/server/dashboard/date-range'
import { requireScope } from '@/server/auth/guard'
import { KpiTile } from '@/components/kpi/KpiTile'
import { StatusBadge } from '@/components/kpi/StatusBadge'
import { TrendChart } from '@/components/charts/TrendChart'
import { DepartmentBar } from '@/components/charts/DepartmentBar'
import { ChannelDashboard } from '@/components/dashboard/ChannelDashboard'
import {
  EM_DASH,
  formatDate,
  formatNumber,
  formatPercent,
  formatPeriod,
  kpiStatus,
} from '@/lib/format'

export const dynamic = 'force-dynamic'

export default function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; from?: string; to?: string }>
}) {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <Overview searchParams={searchParams} />
    </Suspense>
  )
}

async function Overview({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; from?: string; to?: string }>
}) {
  let user: Awaited<ReturnType<typeof requireScope>>['user']

  try {
    const resolved = await requireScope()
    user = resolved.user

    // Nhân viên chỉ xem KPI cá nhân (đặc tả mục 20) — không xem chi phí/doanh thu
    // toàn kênh. Các vai trò điều hành thấy dashboard hiệu quả kênh quảng cáo.
    if (user.role !== 'EMPLOYEE') {
      const params = await searchParams
      const range = resolveDateRange(params, new Date())
      const channelData = await getChannelDashboard(range)
      const canManage = user.role === 'ADMIN' || user.role === 'MARKETING_MANAGER'
      return <ChannelDashboard data={channelData} canManage={canManage} />
    }
  } catch (error) {
    console.error('Không tải được dashboard:', error)
    return <ErrorState />
  }

  return <EmployeeOverview />
}

/** Dashboard KPI cá nhân cho nhân viên. */
async function EmployeeOverview() {
  let data: Awaited<ReturnType<typeof getOverview>>

  try {
    const { user, scope } = await requireScope()
    data = await getOverview(new Date(), user, scope)
  } catch (error) {
    console.error('Không tải được KPI cá nhân:', error)
    return <ErrorState />
  }

  const { period, tiles, trend, departments, forecast, hasData } = data
  const overallAttainment = computeOverall(tiles)

  return (
    <div className="mx-auto max-w-[1600px] p-4 lg:p-6">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            KPI phòng Marketing
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {formatPeriod('MONTH', period.start)} · {formatDate(period.start)}–
            {formatDate(period.end)} · đã qua {period.elapsedDays}/{period.totalDays} ngày
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Đạt tổng thể <span className="text-xs text-slate-400">(theo tiến độ)</span>
          </span>
          <span className="text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {overallAttainment === null ? EM_DASH : formatPercent(overallAttainment)}
          </span>
          <StatusBadge status={kpiStatus(overallAttainment)} />
        </div>
      </header>

      {!hasData ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          <section aria-label="Chỉ số chính">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {tiles.map((tile) => (
                <KpiTile key={tile.code} {...tile} />
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2" title="Lead theo ngày" subtitle="Thực tế so với mục tiêu">
              <TrendChart
                data={trend}
                unit="lead"
                ariaLabel={`Biểu đồ Lead theo ngày trong ${formatPeriod('MONTH', period.start)}`}
              />
            </Card>

            <Card title="Hiệu suất bộ phận" subtitle="Điểm KPI tháng này">
              <DepartmentBar rows={departments} />
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card title="Dự báo cuối kỳ" subtitle={forecast ? forecast.metricName : undefined}>
              <ForecastBlock forecast={forecast} elapsedDays={period.elapsedDays} />
            </Card>

            <Card title="Cảnh báo" subtitle="Vấn đề cần xử lý">
              <PlaceholderBlock workflow="14 — Cảnh báo thông minh" />
            </Card>

            <Card title="Chờ duyệt" subtitle="Báo cáo cần xử lý">
              <PlaceholderBlock workflow="06 — Workflow báo cáo" />
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

/** % đạt tổng thể: trung bình các tile có dữ liệu. Sẽ thay bằng điểm có trọng số khi có scoring cấp phòng. */
function computeOverall(tiles: { attainment: number | null }[]): number | null {
  const values = tiles.map((t) => t.attainment).filter((v): v is number => v !== null)
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

function Card({
  title,
  subtitle,
  children,
  className,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 ${className ?? ''}`}
    >
      <div className="mb-3">
        <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">{title}</h2>
        {subtitle ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

function ForecastBlock({
  forecast,
  elapsedDays,
}: {
  forecast: Awaited<ReturnType<typeof getOverview>>['forecast']
  elapsedDays: number
}) {
  if (!forecast || forecast.value === null) {
    return (
      <p className="py-6 text-center text-sm text-slate-500">
        {forecast?.reason ?? 'Chưa đủ dữ liệu để dự báo.'}
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
          {formatNumber(forecast.value)}
        </span>
        <span className="text-sm text-slate-500">
          / {formatNumber(forecast.target)}
        </span>
        <StatusBadge status={kpiStatus(forecast.attainment)} />
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Nếu giữ tốc độ hiện tại, cuối kỳ đạt{' '}
        <span className="font-medium text-slate-700 dark:text-slate-300">
          {forecast.attainment === null ? EM_DASH : formatPercent(forecast.attainment)}
        </span>{' '}
        mục tiêu. Tính trên {elapsedDays} ngày dữ liệu.
      </p>
    </div>
  )
}

function PlaceholderBlock({ workflow }: { workflow: string }) {
  return (
    <div className="flex min-h-[5rem] flex-col items-center justify-center gap-1 text-center">
      <p className="text-sm text-slate-500">Chức năng đang được xây dựng</p>
      <p className="text-xs text-slate-400">{workflow}</p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">
        Chưa có dữ liệu KPI cho kỳ này
      </h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500 dark:text-slate-400">
        Cơ cấu tổ chức và danh mục chỉ số đã được khởi tạo, nhưng chưa có kế hoạch KPI nào.
        Thiết lập KPI năm để hệ thống sinh mục tiêu xuống quý, tháng, tuần và ngày.
      </p>
      <p className="mt-4 text-xs text-slate-400">
        Màn hình lập kế hoạch KPI thuộc workflow 04, chưa được xây dựng.
        Để xem thử dashboard với số liệu mẫu, chạy{' '}
        <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">npm run db:seed-demo</code>
      </p>
    </div>
  )
}

function ErrorState() {
  return (
    <div className="mx-auto max-w-[1600px] p-6">
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-900 dark:bg-rose-950">
        <h2 className="text-sm font-medium text-rose-900 dark:text-rose-200">
          Không tải được dữ liệu dashboard
        </h2>
        <p className="mt-1 text-sm text-rose-700 dark:text-rose-300">
          Kiểm tra kết nối cơ sở dữ liệu rồi tải lại trang.
        </p>
      </div>
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <div className="mx-auto max-w-[1600px] animate-pulse p-4 lg:p-6">
      <div className="mb-4 h-10 w-64 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-[7.5rem] rounded-lg bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="h-[21rem] rounded-lg bg-slate-200 xl:col-span-2 dark:bg-slate-800" />
        <div className="h-[21rem] rounded-lg bg-slate-200 dark:bg-slate-800" />
      </div>
    </div>
  )
}
