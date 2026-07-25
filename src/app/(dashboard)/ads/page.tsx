import { notFound } from 'next/navigation'
import { requireScope } from '@/server/auth/guard'
import { listAdsEntries } from '@/server/ads/manual-service'
import { PLATFORM_LABEL, type AdsPlatform } from '@/server/dashboard/channel-metrics'
import { AdsEntryForm } from '@/components/dashboard/AdsEntryForm'
import { Card, ErrorState, PageHeader } from '@/components/ui/primitives'
import { formatCurrency, formatDate, formatNumber } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function AdsPage() {
  const { user } = await requireScope()
  // Số liệu quảng cáo là dữ liệu điều hành — nhân viên và trưởng bộ phận không nhập.
  if (user.role !== 'ADMIN' && user.role !== 'MARKETING_MANAGER') notFound()

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  try {
    const entries = await listAdsEntries(today)

    return (
      <div className="mx-auto max-w-[1400px] p-4 lg:p-6">
        <PageHeader
          title="Số liệu quảng cáo"
          description="Nhập tay số liệu chi phí, hiển thị, click, lead và đơn hàng theo từng kênh. Dashboard hiệu quả kênh dựa trên dữ liệu này."
        />

        <div className="space-y-4">
          <AdsEntryForm defaultDate={todayStr} />

          <Card
            title="Đã nhập trong tháng này"
            subtitle={`${entries.length} dòng`}
          >
            {entries.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                Chưa nhập số liệu nào trong tháng. Dùng biểu mẫu bên trên để bắt đầu.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Số liệu quảng cáo đã nhập trong tháng</caption>
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800">
                      <th scope="col" className="pb-2 text-left font-medium">Ngày</th>
                      <th scope="col" className="pb-2 text-left font-medium">Kênh</th>
                      <th scope="col" className="pb-2 text-right font-medium">Hiển thị</th>
                      <th scope="col" className="pb-2 text-right font-medium">Click</th>
                      <th scope="col" className="pb-2 text-right font-medium">Chi phí</th>
                      <th scope="col" className="pb-2 text-right font-medium">Lead</th>
                      <th scope="col" className="pb-2 text-right font-medium">Đơn</th>
                      <th scope="col" className="pb-2 text-right font-medium">Doanh thu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                        <td className="py-2 tabular-nums text-slate-700 dark:text-slate-300">
                          {formatDate(e.date)}
                        </td>
                        <td className="py-2 text-slate-800 dark:text-slate-200">
                          {PLATFORM_LABEL[e.platform as AdsPlatform] ?? e.platform}
                        </td>
                        <td className="py-2 text-right tabular-nums text-slate-500">
                          {formatNumber(e.impressions)}
                        </td>
                        <td className="py-2 text-right tabular-nums text-slate-500">
                          {formatNumber(e.clicks)}
                        </td>
                        <td className="py-2 text-right tabular-nums font-medium text-slate-900 dark:text-slate-100">
                          {formatCurrency(e.spend)}
                        </td>
                        <td className="py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                          {formatNumber(e.leads)}
                        </td>
                        <td className="py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                          {formatNumber(e.conversions)}
                        </td>
                        <td className="py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                          {formatCurrency(e.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    )
  } catch (error) {
    console.error('Không tải được số liệu quảng cáo:', error)
    return (
      <div className="mx-auto max-w-[1400px] p-4 lg:p-6">
        <ErrorState message="Kiểm tra kết nối cơ sở dữ liệu rồi tải lại trang." />
      </div>
    )
  }
}
