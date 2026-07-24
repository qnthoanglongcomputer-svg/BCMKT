import Decimal from 'decimal.js'
import type { MetricAggregation } from './types'

/**
 * Rollup kết quả thực tế đi ngược lên cây tổ chức:
 * Nhân viên → Team → Bộ phận → Marketing → Công ty.
 *
 * Nguyên tắc sống còn: metric tỷ lệ (CPA, CPC, CTR, ROAS, AOV, ROS) phải được
 * **tính lại từ tử số và mẫu số đã cộng dồn**. Lấy trung bình của các tỷ lệ
 * cho ra số sai — đây là lỗi nghiêm trọng.
 */

/** Một giá trị metric ở cấp con, chuẩn bị cộng lên cấp cha. */
export interface RollupNode {
  /** Dùng cho metric SUM */
  value?: Decimal.Value
  /** Dùng cho metric RATIO */
  numerator?: Decimal.Value
  denominator?: Decimal.Value
}

export interface RollupResult {
  /** Giá trị ở cấp cha; null khi metric RATIO có mẫu số bằng 0 */
  value: Decimal | null
  numerator: Decimal | null
  denominator: Decimal | null
}

export class RollupError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RollupError'
  }
}

/** Cộng dồn thuần cho metric SUM. */
export function rollupSum(nodes: RollupNode[]): Decimal {
  return nodes.reduce<Decimal>((acc, node) => {
    if (node.value === undefined) {
      throw new RollupError('Metric SUM thiếu trường value.')
    }
    return acc.plus(node.value)
  }, new Decimal(0))
}

/**
 * Cộng tử số và mẫu số, rồi chia — KHÔNG lấy trung bình các tỷ lệ.
 * Mẫu số bằng 0 → trả null (chưa xác định), không chia cho 0, không trả 0.
 */
export function rollupRatio(nodes: RollupNode[]): RollupResult {
  let numerator = new Decimal(0)
  let denominator = new Decimal(0)

  for (const node of nodes) {
    if (node.numerator === undefined || node.denominator === undefined) {
      throw new RollupError('Metric RATIO thiếu numerator hoặc denominator.')
    }
    numerator = numerator.plus(node.numerator)
    denominator = denominator.plus(node.denominator)
  }

  return {
    value: denominator.isZero() ? null : numerator.dividedBy(denominator),
    numerator,
    denominator,
  }
}

/** Điểm vào chung: chọn cách cộng dồn theo `kpi_definitions.aggregation`. */
export function rollup(aggregation: MetricAggregation, nodes: RollupNode[]): RollupResult {
  if (nodes.length === 0) {
    return { value: null, numerator: null, denominator: null }
  }
  if (aggregation === 'SUM') {
    return { value: rollupSum(nodes), numerator: null, denominator: null }
  }
  return rollupRatio(nodes)
}

/**
 * Gom kết quả của nhiều kỳ con thành một kỳ cha (ngày → tuần/tháng → quý → năm).
 * Cùng quy tắc như rollup theo cây tổ chức.
 */
export const rollupPeriods = rollup
