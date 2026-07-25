import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { getDepartmentDashboard } from '@/server/dashboard/department'
import { isDepartmentInScope, type Scope } from '@/server/auth/scope'
import { AiInsightError, complete, getModel, isConfigured } from './client'
import { parseInsight } from './parse'
import { FALLBACK_INSIGHT, type Insight } from './schema'
import {
  PROMPT_VERSION,
  SYSTEM_PROMPT,
  buildUserPrompt,
  type AnalysisInput,
} from './prompts/kpi-analysis.v1'

export { AiInsightError, isConfigured }

export interface InsightResult {
  insight: Insight
  /** Lấy từ cache hay vừa gọi API */
  fromCache: boolean
  model: string
  promptVersion: string
  generatedAt: Date
  /** Nêu lý do khi không phân tích được, để UI hiển thị thay vì im lặng */
  reason?: string
}

/**
 * Hash dữ liệu đầu vào để cache.
 *
 * Số liệu không đổi → không gọi lại API. Đây là cơ chế kiểm soát chi phí chính:
 * dashboard mở lại nhiều lần trong ngày nhưng dữ liệu chỉ đổi khi có báo cáo mới.
 */
function hashInput(input: AnalysisInput): string {
  const canonical = JSON.stringify({
    scope: input.scopeName,
    period: input.periodLabel,
    elapsed: input.elapsedDays,
    score: input.score,
    // Sắp xếp để thứ tự metric không làm đổi hash
    metrics: [...input.metrics]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((m) => [m.name, m.target, m.actual, m.attainment, m.delta]),
    // Đổi prompt là đổi hành vi — phải coi là dữ liệu khác.
    promptVersion: PROMPT_VERSION,
  })
  return createHash('sha256').update(canonical).digest('hex')
}

/** Gom số liệu bộ phận thành đầu vào cho AI. AI **không tự truy vấn DB**. */
async function buildAnalysisInput(
  departmentCode: string,
  today: Date,
  scope: Scope,
): Promise<{ input: AnalysisInput; departmentId: string; periodStart: Date } | null> {
  const dashboard = await getDepartmentDashboard(departmentCode, today, scope)
  if (!dashboard || !dashboard.hasData) return null

  const metrics = dashboard.groups.flatMap((g) =>
    g.metrics.map((m) => ({
      name: m.name,
      unit: m.unit,
      direction: m.direction === 'LOWER_BETTER' ? 'Thấp hơn tốt' : 'Cao hơn tốt',
      target: m.target,
      actual: m.actual,
      attainment: m.attainment,
      delta: m.delta,
    })),
  )

  return {
    departmentId: dashboard.department.id,
    periodStart: dashboard.period.start,
    input: {
      scopeName: dashboard.department.name,
      periodLabel: `Tháng ${dashboard.period.start.getUTCMonth() + 1}/${dashboard.period.start.getUTCFullYear()}`,
      elapsedDays: dashboard.period.elapsedDays,
      totalDays: dashboard.period.totalDays,
      score: dashboard.score.value,
      grade: dashboard.score.grade,
      metrics,
    },
  }
}

export async function getInsight(
  departmentCode: string,
  today: Date,
  scope: Scope,
  options: { force?: boolean } = {},
): Promise<InsightResult | null> {
  const built = await buildAnalysisInput(departmentCode, today, scope)
  if (!built) return null

  const { input, departmentId, periodStart } = built
  if (!isDepartmentInScope(scope, departmentId)) return null

  const model = getModel()
  const dataHash = hashInput(input)

  if (!options.force) {
    const cached = await prisma.aiInsight.findFirst({
      where: {
        ownerType: 'DEPARTMENT',
        ownerId: departmentId,
        periodType: 'MONTH',
        periodStart,
        dataHash,
      },
      select: { payload: true, model: true, promptVersion: true, createdAt: true },
    })

    if (cached) {
      // Payload đã được validate trước khi lưu; parse lại để chắc chắn.
      const parsed = parseInsight(JSON.stringify(cached.payload))
      if (parsed.ok) {
        return {
          insight: parsed.insight,
          fromCache: true,
          model: cached.model,
          promptVersion: cached.promptVersion,
          generatedAt: cached.createdAt,
        }
      }
    }
  }

  if (!isConfigured()) {
    return {
      insight: FALLBACK_INSIGHT,
      fromCache: false,
      model,
      promptVersion: PROMPT_VERSION,
      generatedAt: today,
      reason: 'Chưa cấu hình khoá API cho tính năng AI.',
    }
  }

  // Dữ liệu quá ít thì không gọi API — tiết kiệm chi phí và tránh kết luận bừa.
  if (input.elapsedDays < 3) {
    return {
      insight: FALLBACK_INSIGHT,
      fromCache: false,
      model,
      promptVersion: PROMPT_VERSION,
      generatedAt: today,
      reason: `Mới có ${input.elapsedDays} ngày dữ liệu trong kỳ, chưa đủ để phân tích.`,
    }
  }

  const completion = await complete(SYSTEM_PROMPT, buildUserPrompt(input))
  const parsed = parseInsight(completion.text)

  if (!parsed.ok) {
    // Output hỏng → fallback có cấu trúc, KHÔNG hiển thị text thô.
    console.error('Không parse được kết quả AI:', parsed.reason)
    return {
      insight: FALLBACK_INSIGHT,
      fromCache: false,
      model,
      promptVersion: PROMPT_VERSION,
      generatedAt: today,
      reason: 'Kết quả phân tích không đúng định dạng. Thử phân tích lại.',
    }
  }

  // Chỉ cache kết quả hợp lệ.
  await prisma.aiInsight.upsert({
    where: {
      ownerType_ownerId_periodType_periodStart_dataHash: {
        ownerType: 'DEPARTMENT',
        ownerId: departmentId,
        periodType: 'MONTH',
        periodStart,
        dataHash,
      },
    },
    update: { payload: parsed.insight, model, promptVersion: PROMPT_VERSION },
    create: {
      ownerType: 'DEPARTMENT',
      ownerId: departmentId,
      periodType: 'MONTH',
      periodStart,
      dataHash,
      payload: parsed.insight,
      model,
      promptVersion: PROMPT_VERSION,
    },
  })

  return {
    insight: parsed.insight,
    fromCache: false,
    model,
    promptVersion: PROMPT_VERSION,
    generatedAt: today,
  }
}
