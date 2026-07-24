'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Decimal from 'decimal.js'
import { Alert, Button, Card, Field, inputClass } from '@/components/ui/primitives'
import { formatPercentValue } from '@/lib/format'
import { saveWeightGroupAction } from '@/app/(dashboard)/kpi/actions'

export interface WeightFormOptions {
  positions: Array<{ id: string; name: string; department: { name: string } }>
  definitions: Array<{
    id: string
    code: string
    name: string
    unit: string
    direction: 'HIGHER_BETTER' | 'LOWER_BETTER'
  }>
}

export interface WeightFormInitial {
  groupId?: string
  name: string
  positionId: string
  effectiveYear: number
  weights: Array<{ kpiDefinitionId: string; weight: string }>
}

export function WeightGroupForm({
  options,
  initial,
}: {
  options: WeightFormOptions
  initial: WeightFormInitial
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState(initial.name)
  const [positionId, setPositionId] = useState(initial.positionId)
  const [effectiveYear, setEffectiveYear] = useState(initial.effectiveYear)
  const [rows, setRows] = useState(initial.weights)
  const [error, setError] = useState<string | null>(null)

  const total = useMemo(
    () => rows.reduce<Decimal>((acc, r) => acc.plus(safeDecimal(r.weight)), new Decimal(0)),
    [rows],
  )
  const totalOk = total.minus(1).abs().lte('0.0001')

  const available = options.definitions.filter(
    (d) => !rows.some((r) => r.kpiDefinitionId === d.id),
  )

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await saveWeightGroupAction({
        groupId: initial.groupId,
        name,
        positionId,
        effectiveYear,
        weights: rows,
      })
      if (result.ok) {
        router.push('/kpi/weights')
        router.refresh()
      } else {
        setError(result.error ?? 'Không lưu được nhóm trọng số')
      }
    })
  }

  return (
    <div className="space-y-4">
      <Card title="Thông tin nhóm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Tên nhóm">
            <input
              type="text"
              className={inputClass}
              value={name}
              placeholder="Ads Performance 2026"
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <Field label="Vị trí áp dụng">
            <select
              className={inputClass}
              value={positionId}
              onChange={(e) => setPositionId(e.target.value)}
            >
              <option value="">— Chọn vị trí —</option>
              {options.positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.department.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Năm áp dụng" hint="Đổi trọng số không ảnh hưởng điểm của năm khác">
            <input
              type="number"
              className={inputClass}
              value={effectiveYear}
              min={2000}
              max={2100}
              onChange={(e) => setEffectiveYear(Number(e.target.value))}
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Chỉ số và trọng số"
        subtitle="Tổng trọng số của nhóm phải bằng đúng 100%"
      >
        {rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">
            Chưa có chỉ số nào. Thêm chỉ số bên dưới.
          </p>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">Danh sách chỉ số và trọng số trong nhóm</caption>
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800">
                <th scope="col" className="pb-2 text-left font-medium">Chỉ số</th>
                <th scope="col" className="pb-2 text-center font-medium">Chiều</th>
                <th scope="col" className="pb-2 text-right font-medium">Trọng số</th>
                <th scope="col" className="pb-2 text-right font-medium">
                  <span className="sr-only">Xoá</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const def = options.definitions.find((d) => d.id === row.kpiDefinitionId)
                return (
                  <tr
                    key={row.kpiDefinitionId}
                    className="border-b border-slate-100 dark:border-slate-800"
                  >
                    <td className="py-2 text-slate-800 dark:text-slate-200">
                      {def?.name ?? 'Chỉ số không còn tồn tại'}{' '}
                      <span className="text-xs text-slate-400">{def?.code}</span>
                    </td>
                    <td className="py-2 text-center text-xs text-slate-500">
                      {def?.direction === 'LOWER_BETTER' ? 'Thấp hơn tốt' : 'Cao hơn tốt'}
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          className={`${inputClass} w-20 text-right`}
                          value={toPercentInput(row.weight)}
                          onChange={(e) => {
                            const next = [...rows]
                            next[index] = {
                              ...row,
                              weight: fromPercentInput(e.target.value),
                            }
                            setRows(next)
                          }}
                        />
                        <span className="text-xs text-slate-400">%</span>
                      </div>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        className="text-sm text-rose-600 hover:underline dark:text-rose-400"
                        onClick={() => setRows(rows.filter((_, i) => i !== index))}
                      >
                        Xoá
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 dark:border-slate-700">
                <td colSpan={2} className="pt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                  Tổng
                </td>
                <td
                  className={`pt-2 text-right tabular-nums font-semibold ${
                    totalOk
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {formatPercentValue(total.times(100).toNumber())}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}

        {available.length > 0 ? (
          <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Thêm chỉ số
              </span>
              <select
                className={inputClass}
                value=""
                onChange={(e) => {
                  if (!e.target.value) return
                  setRows([...rows, { kpiDefinitionId: e.target.value, weight: '0' }])
                }}
              >
                <option value="">— Chọn chỉ số để thêm —</option>
                {available.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </Card>

      {!totalOk && rows.length > 0 ? (
        <Alert tone="warning">
          Tổng trọng số đang là {formatPercentValue(total.times(100).toNumber())}. Thêm chỉ số
          mới thì phải giảm trọng số các chỉ số cũ để tổng vẫn bằng 100%.
        </Alert>
      ) : null}

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="flex items-center gap-2">
        <Button onClick={handleSave} disabled={isPending || !totalOk || rows.length === 0}>
          {isPending ? 'Đang lưu…' : 'Lưu nhóm trọng số'}
        </Button>
        <Button variant="secondary" onClick={() => router.push('/kpi/weights')}>
          Huỷ
        </Button>
      </div>
    </div>
  )
}

function safeDecimal(value: string): Decimal {
  if (!value || value.trim() === '') return new Decimal(0)
  try {
    return new Decimal(value)
  } catch {
    return new Decimal(0)
  }
}

function toPercentInput(value: string): string {
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
