import Decimal from 'decimal.js'

/**
 * Chỉ số hiệu quả kênh quảng cáo. Hàm thuần, không chạm DB.
 *
 * Mọi chỉ số tỷ lệ (CPC, CTR, CR, ROAS, CPA, AOV) đều **tính từ tử số và mẫu số
 * đã cộng dồn** — không lấy trung bình các tỷ lệ. Chia cho 0 trả `null` (chưa
 * xác định), tuyệt đối không trả 0: "chưa có dữ liệu" khác "bằng 0".
 */

export type AdsPlatform = 'FACEBOOK' | 'GOOGLE' | 'TIKTOK' | 'ZALO' | 'COCCOC'

/** Nhãn hiển thị cho từng kênh. Tra theo enum, không hardcode rải rác. */
export const PLATFORM_LABEL: Record<AdsPlatform, string> = {
  FACEBOOK: 'Facebook Ads',
  GOOGLE: 'Google Ads',
  TIKTOK: 'TikTok Ads',
  ZALO: 'Zalo Ads',
  COCCOC: 'Cốc Cốc Ads',
}

/** Thứ tự hiển thị cố định của các kênh. */
export const PLATFORM_ORDER: readonly AdsPlatform[] = [
  'FACEBOOK',
  'GOOGLE',
  'TIKTOK',
  'ZALO',
  'COCCOC',
]

/** Số nguyên liệu của một kênh (hoặc tổng nhiều kênh). Không chứa tỷ lệ. */
export interface ChannelTotals {
  spend: Decimal
  revenue: Decimal
  impressions: number
  clicks: number
  leads: number
  /** Số đơn hàng — cột `conversions` trong ads_insights */
  orders: number
}

export interface ChannelMetrics {
  spend: Decimal
  revenue: Decimal
  impressions: number
  clicks: number
  leads: number
  orders: number
  /** chi phí / click */
  cpc: Decimal | null
  /** click / hiển thị */
  ctr: Decimal | null
  /** chi phí / lead */
  cpa: Decimal | null
  /** doanh thu / chi phí — càng cao càng tốt */
  roas: Decimal | null
  /** chi phí / doanh thu — tỷ lệ chi phí trên doanh thu, càng thấp càng tốt */
  ros: Decimal | null
  /** doanh thu / đơn */
  aov: Decimal | null
  /** Tỷ lệ chuyển đổi lead: lead / click */
  crLead: Decimal | null
  /** Tỷ lệ chuyển đổi đơn: đơn / lead */
  crOrder: Decimal | null
}

function ratio(numerator: Decimal.Value, denominator: Decimal.Value): Decimal | null {
  const den = new Decimal(denominator)
  if (den.isZero()) return null
  return new Decimal(numerator).dividedBy(den)
}

export function computeChannelMetrics(totals: ChannelTotals): ChannelMetrics {
  const { spend, revenue, impressions, clicks, leads, orders } = totals

  return {
    spend,
    revenue,
    impressions,
    clicks,
    leads,
    orders,
    cpc: ratio(spend, clicks),
    ctr: ratio(clicks, impressions),
    cpa: ratio(spend, leads),
    roas: ratio(revenue, spend),
    ros: ratio(spend, revenue),
    aov: ratio(revenue, orders),
    crLead: ratio(leads, clicks),
    crOrder: ratio(orders, leads),
  }
}

export const EMPTY_TOTALS: ChannelTotals = {
  spend: new Decimal(0),
  revenue: new Decimal(0),
  impressions: 0,
  clicks: 0,
  leads: 0,
  orders: 0,
}

/** Cộng dồn số nguyên liệu từ nhiều kênh trước khi tính tỷ lệ. */
export function sumTotals(parts: ChannelTotals[]): ChannelTotals {
  return parts.reduce<ChannelTotals>(
    (acc, p) => ({
      spend: acc.spend.plus(p.spend),
      revenue: acc.revenue.plus(p.revenue),
      impressions: acc.impressions + p.impressions,
      clicks: acc.clicks + p.clicks,
      leads: acc.leads + p.leads,
      orders: acc.orders + p.orders,
    }),
    { ...EMPTY_TOTALS, spend: new Decimal(0), revenue: new Decimal(0) },
  )
}
