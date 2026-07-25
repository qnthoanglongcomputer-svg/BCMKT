'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { buttonClass, inputClass } from '@/components/ui/primitives'
import type { RangePreset } from '@/server/dashboard/date-range'

const PRESETS: Array<{ value: Exclude<RangePreset, 'custom'>; label: string }> = [
  { value: 'this-month', label: 'Tháng này' },
  { value: 'last-month', label: 'Tháng trước' },
  { value: 'last-7-days', label: '7 ngày' },
  { value: 'last-30-days', label: '30 ngày' },
]

/**
 * Bộ lọc kỳ xem cho dashboard. Toàn bộ lựa chọn nằm trên URL để chia sẻ link
 * và back/forward hoạt động đúng.
 */
export function RangeFilter({
  preset,
  from,
  to,
}: {
  preset: RangePreset
  from: string
  to: string
}) {
  const router = useRouter()
  const [showCustom, setShowCustom] = useState(preset === 'custom')
  const [customFrom, setCustomFrom] = useState(from)
  const [customTo, setCustomTo] = useState(to)

  function goPreset(p: RangePreset) {
    setShowCustom(false)
    router.push(`/dashboard?preset=${p}`)
  }

  function applyCustom() {
    if (!customFrom || !customTo) return
    router.push(`/dashboard?preset=custom&from=${customFrom}&to=${customTo}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PRESETS.map((p) => (
        <button
          key={p.value}
          type="button"
          onClick={() => goPreset(p.value)}
          aria-pressed={preset === p.value}
          className={
            preset === p.value
              ? buttonClass('primary', 'px-2.5 py-1 text-xs')
              : buttonClass('secondary', 'px-2.5 py-1 text-xs')
          }
        >
          {p.label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setShowCustom((v) => !v)}
        aria-pressed={preset === 'custom'}
        className={
          preset === 'custom'
            ? buttonClass('primary', 'px-2.5 py-1 text-xs')
            : buttonClass('secondary', 'px-2.5 py-1 text-xs')
        }
      >
        Tùy chọn
      </button>

      {showCustom ? (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={customFrom}
            max={customTo || undefined}
            onChange={(e) => setCustomFrom(e.target.value)}
            className={`${inputClass} w-auto py-1 text-xs`}
            aria-label="Từ ngày"
          />
          <span className="text-xs text-slate-400">–</span>
          <input
            type="date"
            value={customTo}
            min={customFrom || undefined}
            onChange={(e) => setCustomTo(e.target.value)}
            className={`${inputClass} w-auto py-1 text-xs`}
            aria-label="Đến ngày"
          />
          <button
            type="button"
            onClick={applyCustom}
            disabled={!customFrom || !customTo}
            className={buttonClass('primary', 'px-2.5 py-1 text-xs')}
          >
            Xem
          </button>
        </div>
      ) : null}
    </div>
  )
}
