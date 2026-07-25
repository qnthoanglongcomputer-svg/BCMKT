import { describe, expect, it } from 'vitest'
import { buildDedupeKey, dayKey, isQuietHour, monthKey, summarizeCount } from './dedupe'

describe('buildDedupeKey', () => {
  it('cùng việc trong cùng kỳ cho ra cùng một khoá', () => {
    const a = buildDedupeKey('KPI_BELOW_THRESHOLD', 'user-1', '2026-07')
    const b = buildDedupeKey('KPI_BELOW_THRESHOLD', 'user-1', '2026-07')
    expect(a).toBe(b)
  })

  it('khác đối tượng thì khác khoá', () => {
    expect(buildDedupeKey('KPI_BELOW_THRESHOLD', 'user-1', '2026-07')).not.toBe(
      buildDedupeKey('KPI_BELOW_THRESHOLD', 'user-2', '2026-07'),
    )
  })

  it('sang kỳ mới thì được gửi lại', () => {
    expect(buildDedupeKey('KPI_BELOW_THRESHOLD', 'user-1', '2026-07')).not.toBe(
      buildDedupeKey('KPI_BELOW_THRESHOLD', 'user-1', '2026-08'),
    )
  })

  it('khác loại thông báo thì khác khoá', () => {
    expect(buildDedupeKey('KPI_BELOW_THRESHOLD', 'x', '2026-07')).not.toBe(
      buildDedupeKey('KPI_FORECAST_MISS', 'x', '2026-07'),
    )
  })
})

describe('monthKey và dayKey', () => {
  it('sinh khoá kỳ đúng định dạng', () => {
    const date = new Date(Date.UTC(2026, 6, 24))
    expect(monthKey(date)).toBe('2026-07')
    expect(dayKey(date)).toBe('2026-07-24')
  })

  it('tháng một chữ số được đệm 0', () => {
    expect(monthKey(new Date(Date.UTC(2026, 0, 5)))).toBe('2026-01')
  })
})

describe('summarizeCount — gộp theo lô', () => {
  it('một việc thì không dùng số nhiều', () => {
    expect(summarizeCount(1, 'báo cáo chờ duyệt')).toBe('1 báo cáo chờ duyệt')
  })

  it('nhiều việc gộp thành một câu', () => {
    expect(summarizeCount(12, 'báo cáo chờ duyệt')).toBe('12 báo cáo chờ duyệt')
  })
})

describe('isQuietHour', () => {
  const at = (hourVn: number) =>
    // 07:00 giờ VN = 00:00 UTC
    new Date(Date.UTC(2026, 6, 24, (hourVn - 7 + 24) % 24, 0, 0))

  it('trong giờ làm việc thì không phải giờ yên tĩnh', () => {
    expect(isQuietHour(at(9))).toBe(false)
    expect(isQuietHour(at(14))).toBe(false)
    expect(isQuietHour(at(19))).toBe(false)
  })

  it('buổi tối và đêm là giờ yên tĩnh', () => {
    expect(isQuietHour(at(20))).toBe(true)
    expect(isQuietHour(at(23))).toBe(true)
    expect(isQuietHour(at(3))).toBe(true)
  })

  it('7 giờ sáng đã hết giờ yên tĩnh', () => {
    expect(isQuietHour(at(7))).toBe(false)
    expect(isQuietHour(at(6))).toBe(true)
  })
})
