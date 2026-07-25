import { z } from 'zod'

/**
 * Định dạng bắt buộc của kết quả AI.
 *
 * Output không parse được → hiện fallback "chưa đủ dữ liệu để kết luận".
 * **Tuyệt đối không render text thô** ra màn hình: người dùng phải luôn nhìn
 * thấy một cấu trúc nhất quán, không phải văn bản tự do của mô hình.
 */

export const impactSchema = z.enum(['HIGH', 'MEDIUM', 'LOW'])

export const insightSchema = z.object({
  cause: z
    .array(
      z.object({
        factor: z.string().min(1).max(200),
        evidence: z.string().min(1).max(400),
        impact: impactSchema,
      }),
    )
    .max(6),
  recommendation: z
    .array(
      z.object({
        action: z.string().min(1).max(200),
        priority: impactSchema,
        expectedEffect: z.string().min(1).max(300),
      }),
    )
    .max(6),
  confidence: z.number().min(0).max(1),
  /** Mô hình tự nói khi dữ liệu không đủ để kết luận */
  insufficientData: z.boolean().default(false),
})

export type Insight = z.infer<typeof insightSchema>

export const IMPACT_LABEL: Record<z.infer<typeof impactSchema>, string> = {
  HIGH: 'Cao',
  MEDIUM: 'Trung bình',
  LOW: 'Thấp',
}

/** Kết quả trả về khi không phân tích được — luôn có cấu trúc, không bao giờ null. */
export const FALLBACK_INSIGHT: Insight = {
  cause: [],
  recommendation: [],
  confidence: 0,
  insufficientData: true,
}
