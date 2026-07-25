import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import {
  EMPTY_TOTALS,
  computeChannelMetrics,
  sumTotals,
  type ChannelTotals,
} from './channel-metrics'

function totals(partial: Partial<ChannelTotals>): ChannelTotals {
  return { ...EMPTY_TOTALS, spend: new Decimal(0), revenue: new Decimal(0), ...partial }
}

describe('computeChannelMetrics', () => {
  it('tính đủ các chỉ số tỷ lệ từ tử/mẫu', () => {
    const m = computeChannelMetrics(
      totals({
        spend: new Decimal('10000000'),
        revenue: new Decimal('50000000'),
        impressions: 200000,
        clicks: 4000,
        leads: 800,
        orders: 200,
      }),
    )
    expect(m.cpc?.toString()).toBe('2500') // 10tr / 4000
    expect(m.ctr?.toString()).toBe('0.02') // 4000 / 200000
    expect(m.cpa?.toString()).toBe('12500') // 10tr / 800
    expect(m.roas?.toString()).toBe('5') // 50tr / 10tr
    expect(m.ros?.toString()).toBe('0.2') // 10tr / 50tr = nghịch đảo ROAS
    expect(m.aov?.toString()).toBe('250000') // 50tr / 200
    expect(m.crLead?.toString()).toBe('0.2') // 800 / 4000
    expect(m.crOrder?.toString()).toBe('0.25') // 200 / 800
  })

  it('không click thì CPC và CR lead là null, không chia cho 0', () => {
    const m = computeChannelMetrics(totals({ spend: new Decimal('1000'), leads: 5 }))
    expect(m.cpc).toBeNull()
    expect(m.crLead).toBeNull()
  })

  it('không lead thì CPA và CR đơn là null', () => {
    const m = computeChannelMetrics(totals({ spend: new Decimal('1000'), clicks: 100 }))
    expect(m.cpa).toBeNull()
    expect(m.crOrder).toBeNull()
  })

  it('không hiển thị thì CTR là null', () => {
    const m = computeChannelMetrics(totals({ clicks: 100 }))
    expect(m.ctr).toBeNull()
  })

  it('chi phí bằng 0 thì ROAS là null, không phải vô cực', () => {
    const m = computeChannelMetrics(totals({ revenue: new Decimal('500') }))
    expect(m.roas).toBeNull()
  })

  it('doanh thu bằng 0 thì ROS là null, không chia cho 0', () => {
    const m = computeChannelMetrics(totals({ spend: new Decimal('500') }))
    expect(m.ros).toBeNull()
  })

  it('kênh không có dữ liệu trả toàn null cho tỷ lệ, 0 cho số đếm', () => {
    const m = computeChannelMetrics(EMPTY_TOTALS)
    expect(m.spend.toString()).toBe('0')
    expect(m.clicks).toBe(0)
    expect(m.cpc).toBeNull()
    expect(m.roas).toBeNull()
  })
})

describe('sumTotals', () => {
  it('cộng dồn số nguyên liệu nhiều kênh', () => {
    const result = sumTotals([
      totals({ spend: new Decimal('100'), clicks: 50, leads: 10 }),
      totals({ spend: new Decimal('200'), clicks: 30, leads: 5 }),
    ])
    expect(result.spend.toString()).toBe('300')
    expect(result.clicks).toBe(80)
    expect(result.leads).toBe(15)
  })

  it('CPC tổng KHÁC trung bình cộng CPC từng kênh', () => {
    // Kênh A: 100/1 = 100 ; Kênh B: 100/99 ≈ 1,01. Trung bình sai ≈ 50,5.
    // Đúng: 200 / 100 = 2.
    const a = totals({ spend: new Decimal('100'), clicks: 1 })
    const b = totals({ spend: new Decimal('100'), clicks: 99 })
    const merged = computeChannelMetrics(sumTotals([a, b]))
    expect(merged.cpc?.toString()).toBe('2')
  })

  it('cộng danh sách rỗng trả về tất cả bằng 0', () => {
    const result = sumTotals([])
    expect(result.spend.toString()).toBe('0')
    expect(result.impressions).toBe(0)
  })
})
