import Link from 'next/link'
import { notFound } from 'next/navigation'
import { listPlans, type PlanListItem } from '@/server/kpi/plan-service'
import {
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  buttonClass,
  inputClass,
} from '@/components/ui/primitives'
import { formatByUnit } from '@/lib/format'
import { requireScope } from '@/server/auth/guard'

export const dynamic = 'force-dynamic'

const STRATEGY_LABEL: Record<string, string> = {
  EVEN: 'Chia đều theo ngày',
  WEIGHTED: 'Theo tỷ trọng',
  MANUAL: 'Điều chỉnh thủ công',
}

export default async function KpiPlanListPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; owner?: string }>
}) {
  const params = await searchParams
  const year = Number(params.year) || new Date().getUTCFullYear()

  const { user, scope } = await requireScope()

  // Đặc tả mục 20: nhân viên chỉ xem KPI cá nhân, không xem kế hoạch KPI của
  // bộ phận. Trả 404 thay vì 403 để không tiết lộ màn hình này tồn tại.
  if (user.role === 'EMPLOYEE') notFound()

  let plans: PlanListItem[]
  try {
    plans = await listPlans(year, scope)
  } catch (error) {
    console.error('Không tải được danh sách kế hoạch KPI:', error)
    return (
      <div className="mx-auto max-w-[1600px] p-4 lg:p-6">
        <ErrorState message="Kiểm tra kết nối cơ sở dữ liệu rồi tải lại trang." />
      </div>
    )
  }

  // Danh sách đối tượng có kế hoạch, giữ thứ tự xuất hiện — dùng cho ô lọc.
  const owners: Array<{ id: string; name: string }> = []
  const seen = new Set<string>()
  for (const p of plans) {
    if (!seen.has(p.ownerId)) {
      seen.add(p.ownerId)
      owners.push({ id: p.ownerId, name: p.ownerName })
    }
  }

  const selectedOwner = params.owner && seen.has(params.owner) ? params.owner : null
  const visible = selectedOwner ? plans.filter((p) => p.ownerId === selectedOwner) : plans

  // Nhóm kế hoạch theo đối tượng để không lặp tên bộ phận ở từng dòng.
  const groups = new Map<string, { name: string; items: PlanListItem[] }>()
  for (const p of visible) {
    const g = groups.get(p.ownerId)
    if (g) g.items.push(p)
    else groups.set(p.ownerId, { name: p.ownerName, items: [p] })
  }

  return (
    <div className="mx-auto max-w-[1400px] p-4 lg:p-6">
      <PageHeader
        title="Kế hoạch KPI"
        description={`Năm ${year} · ${plans.length} kế hoạch cho ${owners.length} đối tượng. Nhập mục tiêu năm một lần, hệ thống sinh xuống quý, tháng, tuần và ngày.`}
        actions={
          <>
            <YearSwitcher year={year} />
            {scope.canManageKpi ? (
              <Link href="/kpi/planning/new" className={buttonClass('primary')}>
                Thêm kế hoạch
              </Link>
            ) : null}
          </>
        }
      />

      {plans.length === 0 ? (
        <EmptyState
          title={`Chưa có kế hoạch KPI nào cho năm ${year}`}
          description={
            scope.canManageKpi
              ? 'Tạo kế hoạch đầu tiên để hệ thống sinh mục tiêu cho từng quý, tháng, tuần và ngày. Mọi dashboard đều dựa trên các mục tiêu này.'
              : 'Chưa có kế hoạch KPI nào trong phạm vi của bạn. Liên hệ quản trị viên để thiết lập.'
          }
          action={
            scope.canManageKpi ? (
              <Link href="/kpi/planning/new" className={buttonClass('primary')}>
                Tạo kế hoạch KPI
              </Link>
            ) : null
          }
        />
      ) : (
        <>
          {/* Ô chọn lọc theo bộ phận — submit ngay khi đổi lựa chọn */}
          <form method="get" action="/kpi" className="mb-4 flex flex-wrap items-end gap-2">
            <input type="hidden" name="year" value={year} />
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Đối tượng
              </span>
              <select name="owner" defaultValue={selectedOwner ?? ''} className={`${inputClass} w-64`}>
                <option value="">Tất cả đối tượng ({owners.length})</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className={buttonClass('secondary')}>
              Lọc
            </button>
            {selectedOwner ? (
              <Link href={`/kpi?year=${year}`} className="pb-1.5 text-sm text-blue-600 hover:underline dark:text-blue-400">
                Xóa lọc
              </Link>
            ) : null}
          </form>

          <div className="space-y-4">
            {[...groups.values()].map((group) => (
              <Card key={group.name} title={group.name} subtitle={`${group.items.length} chỉ số`}>
                <PlanTable items={group.items} canManage={scope.canManageKpi} />
              </Card>
            ))}
          </div>
        </>
      )}

      <p className="mt-4 text-xs text-slate-400">
        Trọng số dùng để chấm điểm KPI cấu hình tại{' '}
        <Link href="/kpi/weights" className="text-blue-600 hover:underline dark:text-blue-400">
          Trọng số KPI
        </Link>
        .
      </p>
    </div>
  )
}

function PlanTable({ items, canManage }: { items: PlanListItem[]; canManage: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Kế hoạch KPI theo chỉ số</caption>
        <thead>
          <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <th scope="col" className="pb-2 pr-4 text-left font-medium">Chỉ số</th>
            <th scope="col" className="pb-2 px-4 text-center font-medium">Loại</th>
            <th scope="col" className="pb-2 px-4 text-right font-medium">Mục tiêu năm</th>
            <th scope="col" className="pb-2 px-4 text-left font-medium">Phân bổ</th>
            <th scope="col" className="pb-2 px-4 text-center font-medium">Dữ liệu thực tế</th>
            <th scope="col" className="pb-2 pl-4 text-right font-medium">
              <span className="sr-only">Thao tác</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((plan) => (
            <tr key={plan.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
              <td className="py-2.5 pr-4">
                <span className="text-slate-800 dark:text-slate-200">{plan.metricName}</span>{' '}
                <span className="text-xs text-slate-400">{plan.metricCode}</span>
              </td>
              <td className="py-2.5 px-4 text-center">
                <span
                  className={
                    plan.aggregation === 'RATIO'
                      ? 'rounded bg-violet-100 px-1.5 py-0.5 text-xs text-violet-800 dark:bg-violet-950 dark:text-violet-300'
                      : 'rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }
                >
                  {plan.aggregation === 'RATIO' ? 'Tỷ lệ' : 'Cộng dồn'}
                </span>
              </td>
              <td className="py-2.5 px-4 text-right tabular-nums font-medium text-slate-900 dark:text-slate-100">
                {formatByUnit(plan.yearTarget, plan.metricUnit)}
              </td>
              <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">
                {plan.aggregation === 'RATIO'
                  ? 'Nhập theo tháng'
                  : (STRATEGY_LABEL[plan.strategy] ?? plan.strategy)}
              </td>
              <td className="py-2.5 px-4 text-center text-xs">
                {plan.hasActuals ? (
                  <span
                    className="text-amber-700 dark:text-amber-400"
                    title="Sửa kế hoạch sẽ làm thay đổi % đạt của các kỳ đã qua"
                  >
                    Đã có
                  </span>
                ) : (
                  <span className="text-slate-400">Chưa có</span>
                )}
              </td>
              <td className="py-2.5 pl-4 text-right">
                <Link
                  href={`/kpi/planning/${plan.id}`}
                  className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  {canManage ? 'Sửa' : 'Xem'}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function YearSwitcher({ year }: { year: number }) {
  return (
    <div className="flex items-center gap-1">
      <Link
        href={`/kpi?year=${year - 1}`}
        className={buttonClass('secondary', 'px-2')}
        aria-label={`Xem năm ${year - 1}`}
      >
        ‹
      </Link>
      <span className="px-1 text-sm font-medium tabular-nums text-slate-700 dark:text-slate-300">
        {year}
      </span>
      <Link
        href={`/kpi?year=${year + 1}`}
        className={buttonClass('secondary', 'px-2')}
        aria-label={`Xem năm ${year + 1}`}
      >
        ›
      </Link>
    </div>
  )
}
