import { describe, expect, it } from 'vitest'
import { ForecastError, forecastAttainment, forecastPeriod } from './forecast'

describe('forecastPeriod', () => {
  it('ngoại suy tuyến tính theo tốc độ hiện tại', () => {
    // Ngày 20/31, đạt 4.850 → dự báo cuối tháng
    const result = forecastPeriod({ actualToDate: 4850, daysElapsed: 20, totalDays: 31 })
    expect(result.value?.toString()).toBe('7517.5')
    expect(result.daysUsed).toBe(20)
  })

  it('trả confidence theo tỷ lệ ngày đã qua', () => {
    const result = forecastPeriod({ actualToDate: 100, daysElapsed: 15, totalDays: 30 })
    expect(result.confidence?.toString()).toBe('0.5')
  })

  it('không dự báo khi dưới 3 ngày dữ liệu, nêu rõ lý do', () => {
    const result = forecastPeriod({ actualToDate: 100, daysElapsed: 2, totalDays: 30 })
    expect(result.value).toBeNull()
    expect(result.confidence).toBeNull()
    expect(result.reason).toMatch(/tối thiểu 3 ngày/)
  })

  it('dự báo được ngay tại ngày thứ 3', () => {
    const result = forecastPeriod({ actualToDate: 30, daysElapsed: 3, totalDays: 30 })
    expect(result.value?.toString()).toBe('300')
  })

  it('kỳ đã kết thúc thì dự báo bằng đúng số thực tế', () => {
    const result = forecastPeriod({ actualToDate: 5900, daysElapsed: 31, totalDays: 31 })
    expect(result.value?.toString()).toBe('5900')
    expect(result.confidence?.toString()).toBe('1')
  })

  it('hiệu chỉnh theo trọng số ngày khi phân bổ là WEIGHTED', () => {
    // 10 ngày, 5 ngày đầu trọng số 1, 5 ngày sau trọng số 3
    const dayWeights = [1, 1, 1, 1, 1, 3, 3, 3, 3, 3]
    const result = forecastPeriod({
      actualToDate: 50,
      daysElapsed: 5,
      totalDays: 10,
      dayWeights,
    })
    // elapsedWeight = 5, totalWeight = 20 → 50/5*20 = 200
    expect(result.value?.toString()).toBe('200')
  })

  it('ngoại suy theo trọng số cho kết quả khác ngoại suy tuyến tính', () => {
    const dayWeights = [1, 1, 1, 1, 1, 3, 3, 3, 3, 3]
    const weighted = forecastPeriod({
      actualToDate: 50,
      daysElapsed: 5,
      totalDays: 10,
      dayWeights,
    })
    const linear = forecastPeriod({ actualToDate: 50, daysElapsed: 5, totalDays: 10 })
    expect(weighted.value?.toString()).not.toBe(linear.value?.toString())
    expect(linear.value?.toString()).toBe('100')
  })

  it('trả null khi tổng trọng số các ngày đã qua bằng 0', () => {
    const result = forecastPeriod({
      actualToDate: 50,
      daysElapsed: 5,
      totalDays: 10,
      dayWeights: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1],
    })
    expect(result.value).toBeNull()
    expect(result.reason).toMatch(/trọng số/)
  })

  it('từ chối dayWeights sai độ dài', () => {
    expect(() =>
      forecastPeriod({
        actualToDate: 50,
        daysElapsed: 5,
        totalDays: 10,
        dayWeights: [1, 1, 1],
      }),
    ).toThrow(/phải bằng totalDays/)
  })

  it('từ chối daysElapsed vượt totalDays', () => {
    expect(() =>
      forecastPeriod({ actualToDate: 50, daysElapsed: 40, totalDays: 30 }),
    ).toThrow(ForecastError)
  })

  it('từ chối totalDays không hợp lệ', () => {
    expect(() =>
      forecastPeriod({ actualToDate: 50, daysElapsed: 5, totalDays: 0 }),
    ).toThrow(ForecastError)
  })
})

describe('forecastAttainment', () => {
  it('tính tỷ lệ đạt dự kiến so với mục tiêu', () => {
    const forecast = forecastPeriod({ actualToDate: 4850, daysElapsed: 20, totalDays: 30 })
    // 4850/20*30 = 7275 ; 7275 / 8000 = 0.9094
    expect(forecastAttainment(forecast, 8000)?.toString()).toBe('0.9094')
  })

  it('trả null khi không dự báo được', () => {
    const forecast = forecastPeriod({ actualToDate: 100, daysElapsed: 1, totalDays: 30 })
    expect(forecastAttainment(forecast, 8000)).toBeNull()
  })

  it('trả null khi mục tiêu bằng 0, không chia cho 0', () => {
    const forecast = forecastPeriod({ actualToDate: 100, daysElapsed: 10, totalDays: 30 })
    expect(forecastAttainment(forecast, 0)).toBeNull()
  })
})
