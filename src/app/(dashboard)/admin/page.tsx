import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { AuditAction } from '@prisma/client'
import { requireScope } from '@/server/auth/guard'
import { getAuditFilterOptions, listAuditLog } from '@/server/audit/query'
import { Card, ErrorState, PageHeader, buttonClass, inputClass } from '@/components/ui/primitives'
import { EM_DASH } from '@/lib/format'

export const dynamic = 'force-dynamic'

const ACTION_LABEL: Record<string, string> = {
  CREATE: 'Tạo mới',
  UPDATE: 'Sửa',
  DELETE: 'Vô hiệu hoá',
  APPROVE: 'Duyệt',
  REJECT: 'Từ chối',
  SUBMIT: 'Gửi duyệt',
  REOPEN: 'Mở lại',
  EXPORT: 'Xuất báo cáo',
  LOGIN: 'Đăng nhập',
}

const ENTITY_LABEL: Record<string, string> = {
  user: 'Người dùng',
  department: 'Phòng ban',
  position: 'Vị trí',
  kpi_plan: 'Kế hoạch KPI',
  kpi_weight_group: 'Nhóm trọng số',
  campaign: 'Chiến dịch',
  report: 'Báo cáo',
  export: 'Xuất báo cáo',
}

/** Định dạng thời điểm đầy đủ theo múi giờ nghiệp vụ. */
function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    actorId?: string
    entityType?: string
    action?: string
    from?: string
    to?: string
    cursor?: string
  }>
}) {
  const { user } = await requireScope()
  // Nhật ký hệ thống chứa dấu vết mọi thay đổi — chỉ quản trị viên được xem.
  if (user.role !== 'ADMIN') notFound()

  const params = await searchParams

  try {
    const [page, options] = await Promise.all([
      listAuditLog({
        actorId: params.actorId || undefined,
        entityType: params.entityType || undefined,
        action: (params.action as AuditAction) || undefined,
        from: params.from ? new Date(`${params.from}T00:00:00+07:00`) : undefined,
        to: params.to ? new Date(`${params.to}T23:59:59+07:00`) : undefined,
        cursor: params.cursor || undefined,
      }),
      getAuditFilterOptions(),
    ])

    const buildUrl = (overrides: Record<string, string | undefined>) => {
      const next = new URLSearchParams()
      for (const [key, value] of Object.entries({ ...params, ...overrides })) {
        if (value) next.set(key, value)
      }
      return `/admin?${next.toString()}`
    }

    return (
      <div className="mx-auto max-w-[1600px] p-4 lg:p-6">
        <PageHeader
          title="Quản trị hệ thống"
          description="Nhật ký thay đổi dữ liệu. Bản ghi chỉ được thêm, không ai sửa hay xoá được — kể cả quản trị viên."
        />

        <Card className="mb-4">
          <form method="get" action="/admin" className="grid grid-cols-1 gap-3 sm:grid-cols-5">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Người thực hiện
              </span>
              <select name="actorId" defaultValue={params.actorId ?? ''} className={inputClass}>
                <option value="">Tất cả</option>
                {options.actors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.fullName}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Đối tượng
              </span>
              <select name="entityType" defaultValue={params.entityType ?? ''} className={inputClass}>
                <option value="">Tất cả</option>
                {options.entityTypes.map((t) => (
                  <option key={t} value={t}>
                    {ENTITY_LABEL[t] ?? t}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Hành động
              </span>
              <select name="action" defaultValue={params.action ?? ''} className={inputClass}>
                <option value="">Tất cả</option>
                {Object.entries(ACTION_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Từ ngày
              </span>
              <input type="date" name="from" defaultValue={params.from ?? ''} className={inputClass} />
            </label>

            <div className="flex items-end gap-2">
              <label className="block flex-1">
                <span className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Đến ngày
                </span>
                <input type="date" name="to" defaultValue={params.to ?? ''} className={inputClass} />
              </label>
              <button type="submit" className={buttonClass('primary')}>
                Lọc
              </button>
            </div>
          </form>
        </Card>

        <Card>
          {page.rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              Không có bản ghi nào khớp bộ lọc.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Nhật ký thay đổi hệ thống</caption>
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800">
                    <th scope="col" className="pb-2 text-left font-medium">Thời điểm</th>
                    <th scope="col" className="pb-2 text-left font-medium">Người thực hiện</th>
                    <th scope="col" className="pb-2 text-left font-medium">Hành động</th>
                    <th scope="col" className="pb-2 text-left font-medium">Đối tượng</th>
                    <th scope="col" className="pb-2 text-left font-medium">Trường</th>
                    <th scope="col" className="pb-2 text-left font-medium">Giá trị cũ → mới</th>
                  </tr>
                </thead>
                <tbody>
                  {page.rows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                      <td className="py-2 whitespace-nowrap text-xs tabular-nums text-slate-500">
                        {formatDateTime(row.createdAt)}
                      </td>
                      <td className="py-2 text-slate-800 dark:text-slate-200">
                        {row.actorName ?? (
                          <span className="text-slate-400" title="Hành động tự động của hệ thống">
                            Hệ thống
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-slate-600 dark:text-slate-400">
                        {ACTION_LABEL[row.action] ?? row.action}
                      </td>
                      <td className="py-2 text-slate-600 dark:text-slate-400">
                        {ENTITY_LABEL[row.entityType] ?? row.entityType}
                      </td>
                      <td className="py-2 font-mono text-xs text-slate-500">{row.field ?? EM_DASH}</td>
                      <td className="py-2 text-xs">
                        {row.field === null ? (
                          <span className="text-slate-400">{EM_DASH}</span>
                        ) : (
                          <span className="tabular-nums">
                            <span className="text-slate-500">{row.oldValue ?? '(trống)'}</span>
                            <span className="mx-1 text-slate-400">→</span>
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              {row.newValue ?? '(trống)'}
                            </span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {page.rows.length} bản ghi trên trang này
            </span>
            <div className="flex gap-2">
              {params.cursor ? (
                <Link href={buildUrl({ cursor: undefined })} className={buttonClass('secondary')}>
                  ← Về đầu
                </Link>
              ) : null}
              {page.nextCursor ? (
                <Link
                  href={buildUrl({ cursor: page.nextCursor })}
                  className={buttonClass('secondary')}
                >
                  Trang sau →
                </Link>
              ) : null}
            </div>
          </div>
        </Card>
      </div>
    )
  } catch (error) {
    console.error('Không tải được nhật ký hệ thống:', error)
    return (
      <div className="mx-auto max-w-[1600px] p-4 lg:p-6">
        <ErrorState message="Kiểm tra kết nối cơ sở dữ liệu rồi tải lại trang." />
      </div>
    )
  }
}
