import Decimal from 'decimal.js'
import type { Grade } from './types'

/**
 * Ngưỡng xếp loại KPI — **nguồn sự thật duy nhất** của toàn hệ thống.
 * Không hardcode các số 95/90/80/70 ở bất kỳ nơi nào khác.
 *
 * Đặc tả gốc ghi các khoảng chồng lấn (95-100 A+, 90-95 A, 80-89 B).
 * Ở đây chuẩn hoá thành các khoảng không chồng lấn, cận dưới đóng.
 */
export const GRADE_THRESHOLDS: ReadonlyArray<{ min: number; grade: Grade }> = [
  { min: 95, grade: 'A+' },
  { min: 90, grade: 'A' },
  { min: 80, grade: 'B' },
  { min: 70, grade: 'C' },
  { min: 0, grade: 'D' },
]

export function gradeFromScore(score: Decimal.Value): Grade {
  const value = new Decimal(score)
  for (const threshold of GRADE_THRESHOLDS) {
    if (value.gte(threshold.min)) return threshold.grade
  }
  return 'D'
}
