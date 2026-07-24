import Decimal from 'decimal.js'
import type { ForecastInput, ForecastResult } from './types'

/** Dưới ngưỡng này thì không dự báo — số liệu quá ít để có ý nghĩa. */
export const MIN_DAYS_FOR_FORECAST = 3

export class ForecastError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ForecastError'
  }
}

/**
 * Dự báo giá trị cuối kỳ theo tốc độ hiện tại.
 *
 * - Không có dayWeights: ngoại suy tuyến tính theo số ngày.
 * - Có dayWeights (phân bổ WEIGHTED): ngoại suy theo tỷ trọng, vì các ngày
 *   không đóng góp như nhau.
 *
 * Trả `value = null` khi chưa đủ dữ liệu, kèm `reason` — không đoán bừa.
 * Luôn kèm `confidence` và số ngày dữ liệu đã dùng.
 */
export function forecastPeriod(input: ForecastInput): ForecastResult {
  const { daysElapsed, totalDays } = input

  if (!Number.isInteger(totalDays) || totalDays <= 0) {
    throw new ForecastError(`Số ngày trong kỳ không hợp lệ: ${totalDays}.`)
  }
  if (!Number.isInteger(daysElapsed) || daysElapsed < 0) {
    throw new ForecastError(`Số ngày đã qua không hợp lệ: ${daysElapsed}.`)
  }
  if (daysElapsed > totalDays) {
    throw new ForecastError(
      `Số ngày đã qua (${daysElapsed}) vượt số ngày trong kỳ (${totalDays}).`,
    )
  }

  if (daysElapsed < MIN_DAYS_FOR_FORECAST) {
    return {
      value: null,
      confidence: null,
      daysUsed: daysElapsed,
      reason: `Cần tối thiểu ${MIN_DAYS_FOR_FORECAST} ngày dữ liệu để dự báo, hiện chỉ có ${daysElapsed}.`,
    }
  }

  const actual = new Decimal(input.actualToDate)
  let value: Decimal

  if (input.dayWeights) {
    if (input.dayWeights.length !== totalDays) {
      throw new ForecastError(
        `dayWeights có ${input.dayWeights.length} phần tử, phải bằng totalDays (${totalDays}).`,
      )
    }
    const elapsedWeight = input.dayWeights
      .slice(0, daysElapsed)
      .reduce<Decimal>((acc, w) => acc.plus(w), new Decimal(0))
    const totalWeight = input.dayWeights.reduce<Decimal>(
      (acc, w) => acc.plus(w),
      new Decimal(0),
    )

    if (elapsedWeight.lte(0)) {
      return {
        value: null,
        confidence: null,
        daysUsed: daysElapsed,
        reason: 'Tổng trọng số của các ngày đã qua bằng 0, không ngoại suy được.',
      }
    }
    value = actual.dividedBy(elapsedWeight).times(totalWeight)
  } else {
    value = actual.dividedBy(daysElapsed).times(totalDays)
  }

  // Càng nhiều ngày dữ liệu, dự báo càng đáng tin. Tuyến tính, dễ giải thích cho người dùng.
  const confidence = new Decimal(daysElapsed)
    .dividedBy(totalDays)
    .toDecimalPlaces(4, Decimal.ROUND_HALF_UP)

  return {
    value: value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    confidence,
    daysUsed: daysElapsed,
  }
}

/**
 * Tỷ lệ đạt dự kiến cuối kỳ so với mục tiêu.
 * Trả null khi không dự báo được hoặc mục tiêu bằng 0.
 */
export function forecastAttainment(
  forecast: ForecastResult,
  target: Decimal.Value,
): Decimal | null {
  const targetDec = new Decimal(target)
  if (forecast.value === null || targetDec.isZero()) return null
  return forecast.value.dividedBy(targetDec).toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
}
