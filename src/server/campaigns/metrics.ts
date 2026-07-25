import Decimal from 'decimal.js'

/**
 * Chỉ số hiệu quả của campaign. Hàm thuần, không chạm DB.
 *
 * Mọi chỉ số ở đây là **metric tỷ lệ**: chia cho 0 phải trả `null` (chưa xác
 * định), tuyệt đối không trả 0. UI hiển thị `—`, vì "chưa có dữ liệu" và
 * "bằng 0" là hai chuyện khác nhau với người đọc báo cáo.
 */

export interface CampaignTotals {
  /** Chi phí quảng cáo + chi phí nhập tay trong báo cáo */
  spend: Decimal
  revenue: Decimal
  leads: number
  orders: number
  impressions: number
  clicks: number
}

export interface CampaignMetrics {
  spend: Decimal
  revenue: Decimal
  leads: number
  orders: number
  /** (doanh thu − chi phí) / chi phí */
  roi: Decimal | null
  /** doanh thu / chi phí */
  roas: Decimal | null
  /** chi phí / lead */
  cpa: Decimal | null
  /** chi phí / click */
  cpc: Decimal | null
  /** click / lượt hiển thị */
  ctr: Decimal | null
  /** doanh thu / đơn hàng */
  aov: Decimal | null
  /** Tỷ lệ ngân sách đã dùng; null khi chưa đặt ngân sách */
  budgetUsage: Decimal | null
  overBudget: boolean
}

function ratio(numerator: Decimal.Value, denominator: Decimal.Value): Decimal | null {
  const den = new Decimal(denominator)
  if (den.isZero()) return null
  return new Decimal(numerator).dividedBy(den)
}

export function computeCampaignMetrics(
  totals: CampaignTotals,
  budget: Decimal | null,
): CampaignMetrics {
  const { spend, revenue, leads, orders, impressions, clicks } = totals

  const budgetUsage = budget && !budget.isZero() ? spend.dividedBy(budget) : null

  return {
    spend,
    revenue,
    leads,
    orders,
    roi: spend.isZero() ? null : revenue.minus(spend).dividedBy(spend),
    roas: ratio(revenue, spend),
    cpa: ratio(spend, leads),
    cpc: ratio(spend, clicks),
    ctr: ratio(clicks, impressions),
    aov: ratio(revenue, orders),
    budgetUsage,
    // Chưa đặt ngân sách thì không kết luận vượt — không có gì để so.
    overBudget: budgetUsage !== null && budgetUsage.gt(1),
  }
}

/** Cộng dồn số nguyên liệu từ nhiều nguồn (ads, báo cáo) trước khi tính tỷ lệ. */
export function sumTotals(parts: CampaignTotals[]): CampaignTotals {
  return parts.reduce<CampaignTotals>(
    (acc, p) => ({
      spend: acc.spend.plus(p.spend),
      revenue: acc.revenue.plus(p.revenue),
      leads: acc.leads + p.leads,
      orders: acc.orders + p.orders,
      impressions: acc.impressions + p.impressions,
      clicks: acc.clicks + p.clicks,
    }),
    {
      spend: new Decimal(0),
      revenue: new Decimal(0),
      leads: 0,
      orders: 0,
      impressions: 0,
      clicks: 0,
    },
  )
}

export const EMPTY_TOTALS: CampaignTotals = {
  spend: new Decimal(0),
  revenue: new Decimal(0),
  leads: 0,
  orders: 0,
  impressions: 0,
  clicks: 0,
}
