import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireScope } from '@/server/auth/guard'
import { getInsight, isConfigured } from '@/server/ai/insight-service'
import { prisma } from '@/lib/prisma'
import { Alert, Card, EmptyState, ErrorState, PageHeader, inputClass } from '@/components/ui/primitives'
import { IMPACT_LABEL } from '@/server/ai/schema'
import { ReanalyzeButton } from './ReanalyzeButton'

export const dynamic = 'force-dynamic'

const IMPACT_STYLE: Record<string, string> = {
  HIGH: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
  MEDIUM: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  LOW: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

export default async function AiInsightPage({
  searchParams,
}: {
  searchParams: Promise<{ dept?: string }>
}) {
  const { user, scope } = await requireScope()
  // Phân tích AI là công cụ điều hành — nhân viên không dùng.
  if (user.role === 'EMPLOYEE') notFound()

  const params = await searchParams

  const departments = await prisma.department.findMany({
    where: {
      deletedAt: null,
      level: 2,
      ...(scope.departmentIds === null ? {} : { id: { in: scope.departmentIds } }),
    },
    select: { code: true, name: true },
    orderBy: { sortOrder: 'asc' },
  })

  const selectedCode = params.dept ?? departments[0]?.code

  if (!selectedCode) {
    return (
      <div className="mx-auto max-w-[1200px] p-4 lg:p-6">
        <PageHeader title="AI Insight" />
        <EmptyState
          title="Chưa có bộ phận nào trong phạm vi của bạn"
          description="Cần ít nhất một bộ phận có dữ liệu KPI để phân tích."
        />
      </div>
    )
  }

  const canReanalyze = user.role === 'ADMIN' || user.role === 'MARKETING_MANAGER'

  try {
    const result = await getInsight(selectedCode, new Date(), scope)
    const selectedName = departments.find((d) => d.code === selectedCode)?.name ?? selectedCode

    return (
      <div className="mx-auto max-w-[1200px] p-4 lg:p-6">
        <PageHeader
          title="AI Insight"
          description="Phân tích nguyên nhân và đề xuất hành động dựa trên số liệu KPI đã tính."
          actions={
            <div className="flex items-end gap-2">
              <form method="get" action="/ai-insight">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Bộ phận
                  </span>
                  <select
                    name="dept"
                    defaultValue={selectedCode}
                    className={inputClass}
                    // Submit ngay khi đổi lựa chọn — không cần nút riêng.
                    onChange={undefined}
                  >
                    {departments.map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="sr-only">
                  Xem
                </button>
              </form>
              {canReanalyze && result ? (
                <ReanalyzeButton departmentCode={selectedCode} />
              ) : null}
            </div>
          }
        />

        {!isConfigured() ? (
          <div className="mb-4">
            <Alert tone="warning">
              Tính năng AI chưa được cấu hình. Quản trị viên cần đặt{' '}
              <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">ANTHROPIC_API_KEY</code>{' '}
              trong biến môi trường của hệ thống.
            </Alert>
          </div>
        ) : null}

        {!result ? (
          <EmptyState
            title={`Chưa có dữ liệu KPI cho ${selectedName}`}
            description="Cần có kế hoạch KPI và số liệu thực tế trong kỳ hiện tại thì mới phân tích được."
            action={
              <Link
                href="/kpi/planning/new"
                className="text-sm text-blue-600 hover:underline dark:text-blue-400"
              >
                Thiết lập KPI →
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            <Alert tone="info">
              <strong>Nội dung do AI phân tích.</strong> Số liệu do hệ thống tính, AI chỉ diễn giải.
              Luôn đối chiếu với dashboard trước khi ra quyết định.
              {result.fromCache ? ' Kết quả lấy từ bộ nhớ đệm (dữ liệu chưa thay đổi).' : ''}
            </Alert>

            {result.reason ? (
              <Card>
                <p className="py-6 text-center text-sm text-slate-500">{result.reason}</p>
              </Card>
            ) : result.insight.insufficientData ? (
              <Card>
                <p className="py-6 text-center text-sm text-slate-500">
                  Chưa đủ dữ liệu để kết luận. Cần thêm số liệu thực tế trong kỳ.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card
                  title="Nguyên nhân"
                  subtitle={`${result.insight.cause.length} yếu tố được xác định`}
                >
                  {result.insight.cause.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-500">
                      Không phát hiện bất thường trong kỳ này.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {result.insight.cause.map((c, i) => (
                        <li key={i} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0 dark:border-slate-800">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                              {c.factor}
                            </span>
                            <span
                              className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${IMPACT_STYLE[c.impact]}`}
                            >
                              {IMPACT_LABEL[c.impact]}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                            {c.evidence}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                <Card
                  title="Đề xuất hành động"
                  subtitle="Sắp xếp theo mức độ ưu tiên"
                >
                  {result.insight.recommendation.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-500">
                      Không có đề xuất nào cho kỳ này.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {[...result.insight.recommendation]
                        .sort((a, b) => rank(a.priority) - rank(b.priority))
                        .map((r, i) => (
                          <li key={i} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0 dark:border-slate-800">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                {r.action}
                              </span>
                              <span
                                className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${IMPACT_STYLE[r.priority]}`}
                              >
                                {IMPACT_LABEL[r.priority]}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                              {r.expectedEffect}
                            </p>
                          </li>
                        ))}
                    </ul>
                  )}
                </Card>
              </div>
            )}

            <p className="text-xs text-slate-400">
              Mô hình: {result.model} · Prompt: {result.promptVersion} · Độ tin cậy:{' '}
              {(result.insight.confidence * 100).toFixed(0)}%
            </p>
          </div>
        )}
      </div>
    )
  } catch (error) {
    console.error('Không tải được AI insight:', error)
    return (
      <div className="mx-auto max-w-[1200px] p-4 lg:p-6">
        <ErrorState message="Không phân tích được. Kiểm tra cấu hình AI rồi thử lại." />
      </div>
    )
  }
}

function rank(priority: 'HIGH' | 'MEDIUM' | 'LOW'): number {
  return { HIGH: 0, MEDIUM: 1, LOW: 2 }[priority]
}
