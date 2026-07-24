import type Decimal from 'decimal.js'

export type PeriodType = 'YEAR' | 'QUARTER' | 'MONTH' | 'WEEK' | 'DAY'
export type OwnerType = 'COMPANY' | 'DEPARTMENT' | 'TEAM' | 'EMPLOYEE'
export type MetricDirection = 'HIGHER_BETTER' | 'LOWER_BETTER'
export type MetricAggregation = 'SUM' | 'RATIO'
export type AllocationStrategy = 'EVEN' | 'WEIGHTED' | 'MANUAL'

/// Một khoảng thời gian đóng ở cả hai đầu, theo lịch Asia/Ho_Chi_Minh.
export interface Period {
  type: PeriodType
  /// Ngày đầu kỳ, UTC-midnight đại diện cho ngày lịch
  start: Date
  /// Ngày cuối kỳ, bao gồm
  end: Date
  /// Số ngày trong kỳ
  days: number
}

export interface AllocatedPeriod extends Period {
  value: Decimal
}

/// Kết quả phân bổ đầy đủ cho một năm
export interface AllocationResult {
  year: AllocatedPeriod
  quarters: AllocatedPeriod[]
  months: AllocatedPeriod[]
  weeks: AllocatedPeriod[]
  days: AllocatedPeriod[]
}

export interface AllocationInput {
  year: number
  yearTarget: Decimal.Value
  strategy: AllocationStrategy
  /// Chỉ dùng khi strategy = WEIGHTED. Khoá là tháng 1–12, giá trị là tỷ trọng (0.05 = 5%).
  monthWeights?: Record<number, Decimal.Value>
  /// Chỉ dùng khi strategy = MANUAL. Khoá là tháng 1–12, giá trị là mục tiêu cố định.
  lockedMonths?: Record<number, Decimal.Value>
}

/// Một dòng metric dùng để chấm điểm
export interface ScoreItem {
  kpiCode: string
  target: Decimal.Value
  actual: Decimal.Value
  /// 0.4 = 40%
  weight: Decimal.Value
  direction: MetricDirection
  /// Trần achievement, mặc định 1.2 (120%)
  cap?: Decimal.Value
}

export interface ScoreItemResult {
  kpiCode: string
  /// Tỷ lệ đạt sau khi áp chiều và trần; null khi metric bị loại
  achievement: Decimal | null
  /// Trọng số sau khi chuẩn hoá trên các metric còn lại
  normalizedWeight: Decimal
  excluded: boolean
  excludedReason?: string
}

export interface ScoreResult {
  /// Điểm KPI 0–120
  score: Decimal
  grade: Grade
  items: ScoreItemResult[]
}

export type Grade = 'A+' | 'A' | 'B' | 'C' | 'D'

export interface ForecastInput {
  actualToDate: Decimal.Value
  daysElapsed: number
  totalDays: number
  /// Trọng số từng ngày trong kỳ khi phân bổ là WEIGHTED. Độ dài phải bằng totalDays.
  dayWeights?: Decimal.Value[]
}

export interface ForecastResult {
  /// Giá trị dự báo cuối kỳ; null khi chưa đủ dữ liệu
  value: Decimal | null
  /// 0–1
  confidence: Decimal | null
  daysUsed: number
  reason?: string
}
