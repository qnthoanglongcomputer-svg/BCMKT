'use client'

import { ConfirmButton, EntityDialog } from './EntityDialog'
import { Card, Field, buttonClass, inputClass } from '@/components/ui/primitives'
import { deactivateDepartmentAction, saveDepartmentAction } from '@/app/(dashboard)/hr/actions'
import type { DepartmentRow } from '@/server/org/department-service'

export function DepartmentManager({
  rows,
  canManage,
}: {
  rows: DepartmentRow[]
  canManage: boolean
}) {
  return (
    <Card
      title="Cây phòng ban"
      subtitle="Thêm phòng ban, bộ phận hay team là thao tác dữ liệu — không cần lập trình lại."
    >
      {canManage ? (
        <div className="mb-3">
          <DepartmentDialog
            rows={rows}
            trigger={<button className={buttonClass('primary')}>Thêm phòng ban</button>}
          />
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Danh sách phòng ban theo cấu trúc cây</caption>
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800">
              <th scope="col" className="pb-2 text-left font-medium">Tên</th>
              <th scope="col" className="pb-2 text-left font-medium">Mã</th>
              <th scope="col" className="pb-2 text-right font-medium">Nhân sự</th>
              <th scope="col" className="pb-2 text-right font-medium">Vị trí</th>
              <th scope="col" className="pb-2 text-right font-medium">Phòng ban con</th>
              <th scope="col" className="pb-2 text-right font-medium">
                <span className="sr-only">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="py-2 text-slate-800 dark:text-slate-200">
                  <span style={{ paddingLeft: `${row.depth * 1.25}rem` }}>
                    {row.depth > 0 ? (
                      <span aria-hidden="true" className="text-slate-300">└ </span>
                    ) : null}
                    {row.name}
                  </span>
                </td>
                <td className="py-2 font-mono text-xs text-slate-500">{row.code}</td>
                <td className="py-2 text-right tabular-nums text-slate-600 dark:text-slate-400">
                  {row.userCount}
                </td>
                <td className="py-2 text-right tabular-nums text-slate-600 dark:text-slate-400">
                  {row.positionCount}
                </td>
                <td className="py-2 text-right tabular-nums text-slate-600 dark:text-slate-400">
                  {row.childCount}
                </td>
                <td className="py-2 text-right">
                  {canManage ? (
                    <span className="flex items-center justify-end gap-3">
                      <DepartmentDialog
                        rows={rows}
                        current={row}
                        trigger={
                          <button className="text-sm text-blue-600 hover:underline dark:text-blue-400">
                            Sửa
                          </button>
                        }
                      />
                      <ConfirmButton
                        label="Vô hiệu hoá"
                        confirmText={`Vô hiệu hoá phòng ban "${row.name}"? Dữ liệu KPI lịch sử vẫn được giữ nguyên.`}
                        onConfirm={() => deactivateDepartmentAction({ id: row.id })}
                      />
                    </span>
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

function DepartmentDialog({
  rows,
  current,
  trigger,
}: {
  rows: DepartmentRow[]
  current?: DepartmentRow
  trigger: React.ReactNode
}) {
  const isEdit = Boolean(current)
  // Không cho chọn chính nó làm cha; vòng lặp sâu hơn do server chặn.
  const parentOptions = rows.filter((r) => r.id !== current?.id)

  return (
    <EntityDialog
      trigger={trigger}
      title={isEdit ? `Sửa phòng ban: ${current?.name}` : 'Thêm phòng ban'}
      description={
        isEdit
          ? 'Mã phòng ban không đổi được sau khi tạo.'
          : 'Mã dùng để tra cứu ở các màn hình chuyên biệt, đặt xong không đổi được.'
      }
      onSubmit={(formData) =>
        saveDepartmentAction({
          id: current?.id,
          code: String(formData.get('code') ?? ''),
          name: String(formData.get('name') ?? ''),
          parentId: formData.get('parentId') ? String(formData.get('parentId')) : null,
          sortOrder: Number(formData.get('sortOrder') ?? 0),
        })
      }
    >
      <Field label="Tên phòng ban">
        <input name="name" required defaultValue={current?.name} className={inputClass} />
      </Field>

      <Field label="Mã" hint="Chữ in hoa, số và dấu gạch dưới. Ví dụ: CONTENT_SOCIAL">
        <input
          name="code"
          required
          defaultValue={current?.code}
          readOnly={isEdit}
          className={`${inputClass} ${isEdit ? 'cursor-not-allowed opacity-60' : ''}`}
        />
      </Field>

      <Field label="Trực thuộc">
        <select name="parentId" defaultValue={current?.parentId ?? ''} className={inputClass}>
          <option value="">— Không có (phòng ban gốc) —</option>
          {parentOptions.map((r) => (
            <option key={r.id} value={r.id}>
              {' '.repeat(r.depth * 2)}
              {r.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Thứ tự hiển thị" hint="Số nhỏ hiện trước">
        <input
          name="sortOrder"
          type="number"
          min={0}
          max={999}
          defaultValue={0}
          className={inputClass}
        />
      </Field>
    </EntityDialog>
  )
}
