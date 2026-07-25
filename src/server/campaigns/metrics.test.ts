import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { EMPTY_TOTALS, computeCampaignMetrics, sumTotals, type CampaignTotals } from './metrics'

function totals(partial: Partial<CampaignTotals>): CampaignTotals {
  return {
    ...EMPTY_TOTALS,
    spend: new Decimal(0),
    revenue: new Decimal(0),
    ...partial,
  }
}

describe('computeCampaignMetrics', () => {
  it('tính đúng ROI và ROAS', () => {
    const m = computeCampaignMetrics(
      totals({ spend: new Decimal('120000000'), revenue: new Decimal('1800000000') }),
      null,
    )
    // ROI = (1,8 tỷ − 120 triệu) / 120 triệu = 14
    expect(m.roi?.toString()).toBe('14')
    expect(m.roas?.toString()).toBe('15')
  })

  it('ROI âm khi lỗ', () => {
    const m = computeCampaignMetrics(
      totals({ spend: new Decimal('100'), revenue: new Decimal('40') }),
      null,
    )
    expect(m.roi?.toString()).toBe('-0.6')
  })

  it('chi phí bằng 0 trả null cho ROI và ROAS, không chia cho 0', () => {
    const m = computeCampaignMetrics(totals({ revenue: new Decimal('500') }), null)
    expect(m.roi).toBeNull()
    expect(m.roas).toBeNull()
  })

  it('không lead thì CPA là null, không phải 0', () => {
    const m = computeCampaignMetrics(totals({ spend: new Decimal('1000') }), null)
    expect(m.cpa).toBeNull()
  })

  it('tính CPA, CPC, CTR, AOV từ tử và mẫu đã cộng dồn', () => {
    const m = computeCampaignMetrics(
      totals({
        spend: new Decimal('1000000'),
        revenue: new Decimal('5000000'),
        leads: 40,
        orders: 10,
        impressions: 100000,
        clicks: 2000,
      }),
      null,
    )
    expect(m.cpa?.toString()).toBe('25000')
    expect(m.cpc?.toString()).toBe('500')
    expect(m.ctr?.toString()).toBe('0.02')
    expect(m.aov?.toString()).toBe('500000')
  })

  it('không có lượt hiển thị thì CTR là null', () => {
    const m = computeCampaignMetrics(totals({ clicks: 100 }), null)
    expect(m.ctr).toBeNull()
  })
})

describe('ngân sách', () => {
  it('tính tỷ lệ dùng ngân sách', () => {
    const m = computeCampaignMetrics(
      totals({ spend: new Decimal('80') }),
      new Decimal('100'),
    )
    expect(m.budgetUsage?.toString()).toBe('0.8')
    expect(m.overBudget).toBe(false)
  })

  it('đánh dấu vượt ngân sách', () => {
    const m = computeCampaignMetrics(
      totals({ spend: new Decimal('130') }),
      new Decimal('100'),
    )
    expect(m.budgetUsage?.toString()).toBe('1.3')
    expect(m.overBudget).toBe(true)
  })

  it('chưa đặt ngân sách thì không kết luận vượt', () => {
    const m = computeCampaignMetrics(totals({ spend: new Decimal('999999') }), null)
    expect(m.budgetUsage).toBeNull()
    expect(m.overBudget).toBe(false)
  })

  it('ngân sách bằng 0 cũng không kết luận vượt', () => {
    const m = computeCampaignMetrics(totals({ spend: new Decimal('100') }), new Decimal(0))
    expect(m.budgetUsage).toBeNull()
    expect(m.overBudget).toBe(false)
  })
})

describe('sumTotals', () => {
  it('cộng dồn số nguyên liệu từ nhiều nguồn', () => {
    const result = sumTotals([
      totals({ spend: new Decimal('100'), leads: 10, clicks: 50 }),
      totals({ spend: new Decimal('200'), leads: 5, clicks: 30 }),
    ])
    expect(result.spend.toString()).toBe('300')
    expect(result.leads).toBe(15)
    expect(result.clicks).toBe(80)
  })

  it('CPA gộp từ hai nguồn KHÁC trung bình cộng của hai CPA', () => {
    // Nguồn A: 100/10 = 10 ; Nguồn B: 900/10 = 90 → trung bình sai = 50
    // Đúng: (100 + 900) / (10 + 10) = 50 ... chọn số lộ khác biệt rõ hơn:
    const a = totals({ spend: new Decimal('100'), leads: 1 }) // CPA 100
    const b = totals({ spend: new Decimal('100'), leads: 99 }) // CPA ~1.01
    const merged = computeCampaignMetrics(sumTotals([a, b]), null)
    // Đúng: 200 / 100 = 2. Trung bình cộng của hai CPA ≈ 50,5 — sai hoàn toàn.
    expect(merged.cpa?.toString()).toBe('2')
  })

  it('cộng danh sách rỗng trả về tất cả bằng 0', () => {
    const result = sumTotals([])
    expect(result.spend.toString()).toBe('0')
    expect(result.leads).toBe(0)
  })
})
