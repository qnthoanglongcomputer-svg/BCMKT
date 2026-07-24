import { describe, expect, it } from 'vitest'
import {
  EM_DASH,
  changeTone,
  formatByUnit,
  formatCompact,
  formatCurrency,
  formatDate,
  formatDelta,
  formatPercent,
  formatPeriod,
  kpiStatus,
} from './format'

describe('giá trị chưa xác định', () => {
  it('hiển thị dấu gạch ngang, không hiển thị 0', () => {
    expect(formatNumberish()).toBe(EM_DASH)
  })

  function formatNumberish() {
    return formatCurrency(null)
  }

  it('áp dụng cho mọi hàm định dạng', () => {
    expect(formatCompact(null)).toBe(EM_DASH)
    expect(formatPercent(undefined)).toBe(EM_DASH)
    expect(formatDate(null)).toBe(EM_DASH)
    expect(formatByUnit(null, 'VND')).toBe(EM_DASH)
  })

  it('phân biệt null với 0 — 0 vẫn hiện là 0', () => {
    expect(formatCurrency(0)).toBe('0 ₫')
    expect(formatCompact(0)).toBe('0')
  })
})

describe('formatCompact', () => {
  it('rút gọn theo thang tiếng Việt', () => {
    expect(formatCompact(72_000)).toBe('72K')
    expect(formatCompact(1_200_000)).toBe('1,2 triệu')
    expect(formatCompact(1_800_000_000)).toBe('1,8 tỷ')
  })

  it('giữ nguyên số dưới 1000', () => {
    expect(formatCompact(850)).toBe('850')
  })

  it('giữ dấu âm', () => {
    expect(formatCompact(-72_000)).toBe('-72K')
  })
})

describe('formatByUnit', () => {
  it('định dạng theo đơn vị của metric', () => {
    expect(formatByUnit(1_250_000, 'VND')).toBe('1.250.000 ₫')
    expect(formatByUnit(72_000, 'lead')).toBe('72.000')
    expect(formatByUnit(2.15, 'lần')).toBe('2,15')
  })

  it('chỉ rút gọn khi được yêu cầu', () => {
    expect(formatByUnit(1_250_000, 'VND', { compact: true })).toBe('1,3 triệu ₫')
    expect(formatByUnit(1_250_000, 'VND')).toBe('1.250.000 ₫')
  })
})

describe('formatPeriod', () => {
  const d = (s: string) => new Date(`${s}T00:00:00Z`)

  it('định dạng đúng từng loại kỳ', () => {
    expect(formatPeriod('YEAR', d('2026-01-01'))).toBe('Năm 2026')
    expect(formatPeriod('QUARTER', d('2026-07-01'))).toBe('Quý 3/2026')
    expect(formatPeriod('MONTH', d('2026-07-01'))).toBe('Tháng 7/2026')
    expect(formatPeriod('DAY', d('2026-07-24'))).toBe('24/07/2026')
  })
})

describe('kpiStatus', () => {
  it('phân loại đúng tại các ngưỡng biên', () => {
    expect(kpiStatus(1)).toBe('ACHIEVED')
    expect(kpiStatus(1.2)).toBe('ACHIEVED')
    expect(kpiStatus(0.999)).toBe('AT_RISK')
    expect(kpiStatus(0.8)).toBe('AT_RISK')
    expect(kpiStatus(0.799)).toBe('MISSED')
    expect(kpiStatus(0)).toBe('MISSED')
  })

  it('chưa có dữ liệu khác với không đạt', () => {
    expect(kpiStatus(null)).toBe('NO_DATA')
    expect(kpiStatus(0)).toBe('MISSED')
  })
})

describe('changeTone — chiều tốt/xấu của metric nghịch', () => {
  it('metric thuận: tăng là tốt', () => {
    expect(changeTone(0.12, 'HIGHER_BETTER')).toBe('good')
    expect(changeTone(-0.12, 'HIGHER_BETTER')).toBe('bad')
  })

  it('metric nghịch: CPA giảm là tin tốt', () => {
    expect(changeTone(-0.12, 'LOWER_BETTER')).toBe('good')
    expect(changeTone(0.18, 'LOWER_BETTER')).toBe('bad')
  })

  it('không đổi thì trung tính', () => {
    expect(changeTone(0, 'HIGHER_BETTER')).toBe('neutral')
    expect(changeTone(null, 'LOWER_BETTER')).toBe('neutral')
  })
})

describe('formatDelta', () => {
  it('luôn có dấu để đọc nhanh chiều thay đổi', () => {
    expect(formatDelta(0.12)).toBe('+12,0%')
    expect(formatDelta(-0.085)).toBe('-8,5%')
  })
})
