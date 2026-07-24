'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Decimal from 'decimal.js'
import {
  Alert,
  Button,
  Card,
  Field,
  inputClass,
} from '@/components/ui/primitives'
import { formatByUnit, formatNumber, formatPercentValue } from '@/lib/format'
import { previewAllocationAction, savePlanAction } from '@/app/(dashboard)/kpi/actions'

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const MONTH_LABEL = MONTHS.map((m) => `Tháng ${m}`)

export interface PlanFormOptions {
  departments: Array<{ id: string; code: string; name: string; level: number }>
  definitions: Array<{
    id: string
    code: string
    name: string
    unit: string
    aggregation: 'SUM' | 'RATIO'
    direction: 'HIGHER_BETTER' | 'LOWER_BETTER'
  }>
}

export interface PlanFormInitial {
  planId?: string
  year: number
  ownerId: string
  kpiDefinitionId: string
  yearTarget: string
  strategy: 'EVEN' | 'WEIGHTED' | 'MANUAL'
  monthWeights?: Record<string, string>
  lockedMonths?: Record<string, string>
  monthlyValues?: Record<string, string>
  hasActuals?: boolean
}

interface PreviewData {
  year: string
  months: Array<{ start: string; days: number; value: string }>
  quarters: Array<{ start: string; value: string }>
  weekCount: number
  dayCount: number
}

export function PlanForm({
  options,
  initial,
}: {
  options: PlanFormOptions
  initial: PlanFormInitial
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [year, setYear] = useState(initial.year)
  const [ownerId, setOwnerId] = useState(initial.ownerId)
  const [kpiDefinitionId, setKpiDefinitionId] = useState(initial.kpiDefinitionId)
  const [yearTarget, setYearTarget] = useState(initial.yearTarget)
  const [strategy, setStrategy] = useState(initial.strategy)
  const [monthWeights, setMonthWeights] = useState<Record<string, string>>(
    initial.monthWeights ?? defaultWeights(),
  )
  const [lockedMonths, setLockedMonths] = useState<Record<string, string>>(
    initial.lockedMonths ?? {},
  )
  const [monthlyValues, setMonthlyValues] = useState<Record<string, string>>(
    initial.monthlyValues ?? {},
  )

  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const definition = options.definitions.find((d) => d.id === kpiDefinitionId)
  const isRatio = definition?.aggregation === 'RATIO'
  const unit = definition?.unit ?? ''

  const weightSum = useMemo(
    () =>
      MONTHS.reduce<Decimal>(
        (acc, m) => acc.plus(safeDecimal(monthWeights[String(m)])),
        new Decimal(0),
      ),
    [monthWeights],
  )
  const weightSumOk = weightSum.minus(1).abs().lte('0.0001')

  const lockedSum = useMemo(
    () =>
      Object.values(lockedMonths).reduce<Decimal>(
        (acc, v) => acc.plus(safeDecimal(v)),
        new Decimal(0),
      ),
    [lockedMonths],
  )

  function buildPayload() {
    const base = {
      planId: initial.planId,
      year,
      ownerType: 'DEPARTMENT' as const,
      ownerId,
      kpiDefinitionId,
    }

    if (isRatio) {
      return { ...base, monthlyValues }
    }

    return {
      ...base,
      yearTarget,
      strategy,
      monthWeights: strategy === 'WEIGHTED' ? monthWeights : undefined,
      lockedMonths: strategy === 'MANUAL' ? nonEmpty(lockedMonths) : undefined,
    }
  }

  function handlePreview() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await previewAllocationAction(buildPayload())
      if (result.ok) {
        setPreview(result.data as PreviewData)
      } else {
        setPreview(null)
        setError(result.error ?? 'Không tính được bảng phân bổ')
      }
    })
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await savePlanAction(buildPayload())
      if (result.ok) {
        setSaved(true)
        router.push('/kpi')
        router.refresh()
      } else {
        setError(result.error ?? 'Không lưu được kế hoạch')
      }
    })
  }

  return (
    <div className="space-y-4">
      {initial.hasActuals ? (
        <Alert tone="warning">
          Kế hoạch này đã có dữ liệu thực tế. Sửa mục tiêu sẽ làm{' '}
          <strong>thay đổi % đạt của các kỳ đã qua</strong> trên mọi dashboard.
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Thông tin chung">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Năm">
              <input
                type="number"
                className={inputClass}
                value={year}
                min={2000}
                max={2100}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            </Field>

            <Field label="Đối tượng áp dụng">
              <select
                className={inputClass}
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
              >
                <option value="">— Chọn phòng ban —</option>
                {options.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {' '.repeat(d.level * 2)}
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Chỉ số KPI"
              hint={
                definition
                  ? `Đơn vị: ${definition.unit} · ${definition.direction === 'LOWER_BETTER' ? 'Thấp hơn là tốt' : 'Cao hơn là tốt'}`
                  : undefined
              }
            >
              <select
                className={inputClass}
                value={kpiDefinitionId}
                onChange={(e) => {
                  setKpiDefinitionId(e.target.value)
                  setPreview(null)
                }}
              >
                <option value="">— Chọn chỉ số —</option>
                {options.definitions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </Field>

            {!isRatio ? (
              <Field label="Mục tiêu cả năm" hint={unit ? `Đơn vị: ${unit}` : undefined}>
                <input
                  type="text"
                  inputMode="decimal"
                  className={inputClass}
                  value={yearTarget}
                  placeholder="72000"
                  onChange={(e) => setYearTarget(e.target.value)}
                />
              </Field>
            ) : null}
          </div>
        </Card>

        <Card
          title={isRatio ? 'Mục tiêu theo tháng' : 'Chiến lược phân bổ'}
          subtitle={
            isRatio
              ? 'Chỉ số tỷ lệ không chia nhỏ được như Lead hay Doanh thu — nhập thẳng mục tiêu cho từng tháng.'
              : 'Hệ thống sinh mục tiêu quý, tháng, tuần, ngày từ mục tiêu năm.'
          }
        >
          {isRatio ? (
            <MonthlyValueGrid
              values={monthlyValues}
              unit={unit}
              onChange={(month, value) =>
                setMonthlyValues((prev) => ({ ...prev, [month]: value }))
              }
              onFillAll={(value) =>
                setMonthlyValues(
                  Object.fromEntries(MONTHS.map((m) => [String(m), value])),
                )
              }
            />
          ) : (
            <StrategyPicker
              strategy={strategy}
              onChange={(s) => {
                setStrategy(s)
                setPreview(null)
              }}
              monthWeights={monthWeights}
              onWeightChange={(m, v) => setMonthWeights((prev) => ({ ...prev, [m]: v }))}
              weightSum={weightSum}
              weightSumOk={weightSumOk}
              lockedMonths={lockedMonths}
              onLockedChange={setLockedMonths}
              lockedSum={lockedSum}
              yearTarget={yearTarget}
              unit={unit}
            />
          )}
        </Card>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {saved ? <Alert tone="info">Đã lưu kế hoạch và sinh lại toàn bộ mục tiêu.</Alert> : null}

      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={handlePreview} disabled={isPending}>
          {isPending ? 'Đang tính…' : 'Xem trước phân bổ'}
        </Button>
        <Button onClick={handleSave} disabled={isPending || !preview}>
          Lưu kế hoạch
        </Button>
        {!preview ? (
          <span className="text-xs text-slate-400">
            Xem trước để kiểm tra số liệu trước khi lưu
          </span>
        ) : null}
      </div>

      {preview ? <PreviewTable preview={preview} unit={unit} isRatio={isRatio} /> : null}
    </div>
  )
}

function StrategyPicker(props: {
  strategy: 'EVEN' | 'WEIGHTED' | 'MANUAL'
  onChange: (s: 'EVEN' | 'WEIGHTED' | 'MANUAL') => void
  monthWeights: Record<string, string>
  onWeightChange: (month: string, value: string) => void
  weightSum: Decimal
  weightSumOk: boolean
  lockedMonths: Record<string, string>
  onLockedChange: (v: Record<string, string>) => void
  lockedSum: Decimal
  yearTarget: string
  unit: string
}) {
  const {
    strategy, onChange, monthWeights, onWeightChange, weightSum, weightSumOk,
    lockedMonths, onLockedChange, lockedSum, yearTarget, unit,
  } = props

  const options = [
    { value: 'EVEN' as const, label: 'Chia đều theo ngày', hint: 'Tháng 31 ngày nhận nhiều hơn tháng 28 ngày' },
    { value: 'WEIGHTED' as const, label: 'Theo tỷ trọng', hint: 'Nhập % cho từng tháng, tổng phải bằng 100%' },
    { value: 'MANUAL' as const, label: 'Điều chỉnh thủ công', hint: 'Cố định một số tháng, hệ thống cân lại phần còn lại' },
  ]

  const overLocked = yearTarget !== '' && lockedSum.gt(safeDecimal(yearTarget))

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {options.map((opt) => (
          <label key={opt.value} className="flex cursor-pointer items-start gap-2">
            <input
              type="radio"
              name="strategy"
              className="mt-0.5"
              checked={strategy === opt.value}
              onChange={() => onChange(opt.value)}
            />
            <span>
              <span className="block text-sm text-slate-800 dark:text-slate-200">{opt.label}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">{opt.hint}</span>
            </span>
          </label>
        ))}
      </div>

      {strategy === 'WEIGHTED' ? (
        <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {MONTHS.map((m) => (
              <label key={m} className="block">
                <span className="mb-0.5 block text-xs text-slate-500">T{m}</span>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    className={`${inputClass} text-right`}
                    value={toPercentInput(monthWeights[String(m)])}
                    onChange={(e) => onWeightChange(String(m), fromPercentInput(e.target.value))}
                  />
                  <span className="text-xs text-slate-400">%</span>
                </div>
              </label>
            ))}
          </div>
          <p
            className={`mt-2 text-xs tabular-nums ${weightSumOk ? 'text-slate-500' : 'font-medium text-rose-600 dark:text-rose-400'}`}
          >
            Tổng: {formatPercentValue(weightSum.times(100).toNumber())}
            {weightSumOk ? ' ✓' : ' — phải bằng 100%'}
          </p>
        </div>
      ) : null}

      {strategy === 'MANUAL' ? (
        <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
            Nhập giá trị cho tháng muốn cố định, để trống các tháng còn lại.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {MONTHS.map((m) => (
              <label key={m} className="block">
                <span className="mb-0.5 block text-xs text-slate-500">T{m}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  className={`${inputClass} text-right`}
                  value={lockedMonths[String(m)] ?? ''}
                  placeholder="—"
                  onChange={(e) => {
                    const next = { ...lockedMonths }
                    if (e.target.value.trim() === '') delete next[String(m)]
                    else next[String(m)] = e.target.value
                    onLockedChange(next)
                  }}
                />
              </label>
            ))}
          </div>
          <p
            className={`mt-2 text-xs tabular-nums ${overLocked ? 'font-medium text-rose-600 dark:text-rose-400' : 'text-slate-500'}`}
          >
            Tổng đã cố định: {formatByUnit(lockedSum.toString(), unit)}
            {overLocked ? ` — vượt mục tiêu năm ${formatByUnit(yearTarget, unit)}` : ''}
          </p>
        </div>
      ) : null}
    </div>
  )
}

function MonthlyValueGrid({
  values,
  unit,
  onChange,
  onFillAll,
}: {
  values: Record<string, string>
  unit: string
  onChange: (month: string, value: string) => void
  onFillAll: (value: string) => void
}) {
  const [bulk, setBulk] = useState('')
  const filled = MONTHS.filter((m) => (values[String(m)] ?? '').trim() !== '').length

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Field label="Điền nhanh cho cả 12 tháng">
            <input
              type="text"
              inputMode="decimal"
              className={inputClass}
              value={bulk}
              placeholder={unit === 'VND' ? '100000' : '3.5'}
              onChange={(e) => setBulk(e.target.value)}
            />
          </Field>
        </div>
        <Button
          variant="secondary"
          onClick={() => bulk.trim() !== '' && onFillAll(bulk.trim())}
          disabled={bulk.trim() === ''}
        >
          Áp dụng
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {MONTHS.map((m) => (
          <label key={m} className="block">
            <span className="mb-0.5 block text-xs text-slate-500">T{m}</span>
            <input
              type="text"
              inputMode="decimal"
              className={`${inputClass} text-right`}
              value={values[String(m)] ?? ''}
              onChange={(e) => onChange(String(m), e.target.value)}
            />
          </label>
        ))}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Đã nhập {filled}/12 tháng{unit ? ` · đơn vị ${unit}` : ''}
      </p>
    </div>
  )
}

function PreviewTable({
  preview,
  unit,
  isRatio,
}: {
  preview: PreviewData
  unit: string
  isRatio: boolean
}) {
  const monthSum = preview.months.reduce<Decimal>(
    (acc, m) => acc.plus(m.value),
    new Decimal(0),
  )
  const sumMatches = monthSum.equals(new Decimal(preview.year))

  return (
    <Card
      title="Xem trước phân bổ"
      subtitle={`${preview.quarters.length} quý · 12 tháng · ${preview.weekCount} tuần · ${preview.dayCount} ngày`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Bảng phân bổ mục tiêu theo tháng</caption>
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800">
              <th scope="col" className="pb-2 text-left font-medium">Kỳ</th>
              <th scope="col" className="pb-2 text-right font-medium">Số ngày</th>
              <th scope="col" className="pb-2 text-right font-medium">Mục tiêu</th>
            </tr>
          </thead>
          <tbody>
            {preview.months.map((m, i) => (
              <tr key={m.start} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-1.5 text-slate-700 dark:text-slate-300">{MONTH_LABEL[i]}</td>
                <td className="py-1.5 text-right tabular-nums text-slate-500">{m.days}</td>
                <td className="py-1.5 text-right tabular-nums font-medium text-slate-900 dark:text-slate-100">
                  {formatByUnit(m.value, unit)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 dark:border-slate-700">
              <td className="pt-2 font-medium text-slate-900 dark:text-slate-100">
                {isRatio ? 'Trung bình năm' : 'Tổng 12 tháng'}
              </td>
              <td className="pt-2 text-right tabular-nums text-slate-500">{preview.dayCount}</td>
              <td className="pt-2 text-right tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                {formatByUnit(isRatio ? preview.year : monthSum.toString(), unit)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {isRatio ? (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Mục tiêu tỷ lệ không cộng dồn. Mỗi ngày trong tháng nhận đúng giá trị của tháng đó;
          giá trị quý và năm là trung bình có trọng số theo số ngày.
        </p>
      ) : (
        <p
          className={`mt-3 text-xs ${sumMatches ? 'text-emerald-600 dark:text-emerald-400' : 'font-medium text-rose-600 dark:text-rose-400'}`}
        >
          {sumMatches
            ? `✓ Tổng 12 tháng khớp đúng mục tiêu năm (${formatNumber(preview.year, 2)})`
            : `✗ Tổng 12 tháng (${monthSum.toString()}) lệch mục tiêu năm (${preview.year})`}
        </p>
      )}
    </Card>
  )
}

function defaultWeights(): Record<string, string> {
  // Mặc định chia đều 12 tháng; admin chỉnh lại theo mùa vụ.
  // Phần dư dồn vào tháng 12 để tổng đúng bằng 100% — nếu không, người dùng
  // vừa chọn "theo tỷ trọng" đã gặp lỗi tổng khác 100%.
  const each = new Decimal(1).dividedBy(12).toDecimalPlaces(4, Decimal.ROUND_DOWN)
  const last = new Decimal(1).minus(each.times(11))
  return Object.fromEntries(
    MONTHS.map((m) => [String(m), (m === 12 ? last : each).toString()]),
  )
}

function nonEmpty(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).filter(([, v]) => v.trim() !== ''))
}

function safeDecimal(value: string | undefined): Decimal {
  if (!value || value.trim() === '') return new Decimal(0)
  try {
    return new Decimal(value)
  } catch {
    return new Decimal(0)
  }
}

/** Lưu tỷ trọng dạng tỷ lệ (0.05) nhưng hiển thị dạng % (5) cho dễ nhập. */
function toPercentInput(value: string | undefined): string {
  if (!value || value.trim() === '') return ''
  try {
    return new Decimal(value).times(100).toDecimalPlaces(2).toString()
  } catch {
    return value
  }
}

function fromPercentInput(value: string): string {
  if (value.trim() === '') return '0'
  try {
    return new Decimal(value).dividedBy(100).toString()
  } catch {
    return value
  }
}
