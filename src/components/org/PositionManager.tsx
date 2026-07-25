'use client'

import { EntityDialog } from './EntityDialog'
import { Card, Field, buttonClass, inputClass } from '@/components/ui/primitives'
import { savePositionAction } from '@/app/(dashboard)/hr/actions'
import type { PositionRow } from '@/server/org/user-service'

export function PositionManager({
  rows,
  departments,
  canManage,
}: {
  rows: PositionRow[]
  departments: Array<{ id: string; name: string; level: number }>
  canManage: boolean
}) {
  return (
    <Card title="Vị trí công việc" subtitle="Mỗi vị trí gắn với một phòng ban và có bộ trọng số KPI riêng">
      {canManage ? (
        <div className="mb-3">
          <PositionDialog
            departments={departments}
            trigger={<button className={buttonClass('primary')}>Thêm vị trí</button>}
          />
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Danh sách vị trí công việc</caption>
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800">
              <th scope="col" className="pb-2 text-left font-medium">Tên vị trí</th>
              <th scope="col" className="pb-2 text-left font-medium">Mã</th>
              <th scope="col" className="pb-2 text-left font-medium">Phòng ban</th>
              <th scope="col" className="pb-2 text-right font-medium">Nhân sự</th>
              <th scope="col" className="pb-2 text-right font-medium">
                <span className="sr-only">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="py-2 text-slate-800 dark:text-slate-200">{row.name}</td>
                <td className="py-2 font-mono text-xs text-slate-500">{row.code}</td>
                <td className="py-2 text-slate-600 dark:text-slate-400">{row.departmentName}</td>
                <td className="py-2 text-right tabular-nums text-slate-600 dark:text-slate-400">
                  {row.userCount}
                </td>
                <td className="py-2 text-right">
                  {canManage ? (
                    <PositionDialog
                      departments={departments}
                      current={row}
                      trigger={
                        <button className="text-sm text-blue-600 hover:underline dark:text-blue-400">
                          Sửa
                        </button>
                      }
                    />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function PositionDialog({
  departments,
  current,
  trigger,
}: {
  departments: Array<{ id: string; name: string; level: number }>
  current?: PositionRow
  trigger: React.ReactNode
}) {
  const isEdit = Boolean(current)

  return (
    <EntityDialog
      trigger={trigger}
      title={isEdit ? `Sửa vị trí: ${current?.name}` : 'Thêm vị trí'}
      description={isEdit ? 'Mã vị trí không đổi được sau khi tạo.' : undefined}
      onSubmit={(formData) =>
        savePositionAction({
          id: current?.id,
          code: String(formData.get('code') ?? ''),
          name: String(formData.get('name') ?? ''),
          departmentId: String(formData.get('departmentId') ?? ''),
        })
      }
    >
      <Field label="Tên vị trí">
        <input name="name" required defaultValue={current?.name} className={inputClass} />
      </Field>

      <Field label="Mã" hint="Chữ in hoa, số và gạch dưới. Ví dụ: SEO_CONTENT">
        <input
          name="code"
          required
          defaultValue={current?.code}
          readOnly={isEdit}
          className={`${inputClass} ${isEdit ? 'cursor-not-allowed opacity-60' : ''}`}
        />
      </Field>

      <Field label="Phòng ban">
        <select name="departmentId" required defaultValue="" className={inputClass}>
          <option value="">— Chọn phòng ban —</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {' '.repeat(d.level * 2)}
              {d.name}
            </option>
          ))}
        </select>
      </Field>
    </EntityDialog>
  )
}
