import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireScope, ForbiddenError, UnauthorizedError } from '@/server/auth/guard'
import { buildExportPayload, ExportError } from '@/server/reports/export-data'
import { buildExcel, buildFileName } from '@/server/reports/excel'
import { logAudit } from '@/server/audit/log'

/**
 * Xuất báo cáo Excel.
 *
 * Route handler chỉ điều phối: auth → validate → gom dữ liệu (đã áp scope) →
 * sinh file → ghi audit. Không có công thức nghiệp vụ ở đây.
 */

const querySchema = z.object({
  periodType: z.enum(['MONTH', 'QUARTER', 'YEAR']).default('MONTH'),
  /** Ngày bất kỳ trong kỳ, dạng yyyy-MM-dd */
  anchor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  departmentId: z.string().optional(),
})

export async function GET(request: Request) {
  const url = new URL(request.url)
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams))

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_INPUT',
          message: parsed.error.issues[0]?.message ?? 'Tham số không hợp lệ',
        },
      },
      { status: 400 },
    )
  }

  try {
    const { user, scope } = await requireScope()

    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: { fullName: true },
    })

    const now = new Date()
    const anchor = parsed.data.anchor
      ? new Date(`${parsed.data.anchor}T00:00:00Z`)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

    const payload = await buildExportPayload(
      {
        periodType: parsed.data.periodType,
        anchor,
        departmentId: parsed.data.departmentId,
      },
      scope,
      profile?.fullName ?? 'Không xác định',
      now,
    )

    const buffer = await buildExcel(payload)
    const fileName = buildFileName(payload, 'xlsx')

    // File rời khỏi hệ thống — phải biết ai xuất, lúc nào, phạm vi nào.
    const headerList = await headers()
    await prisma.$transaction(async (tx) => {
      await logAudit(tx, {
        actorId: user.id,
        action: 'EXPORT',
        entityType: 'export',
        entityId: fileName,
        changes: [
          { field: 'periodType', oldValue: null, newValue: parsed.data.periodType },
          { field: 'scope', oldValue: null, newValue: payload.meta.departmentFilter },
          { field: 'rowCount', oldValue: null, newValue: String(payload.rows.length) },
        ],
        ipAddress: headerList.get('x-forwarded-for') ?? null,
        userAgent: headerList.get('user-agent') ?? null,
      })
    })

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'content-type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="${fileName}"`,
        // Dữ liệu có phân quyền — không cache ở bất kỳ tầng nào.
        'cache-control': 'no-store, private',
      },
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: error.message } },
        { status: 401 },
      )
    }
    if (error instanceof ForbiddenError || error instanceof ExportError) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: error.message } },
        { status: 403 },
      )
    }
    console.error('Xuất báo cáo thất bại:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Không xuất được báo cáo. Vui lòng thử lại.' } },
      { status: 500 },
    )
  }
}
