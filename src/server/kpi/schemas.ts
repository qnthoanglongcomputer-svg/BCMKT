import { z } from 'zod'

/**
 * Validate đầu vào cho kế hoạch KPI.
 *
 * Số tiền và tỷ lệ nhận dạng **string** rồi mới chuyển sang Decimal — không nhận
 * `number` để tránh mất độ chính xác khi đi qua JSON. Thông báo lỗi bằng tiếng
 * Việt, nêu rõ trường nào sai.
 */

const decimalString = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} không được để trống`)
    .refine((v) => /^-?\d+(\.\d+)?$/.test(v), `${label} phải là số`)
    .refine((v) => Number(v) >= 0, `${label} không được âm`)

/** Bản ghi 12 tháng: khoá "1".."12". */
const twelveMonths = (label: string) =>
  z
    .record(z.string(), decimalString(label))
    .refine(
      (obj) => Array.from({ length: 12 }, (_, i) => String(i + 1)).every((m) => m in obj),
      'Phải nhập đủ giá trị cho cả 12 tháng',
    )

export const ownerTypeSchema = z.enum(['COMPANY', 'DEPARTMENT', 'TEAM', 'EMPLOYEE'])
export const strategySchema = z.enum(['EVEN', 'WEIGHTED', 'MANUAL'])

export const savePlanSchema = z
  .object({
    /** Bỏ trống khi tạo mới */
    planId: z.string().optional(),
    year: z
      .number()
      .int('Năm phải là số nguyên')
      .min(2000, 'Năm phải từ 2000 trở đi')
      .max(2100, 'Năm không được vượt 2100'),
    ownerType: ownerTypeSchema,
    ownerId: z.string().min(1, 'Chưa chọn đối tượng áp dụng'),
    kpiDefinitionId: z.string().min(1, 'Chưa chọn chỉ số'),

    /** Metric SUM: mục tiêu cả năm. Metric RATIO: bỏ qua, hệ thống tự tính. */
    yearTarget: decimalString('Mục tiêu năm').optional(),
    strategy: strategySchema.optional(),

    /** Chỉ dùng khi strategy = WEIGHTED. Giá trị là tỷ lệ (0.05 = 5%). */
    monthWeights: twelveMonths('Tỷ trọng').optional(),

    /** Chỉ dùng khi strategy = MANUAL. Khoá là tháng bị cố định. */
    lockedMonths: z.record(z.string(), decimalString('Giá trị tháng')).optional(),

    /** Chỉ dùng cho metric RATIO: 12 giá trị mục tiêu do admin nhập. */
    monthlyValues: twelveMonths('Mục tiêu tháng').optional(),
  })
  .superRefine((data, ctx) => {
    // Metric RATIO đi đường riêng: không có yearTarget, không có chiến lược phân bổ.
    if (data.monthlyValues) return

    if (!data.yearTarget) {
      ctx.addIssue({
        code: 'custom',
        path: ['yearTarget'],
        message: 'Chưa nhập mục tiêu năm',
      })
    }
    if (!data.strategy) {
      ctx.addIssue({
        code: 'custom',
        path: ['strategy'],
        message: 'Chưa chọn chiến lược phân bổ',
      })
      return
    }
    if (data.strategy === 'WEIGHTED' && !data.monthWeights) {
      ctx.addIssue({
        code: 'custom',
        path: ['monthWeights'],
        message: 'Chiến lược theo tỷ trọng cần nhập tỷ trọng 12 tháng',
      })
    }
    if (
      data.strategy === 'MANUAL' &&
      (!data.lockedMonths || Object.keys(data.lockedMonths).length === 0)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['lockedMonths'],
        message: 'Chiến lược điều chỉnh thủ công cần cố định ít nhất một tháng',
      })
    }
  })

export type SavePlanInput = z.infer<typeof savePlanSchema>

export const saveWeightGroupSchema = z.object({
  groupId: z.string().optional(),
  name: z.string().trim().min(1, 'Chưa nhập tên nhóm'),
  positionId: z.string().min(1, 'Chưa chọn vị trí'),
  effectiveYear: z.number().int().min(2000).max(2100),
  weights: z
    .array(
      z.object({
        kpiDefinitionId: z.string().min(1),
        /** Tỷ lệ: "0.4" = 40% */
        weight: decimalString('Trọng số'),
      }),
    )
    .min(1, 'Nhóm phải có ít nhất một chỉ số')
    .refine((items) => {
      const sum = items.reduce((acc, w) => acc + Number(w.weight), 0)
      return Math.abs(sum - 1) <= 0.0001
    }, 'Tổng trọng số phải bằng 100%')
    .refine((items) => {
      const codes = items.map((w) => w.kpiDefinitionId)
      return new Set(codes).size === codes.length
    }, 'Một chỉ số chỉ được xuất hiện một lần trong nhóm'),
})

export type SaveWeightGroupInput = z.infer<typeof saveWeightGroupSchema>
