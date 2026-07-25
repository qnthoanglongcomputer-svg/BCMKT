import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireScope } from '@/server/auth/guard'
import { listAdsPlans } from '@/server/ads/plan-service'
import { AdsPlanForm } from '@/components/dashboard/AdsPlanForm'
import { ErrorState, PageHeader, buttonClass } from '@/components/ui/primitives'

export const dynamic = 'force-dynamic'

export default async function AdsPlansPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const { user } = await requireScope()
  if (user.role !== 'ADMIN' && user.role !== 'MARKETING_MANAGER') notFound()

  const now = new Date()
  const params = await searchParams
  const year = Number(params.year) || now.getUTCFullYear()
  const month = Number(params.month) || now.getUTCMonth() + 1

  try {
    const rows = await listAdsPlans(year, month)

    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? year - 1 : year
    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year

    return (
      <div className="mx-auto max-w-[1200px] p-4 lg:p-6">
        <PageHeader
          title="Mục tiêu quảng cáo theo kênh"
          description="Đặt mục tiêu tháng cho từng kênh. Khi xem một khoảng ngày ngắn hơn, dashboard tự chia mục tiêu theo số ngày."
          actions={
            <div className="flex items-center gap-1">
              <Link
                href={`/ads/plans?year=${prevYear}&month=${prevMonth}`}
                className={buttonClass('secondary', 'px-2')}
                aria-label="Tháng trước"
              >
                ‹
              </Link>
              <span className="px-1 text-sm font-medium tabular-nums text-slate-700 dark:text-slate-300">
                {month}/{year}
              </span>
              <Link
                href={`/ads/plans?year=${nextYear}&month=${nextMonth}`}
                className={buttonClass('secondary', 'px-2')}
                aria-label="Tháng sau"
              >
                ›
              </Link>
              <Link href="/ads" className={buttonClass('secondary', 'ml-2')}>
                Nhập số liệu
              </Link>
            </div>
          }
        />

        <AdsPlanForm rows={rows} year={year} month={month} />
      </div>
    )
  } catch (error) {
    console.error('Không tải được mục tiêu quảng cáo:', error)
    return (
      <div className="mx-auto max-w-[1200px] p-4 lg:p-6">
        <ErrorState message="Kiểm tra kết nối cơ sở dữ liệu rồi tải lại trang." />
      </div>
    )
  }
}
