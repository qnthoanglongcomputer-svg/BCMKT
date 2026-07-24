import Decimal from 'decimal.js'
import { gradeFromScore } from './grading'
import type { ScoreItem, ScoreItemResult, ScoreResult } from './types'

/** Trần achievement mặc định: 120%. */
export const DEFAULT_ACHIEVEMENT_CAP = new Decimal('1.2')

/** Số chữ số thập phân của điểm KPI — khớp Decimal(9,4) trong DB. */
export const SCORE_DP = 4

export class ScoringError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ScoringError'
  }
}

/**
 * Tỷ lệ đạt của một metric, đã áp chiều tốt/xấu và trần.
 *
 * - HIGHER_BETTER: actual / target
 * - LOWER_BETTER:  target / actual  (CPA, CPC, chi phí, lỗi, trễ deadline)
 *
 * Chiều lấy từ `kpi_definitions.direction`, không suy đoán theo tên metric.
 */
export function computeAchievement(item: ScoreItem): Decimal {
  const target = new Decimal(item.target)
  const actual = new Decimal(item.actual)
  const cap = new Decimal(item.cap ?? DEFAULT_ACHIEVEMENT_CAP)

  if (target.isZero()) {
    throw new ScoringError(
      `Metric ${item.kpiCode} có target = 0, phải bị loại khỏi công thức trước khi tính.`,
    )
  }

  let achievement: Decimal
  if (item.direction === 'HIGHER_BETTER') {
    achievement = actual.dividedBy(target)
  } else if (actual.isZero()) {
    // Chi phí/lỗi bằng 0 là kết quả tốt nhất có thể — trả về trần thay vì chia cho 0.
    achievement = cap
  } else {
    achievement = target.dividedBy(actual)
  }

  if (achievement.lt(0)) return new Decimal(0)
  return achievement.gt(cap) ? cap : achievement
}

/**
 * Điểm KPI có trọng số.
 *
 * score = Σ (achievement_i × normalizedWeight_i) × 100
 *
 * Metric có target = 0 bị **loại** khỏi công thức và trọng số của các metric
 * còn lại được **chuẩn hoá lại** — không bao giờ chia cho 0.
 *
 * Hàm thuần, không đọc DB.
 */
export function computeScore(items: ScoreItem[]): ScoreResult {
  if (items.length === 0) {
    throw new ScoringError('Không có metric nào để chấm điểm.')
  }

  const included: ScoreItem[] = []
  const excluded: ScoreItemResult[] = []

  for (const item of items) {
    const weight = new Decimal(item.weight)
    if (weight.lt(0)) {
      throw new ScoringError(`Trọng số của ${item.kpiCode} không được âm.`)
    }
    if (new Decimal(item.target).isZero()) {
      excluded.push({
        kpiCode: item.kpiCode,
        achievement: null,
        normalizedWeight: new Decimal(0),
        excluded: true,
        excludedReason: 'Mục tiêu bằng 0',
      })
    } else {
      included.push(item)
    }
  }

  if (included.length === 0) {
    return {
      score: new Decimal(0),
      grade: gradeFromScore(0),
      items: excluded,
    }
  }

  const weightSum = included.reduce<Decimal>(
    (acc, item) => acc.plus(item.weight),
    new Decimal(0),
  )
  if (weightSum.lte(0)) {
    throw new ScoringError('Tổng trọng số của các metric hợp lệ phải lớn hơn 0.')
  }

  let score = new Decimal(0)
  const includedResults: ScoreItemResult[] = included.map((item) => {
    const achievement = computeAchievement(item)
    const normalizedWeight = new Decimal(item.weight).dividedBy(weightSum)
    score = score.plus(achievement.times(normalizedWeight))
    return {
      kpiCode: item.kpiCode,
      achievement,
      normalizedWeight,
      excluded: false,
    }
  })

  const finalScore = score.times(100).toDecimalPlaces(SCORE_DP, Decimal.ROUND_HALF_UP)

  // Giữ nguyên thứ tự đầu vào để UI hiển thị ổn định.
  const byCode = new Map<string, ScoreItemResult>()
  for (const r of [...includedResults, ...excluded]) byCode.set(r.kpiCode, r)

  return {
    score: finalScore,
    grade: gradeFromScore(finalScore),
    items: items.map((i) => byCode.get(i.kpiCode) as ScoreItemResult),
  }
}

/**
 * Kiểm tra tổng trọng số của một nhóm phải bằng 100%.
 * Gọi khi lưu cấu hình trọng số, không gọi lúc chấm điểm.
 */
export function validateWeightGroup(weights: Decimal.Value[]): void {
  if (weights.length === 0) {
    throw new ScoringError('Nhóm trọng số rỗng.')
  }
  const sum = weights.reduce<Decimal>((acc, w) => acc.plus(w), new Decimal(0))
  if (sum.minus(1).abs().gt('0.0001')) {
    throw new ScoringError(
      `Tổng trọng số phải bằng 100%, hiện tại là ${sum.times(100).toFixed(2)}%.`,
    )
  }
}
