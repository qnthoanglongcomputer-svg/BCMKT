'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Button, Card, inputClass } from '@/components/ui/primitives'
import { saveAdsPlanAction } from '@/app/(dashboard)/ads/actions'
import type { AdsPlanRow } from '@/server/ads/plan-service'

/**
 * Đặt mục tiêu quảng cáo theo kênh cho một tháng. Mỗi kênh một hàng, lưu độc
 * lập từng kênh (mỗi hàng một lần gọi) để lỗi ở kênh này không chặn kênh khác.
 */
export function AdsPlanForm({
  rows,
  year,
  month,
}: {
  rows: AdsPlanRow[]
  year: number
  month: number
}) {
  return (
    <Card
      title={`Mục tiêu tháng ${month}/${year}`}
      subtitle="Đặt mục tiêu chi phí, doanh thu, lead và đơn cho từng kênh. Dashboard so thực tế với mục tiêu này."
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Mục tiêu quảng cáo theo kênh</caption>
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800">
              <th scope="col" className="pb-2 text-left font-medium">Kênh</th>
              <th scope="col" className="pb-2 text-right font-medium">Chi phí (VND)</th>
              <th scope="col" className="pb-2 text-right font-medium">Doanh thu (VND)</th>
              <th scope="col" className="pb-2 text-right font-medium">Lead</th>
              <th scope="col" className="pb-2 text-right font-medium">Đơn</th>
              <th scope="col" className="pb-2 text-right font-medium">
                <span className="sr-only">Lưu</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <PlanRow key={row.platform} row={row} year={year} month={month} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function PlanRow({ row, year, month }: { row: AdsPlanRow; year: number; month: number }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [spend, setSpend] = useState(row.spendTarget)
  const [revenue, setRevenue] = useState(row.revenueTarget)
  const [leads, setLeads] = useState(String(row.leadsTarget))
  const [orders, setOrders] = useState(String(row.ordersTarget))

  function save() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await saveAdsPlanAction({
        platform: row.platform,
        year,
        month,
        spendTarget: spend || '0',
        revenueTarget: revenue || '0',
        leadsTarget: Number(leads || 0),
        ordersTarget: Number(orders || 0),
      })
      if (result.ok) {
        setSaved(true)
        router.refresh()
      } else {
        setError(result.error ?? 'Không lưu được')
      }
    })
  }

  return (
    <>
      <tr className="border-b border-slate-100 last:border-0 dark:border-slate-800">
        <th scope="row" className="py-2 pr-3 text-left font-normal text-slate-800 dark:text-slate-200">
          {row.label}
        </th>
        <td className="py-2">
          <input
            type="text"
            inputMode="decimal"
            value={spend}
            onChange={(e) => setSpend(e.target.value)}
            className={`${inputClass} w-32 text-right`}
          />
        </td>
        <td className="py-2">
          <input
            type="text"
            inputMode="decimal"
            value={revenue}
            onChange={(e) => setRevenue(e.target.value)}
            className={`${inputClass} w-32 text-right`}
          />
        </td>
        <td className="py-2">
          <input
            type="number"
            min={0}
            value={leads}
            onChange={(e) => setLeads(e.target.value)}
            className={`${inputClass} w-20 text-right`}
          />
        </td>
        <td className="py-2">
          <input
            type="number"
            min={0}
            value={orders}
            onChange={(e) => setOrders(e.target.value)}
            className={`${inputClass} w-20 text-right`}
          />
        </td>
        <td className="py-2 pl-2 text-right">
          <Button onClick={save} disabled={isPending} className="px-2.5 py-1 text-xs">
            {isPending ? '…' : saved ? 'Đã lưu' : 'Lưu'}
          </Button>
        </td>
      </tr>
      {error ? (
        <tr>
          <td colSpan={6} className="pb-2">
            <Alert tone="error">{`${row.label}: ${error}`}</Alert>
          </td>
        </tr>
      ) : null}
    </>
  )
}
