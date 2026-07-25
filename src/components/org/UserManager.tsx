'use client'

import { ConfirmButton, EntityDialog } from './EntityDialog'
import { Card, Field, buttonClass, inputClass } from '@/components/ui/primitives'
import { resetPasswordAction, saveUserAction } from '@/app/(dashboard)/hr/actions'
import type { UserRow } from '@/server/org/user-service'

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Quản trị viên',
  MARKETING_MANAGER: 'Trưởng phòng Marketing',
  LEADER: 'Trưởng bộ phận',
  EMPLOYEE: 'Nhân viên',
}

export interface UserFormOptions {
  departments: Array<{ id: string; name: string; level: number }>
  positions: Array<{ id: string; name: string; department: { name: string } }>
}

export function UserManager({
  rows,
  options,
  canManage,
}: {
  rows: UserRow[]
  options: UserFormOptions
  canManage: boolean
}) {
  return (
    <Card title="Nhân sự" subtitle={`${rows.length} tài khoản trong phạm vi của bạn`}>
      {canManage ? (
        <div className="mb-3">
          <UserDialog
            options={options}
            trigger={<button className={buttonClass('primary')}>Thêm nhân sự</button>}
          />
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Danh sách nhân sự</caption>
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800">
              <th scope="col" className="pb-2 text-left font-medium">Họ tên</th>
              <th scope="col" className="pb-2 text-left font-medium">Email</th>
              <th scope="col" className="pb-2 text-left font-medium">Vai trò</th>
              <th scope="col" className="pb-2 text-left font-medium">Bộ phận</th>
              <th scope="col" className="pb-2 text-left font-medium">Vị trí</th>
              <th scope="col" className="pb-2 text-center font-medium">Trạng thái</th>
              <th scope="col" className="pb-2 text-right font-medium">
                <span className="sr-only">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="py-2 text-slate-800 dark:text-slate-200">{row.fullName}</td>
                <td className="py-2 text-slate-600 dark:text-slate-400">{row.email}</td>
                <td className="py-2 text-slate-600 dark:text-slate-400">
                  {ROLE_LABEL[row.role] ?? row.role}
                </td>
                <td className="py-2 text-slate-600 dark:text-slate-400">
                  {row.departmentName ?? '—'}
                </td>
                <td className="py-2 text-slate-600 dark:text-slate-400">
                  {row.positionName ?? '—'}
                </td>
                <td className="py-2 text-center">
                  <span
                    className={
                      row.isActive
                        ? 'rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }
                  >
                    {row.isActive ? 'Hoạt động' : 'Đã khoá'}
                  </span>
                </td>
                <td className="py-2 text-right">
                  {canManage ? (
                    <span className="flex items-center justify-end gap-3">
                      <UserDialog
                        options={options}
                        current={row}
                        trigger={
                          <button className="text-sm text-blue-600 hover:underline dark:text-blue-400">
                            Sửa
                          </button>
                        }
                      />
                      <ResetPasswordDialog user={row} />
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

function UserDialog({
  options,
  current,
  trigger,
}: {
  options: UserFormOptions
  current?: UserRow
  trigger: React.ReactNode
}) {
  const isEdit = Boolean(current)

  return (
    <EntityDialog
      trigger={trigger}
      title={isEdit ? `Sửa nhân sự: ${current?.fullName}` : 'Thêm nhân sự'}
      description={
        isEdit
          ? 'Đổi mật khẩu bằng chức năng Đặt lại mật khẩu riêng.'
          : 'Mật khẩu tối thiểu 8 ký tự, có cả chữ và số.'
      }
      onSubmit={(formData) =>
        saveUserAction({
          id: current?.id,
          email: String(formData.get('email') ?? ''),
          fullName: String(formData.get('fullName') ?? ''),
          role: String(formData.get('role') ?? 'EMPLOYEE'),
          departmentId: formData.get('departmentId') ? String(formData.get('departmentId')) : null,
          positionId: formData.get('positionId') ? String(formData.get('positionId')) : null,
          isActive: formData.get('isActive') === 'on',
          password: isEdit ? undefined : String(formData.get('password') ?? ''),
        })
      }
    >
      <Field label="Họ và tên">
        <input name="fullName" required defaultValue={current?.fullName} className={inputClass} />
      </Field>

      <Field label="Email">
        <input
          name="email"
          type="email"
          required
          defaultValue={current?.email}
          className={inputClass}
        />
      </Field>

      {!isEdit ? (
        <Field label="Mật khẩu" hint="Ít nhất 8 ký tự, có cả chữ và số">
          <input name="password" type="password" required minLength={8} className={inputClass} />
        </Field>
      ) : null}

      <Field label="Vai trò">
        <select name="role" defaultValue={current?.role ?? 'EMPLOYEE'} className={inputClass}>
          {Object.entries(ROLE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Bộ phận">
        <select name="departmentId" defaultValue="" className={inputClass}>
          <option value="">— Chưa gán —</option>
          {options.departments.map((d) => (
            <option key={d.id} value={d.id}>
              {' '.repeat(d.level * 2)}
              {d.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Vị trí">
        <select name="positionId" defaultValue="" className={inputClass}>
          <option value="">— Chưa gán —</option>
          {options.positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.department.name}
            </option>
          ))}
        </select>
      </Field>

      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
        <input name="isActive" type="checkbox" defaultChecked={current?.isActive ?? true} />
        Tài khoản hoạt động
      </label>
    </EntityDialog>
  )
}

function ResetPasswordDialog({ user }: { user: UserRow }) {
  return (
    <EntityDialog
      trigger={
        <button className="text-sm text-slate-600 hover:underline dark:text-slate-400">
          Đặt lại mật khẩu
        </button>
      }
      title={`Đặt lại mật khẩu: ${user.fullName}`}
      description="Mật khẩu mới có hiệu lực ngay. Hệ thống không lưu và không hiển thị lại mật khẩu."
      submitLabel="Đặt lại"
      onSubmit={(formData) =>
        resetPasswordAction({
          userId: user.id,
          password: String(formData.get('password') ?? ''),
        })
      }
    >
      <Field label="Mật khẩu mới" hint="Ít nhất 8 ký tự, có cả chữ và số">
        <input name="password" type="password" required minLength={8} className={inputClass} />
      </Field>
    </EntityDialog>
  )
}

/** Nút vô hiệu hoá nhanh, dùng khi cần đóng tài khoản gấp. */
export function DeactivateUserButton({ user }: { user: UserRow }) {
  return (
    <ConfirmButton
      label="Khoá"
      confirmText={`Khoá tài khoản "${user.fullName}"? Họ sẽ không đăng nhập được nữa.`}
      onConfirm={() =>
        saveUserAction({
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          departmentId: null,
          positionId: null,
          isActive: false,
        })
      }
    />
  )
}
