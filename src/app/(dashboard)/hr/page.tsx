import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireScope } from '@/server/auth/guard'
import { listDepartments } from '@/server/org/department-service'
import { getUserFormOptions, listPositions, listUsers } from '@/server/org/user-service'
import { DepartmentManager } from '@/components/org/DepartmentManager'
import { PositionManager } from '@/components/org/PositionManager'
import { UserManager } from '@/components/org/UserManager'
import { ErrorState, PageHeader } from '@/components/ui/primitives'

export const dynamic = 'force-dynamic'

const TABS = [
  { key: 'users', label: 'Nhân sự' },
  { key: 'departments', label: 'Phòng ban' },
  { key: 'positions', label: 'Vị trí' },
] as const

export default async function HrPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { user, scope } = await requireScope()

  // Nhân viên không xem được danh sách nhân sự của người khác.
  if (user.role === 'EMPLOYEE') notFound()

  const params = await searchParams
  const tab = TABS.find((t) => t.key === params.tab)?.key ?? 'users'
  // Chỉ ADMIN được thay đổi cơ cấu tổ chức; vai trò khác chỉ xem.
  const canManage = user.role === 'ADMIN'

  try {
    const [departments, positions, users, options] = await Promise.all([
      listDepartments(scope),
      listPositions(scope),
      listUsers(scope),
      getUserFormOptions(scope),
    ])

    return (
      <div className="mx-auto max-w-[1600px] p-4 lg:p-6">
        <PageHeader
          title="Nhân sự & tổ chức"
          description={
            canManage
              ? 'Thêm phòng ban, vị trí và nhân sự hoàn toàn qua giao diện — không cần sửa code.'
              : 'Bạn đang xem ở chế độ chỉ đọc. Chỉ quản trị viên mới thay đổi được cơ cấu tổ chức.'
          }
        />

        <nav aria-label="Chọn nhóm dữ liệu" className="mb-4 flex gap-1 border-b border-slate-200 dark:border-slate-800">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/hr?tab=${t.key}`}
              aria-current={tab === t.key ? 'page' : undefined}
              className={
                tab === t.key
                  ? 'border-b-2 border-blue-600 px-3 py-2 text-sm font-medium text-blue-700 dark:text-blue-400'
                  : 'border-b-2 border-transparent px-3 py-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }
            >
              {t.label}
            </Link>
          ))}
        </nav>

        {tab === 'users' ? (
          <UserManager rows={users} options={options} canManage={canManage} />
        ) : null}
        {tab === 'departments' ? (
          <DepartmentManager rows={departments} canManage={canManage} />
        ) : null}
        {tab === 'positions' ? (
          <PositionManager
            rows={positions}
            departments={options.departments}
            canManage={canManage}
          />
        ) : null}
      </div>
    )
  } catch (error) {
    console.error('Không tải được dữ liệu nhân sự:', error)
    return (
      <div className="mx-auto max-w-[1600px] p-4 lg:p-6">
        <ErrorState message="Kiểm tra kết nối cơ sở dữ liệu rồi tải lại trang." />
      </div>
    )
  }
}
