'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Button, Card, Field, inputClass } from '@/components/ui/primitives'
import { saveAdsEntryAction } from '@/app/(dashboard)/ads/actions'

const PLATFORMS = [
  { value: 'FACEBOOK', label: 'Facebook Ads' },
  { value: 'GOOGLE', label: 'Google Ads' },
  { value: 'TIKTOK', label: 'TikTok Ads' },
  { value: 'ZALO', label: 'Zalo Ads' },
  { value: 'COCCOC', label: 'Cốc Cốc Ads' },
] as const

export function AdsEntryForm({ defaultDate }: { defaultDate: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const fd = new FormData(form)
    setError(null)
    setSaved(false)

    startTransition(async () => {
      const result = await saveAdsEntryAction({
        platform: String(fd.get('platform')),
        date: String(fd.get('date')),
        impressions: Number(fd.get('impressions') || 0),
        clicks: Number(fd.get('clicks') || 0),
        spend: String(fd.get('spend') || '0'),
        leads: Number(fd.get('leads') || 0),
        conversions: Number(fd.get('conversions') || 0),
        revenue: String(fd.get('revenue') || '0'),
      })
      if (result.ok) {
        setSaved(true)
        router.refresh()
      } else {
        setError(result.error ?? 'Không lưu được số liệu')
      }
    })
  }

  return (
    <Card title="Nhập số liệu quảng cáo" subtitle="Một dòng cho mỗi kênh trong một ngày. Nhập lại cùng ngày/kênh sẽ ghi đè.">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Kênh">
            <select name="platform" required defaultValue="FACEBOOK" className={inputClass}>
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ngày">
            <input type="date" name="date" required defaultValue={defaultDate} className={inputClass} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Lượt hiển thị">
            <input type="number" name="impressions" min={0} defaultValue={0} className={`${inputClass} text-right`} />
          </Field>
          <Field label="Lượt click">
            <input type="number" name="clicks" min={0} defaultValue={0} className={`${inputClass} text-right`} />
          </Field>
          <Field label="Chi phí (VND)">
            <input type="text" name="spend" inputMode="decimal" placeholder="0" className={`${inputClass} text-right`} />
          </Field>
          <Field label="Lead">
            <input type="number" name="leads" min={0} defaultValue={0} className={`${inputClass} text-right`} />
          </Field>
          <Field label="Số đơn">
            <input type="number" name="conversions" min={0} defaultValue={0} className={`${inputClass} text-right`} />
          </Field>
          <Field label="Doanh thu (VND)">
            <input type="text" name="revenue" inputMode="decimal" placeholder="0" className={`${inputClass} text-right`} />
          </Field>
        </div>

        {error ? <Alert tone="error">{error}</Alert> : null}
        {saved ? <Alert tone="info">Đã lưu số liệu.</Alert> : null}

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Đang lưu…' : 'Lưu số liệu'}
          </Button>
          <span className="text-xs text-slate-400">
            CPC, CTR, ROAS và tỷ lệ chuyển đổi được hệ thống tự tính — không nhập tay.
          </span>
        </div>
      </form>
    </Card>
  )
}
