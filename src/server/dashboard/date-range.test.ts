import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { eachDay, previousRange, prorateTarget, resolveDateRange } from './date-range'

const TODAY = new Date(Date.UTC(2026, 6, 25)) // 25/07/2026
const iso = (d: Date) => d.toISOString().slice(0, 10)

describe('resolveDateRange — preset', () => {
  it('this-month: từ đầu tháng tới hôm nay', () => {
    const r = resolveDateRange({ preset: 'this-month' }, TODAY)
    expect(iso(r.from)).toBe('2026-07-01')
    expect(iso(r.to)).toBe('2026-07-25')
    expect(r.days).toBe(25)
    expect(r.label).toBe('Tháng 7/2026')
  })

  it('last-month: trọn tháng trước', () => {
    const r = resolveDateRange({ preset: 'last-month' }, TODAY)
    expect(iso(r.from)).toBe('2026-06-01')
    expect(iso(r.to)).toBe('2026-06-30')
    expect(r.days).toBe(30)
  })

  it('last-7-days: 7 ngày tính cả hôm nay', () => {
    const r = resolveDateRange({ preset: 'last-7-days' }, TODAY)
    expect(iso(r.from)).toBe('2026-07-19')
    expect(iso(r.to)).toBe('2026-07-25')
    expect(r.days).toBe(7)
  })

  it('last-30-days: 30 ngày tính cả hôm nay', () => {
    const r = resolveDateRange({ preset: 'last-30-days' }, TODAY)
    expect(r.days).toBe(30)
    expect(iso(r.to)).toBe('2026-07-25')
  })

  it('mặc định là tháng này khi không có preset', () => {
    expect(resolveDateRange({}, TODAY).preset).toBe('this-month')
  })
})

describe('resolveDateRange — custom', () => {
  it('nhận khoảng tùy chọn hợp lệ', () => {
    const r = resolveDateRange({ preset: 'custom', from: '2026-07-10', to: '2026-07-20' }, TODAY)
    expect(iso(r.from)).toBe('2026-07-10')
    expect(iso(r.to)).toBe('2026-07-20')
    expect(r.days).toBe(11)
  })

  it('chặn ngày kết thúc vượt quá hôm nay', () => {
    const r = resolveDateRange({ preset: 'custom', from: '2026-07-20', to: '2026-08-30' }, TODAY)
    expect(iso(r.to)).toBe('2026-07-25')
  })

  it('lùi về tháng này khi from > to', () => {
    const r = resolveDateRange({ preset: 'custom', from: '2026-07-20', to: '2026-07-10' }, TODAY)
    expect(r.preset).toBe('this-month')
  })

  it('lùi về tháng này khi thiếu tham số', () => {
    expect(resolveDateRange({ preset: 'custom', from: '2026-07-10' }, TODAY).preset).toBe('this-month')
  })

  it('lùi về tháng này khi định dạng sai', () => {
    expect(
      resolveDateRange({ preset: 'custom', from: '10/07/2026', to: '20/07/2026' }, TODAY).preset,
    ).toBe('this-month')
  })
})

describe('previousRange — kỳ liền trước cùng độ dài', () => {
  it('30 ngày → 30 ngày liền trước đó', () => {
    const r = resolveDateRange({ preset: 'last-30-days' }, TODAY)
    const prev = previousRange(r)
    expect(prev.days).toBe(30)
    // Kỳ hiện tại: 26/06–25/07. Kỳ trước kết thúc 25/06, dài 30 ngày.
    expect(iso(prev.to)).toBe('2026-06-25')
    expect(iso(prev.from)).toBe('2026-05-27')
  })

  it('tháng này (25 ngày) → 25 ngày liền trước 1/7', () => {
    const r = resolveDateRange({ preset: 'this-month' }, TODAY)
    const prev = previousRange(r)
    expect(prev.days).toBe(25)
    expect(iso(prev.to)).toBe('2026-06-30')
    expect(iso(prev.from)).toBe('2026-06-06')
  })

  it('kỳ trước liền kề, không chồng lấn kỳ hiện tại', () => {
    const r = resolveDateRange({ preset: 'custom', from: '2026-07-10', to: '2026-07-20' }, TODAY)
    const prev = previousRange(r)
    expect(iso(prev.to)).toBe('2026-07-09') // ngay trước from
    expect(prev.days).toBe(11)
  })
})

describe('eachDay', () => {
  it('liệt kê đủ ngày đóng cả hai đầu', () => {
    const days = eachDay(new Date(Date.UTC(2026, 6, 1)), new Date(Date.UTC(2026, 6, 3)))
    expect(days.map(iso)).toEqual(['2026-07-01', '2026-07-02', '2026-07-03'])
  })
})

describe('prorateTarget — phân bổ mục tiêu tháng theo ngày', () => {
  it('mục tiêu trọn tháng bằng đúng target khi xem cả tháng', () => {
    const targets = new Map<string, string>([['2026-7', '31000']]) // 31 ngày
    const result = prorateTarget(
      new Date(Date.UTC(2026, 6, 1)),
      new Date(Date.UTC(2026, 6, 31)),
      targets,
    )
    expect(result?.toFixed(2)).toBe('31000.00')
  })

  it('xem một phần tháng thì mục tiêu tỷ lệ theo số ngày', () => {
    const targets = new Map<string, string>([['2026-7', '31000']])
    // Xem 10 ngày đầu → 10 × (31000/31) = 10000
    const result = prorateTarget(
      new Date(Date.UTC(2026, 6, 1)),
      new Date(Date.UTC(2026, 6, 10)),
      targets,
    )
    expect(result?.toFixed(2)).toBe('10000.00')
  })

  it('khoảng vắt qua hai tháng cộng đúng theo ngày mỗi tháng', () => {
    // T6 có 30 ngày mục tiêu 30000 (1000/ngày), T7 có 31 ngày mục tiêu 62000 (2000/ngày)
    const targets = new Map<string, string>([
      ['2026-6', '30000'],
      ['2026-7', '62000'],
    ])
    // 28/06–02/07 = 3 ngày T6 (3000) + 2 ngày T7 (4000) = 7000
    const result = prorateTarget(
      new Date(Date.UTC(2026, 5, 28)),
      new Date(Date.UTC(2026, 6, 2)),
      targets,
    )
    expect(result?.toFixed(2)).toBe('7000.00')
  })

  it('trả null khi không tháng nào có mục tiêu', () => {
    const result = prorateTarget(
      new Date(Date.UTC(2026, 6, 1)),
      new Date(Date.UTC(2026, 6, 10)),
      new Map(),
    )
    expect(result).toBeNull()
  })

  it('chỉ tính tháng có mục tiêu, bỏ qua tháng chưa đặt', () => {
    const targets = new Map<string, string>([['2026-7', '31000']]) // chỉ T7
    // 28/06–02/07: T6 chưa đặt (bỏ), T7 2 ngày = 2000
    const result = prorateTarget(
      new Date(Date.UTC(2026, 5, 28)),
      new Date(Date.UTC(2026, 6, 2)),
      targets,
    )
    expect(result?.toFixed(2)).toBe('2000.00')
    expect(new Decimal(result?.toString() ?? '0').toNumber()).toBe(2000)
  })
})
