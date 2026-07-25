'use client'

import { EntityDialog } from './EntityDialog'
import { Field, inputClass } from '@/components/ui/primitives'
import { saveCampaignAction } from '@/app/(dashboard)/campaigns/actions'

export interface CampaignFormValues {
  id: string
  code: string
  name: string
  startDate: string
  endDate: string
  budget: string | null
  isActive: boolean
}

export function CampaignDialog({
  current,
  trigger,
}: {
  current?: CampaignFormValues
  trigger: React.ReactNode
}) {
  const isEdit = Boolean(current)

  return (
    <EntityDialog
      trigger={trigger}
      title={isEdit ? `Sửa chiến dịch: ${current?.name}` : 'Thêm chiến dịch'}
      description={
        isEdit
          ? 'Mã chiến dịch không đổi được sau khi tạo.'
          : 'Mọi báo cáo và dữ liệu quảng cáo đều gắn được vào chiến dịch để tính ROI.'
      }
      onSubmit={(formData) =>
        saveCampaignAction({
          id: current?.id,
          code: String(formData.get('code') ?? ''),
          name: String(formData.get('name') ?? ''),
          startDate: String(formData.get('startDate') ?? ''),
          endDate: String(formData.get('endDate') ?? ''),
          budget: String(formData.get('budget') ?? ''),
          isActive: formData.get('isActive') === 'on',
        })
      }
    >
      <Field label="Tên chiến dịch">
        <input name="name" required defaultValue={current?.name} className={inputClass} />
      </Field>

      <Field label="Mã" hint="Chữ in hoa, số và gạch dưới. Ví dụ: BACK_TO_SCHOOL">
        <input
          name="code"
          required
          defaultValue={current?.code}
          readOnly={isEdit}
          className={`${inputClass} ${isEdit ? 'cursor-not-allowed opacity-60' : ''}`}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Ngày bắt đầu">
          <input
            name="startDate"
            type="date"
            required
            defaultValue={current?.startDate}
            className={inputClass}
          />
        </Field>
        <Field label="Ngày kết thúc">
          <input
            name="endDate"
            type="date"
            required
            defaultValue={current?.endDate}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Ngân sách (VND)" hint="Để trống nếu chưa chốt — hệ thống sẽ không cảnh báo vượt ngân sách">
        <input
          name="budget"
          type="text"
          inputMode="decimal"
          defaultValue={current?.budget ?? ''}
          placeholder="120000000"
          className={inputClass}
        />
      </Field>

      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
        <input name="isActive" type="checkbox" defaultChecked={current?.isActive ?? true} />
        Đang chạy
      </label>
    </EntityDialog>
  )
}
