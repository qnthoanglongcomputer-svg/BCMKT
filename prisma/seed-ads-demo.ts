/**
 * Dữ liệu MẪU cho dashboard hiệu quả kênh quảng cáo (5 kênh).
 *
 * Chạy: npm run db:seed-ads
 * Xoá:  npm run db:seed-ads -- --clean
 *
 * Idempotent: upsert theo khoá tự nhiên, chạy lại không nhân đôi.
 * Không phải dữ liệu thật — chỉ để xem giao diện trước khi nhập số thật.
 */
import { PrismaClient, type AdsPlatform } from '@prisma/client'
import Decimal from 'decimal.js'

const prisma = new PrismaClient()

/** Cố định "hôm nay" để chạy lại luôn ra kết quả giống nhau. */
const TODAY = new Date(Date.UTC(2026, 6, 25))
const MANUAL_ACCOUNT = 'MANUAL'
const SENTINEL = '-'

/**
 * Đặc trưng mỗi kênh: mức chi phí/ngày và các tỷ lệ hiệu quả khác nhau, để
 * bảng so sánh có sự khác biệt rõ giữa các kênh.
 */
const CHANNELS: Array<{
  platform: AdsPlatform
  dailySpend: number
  cpc: number // chi phí mỗi click
  ctr: number // click / hiển thị
  crLead: number // lead / click
  crOrder: number // đơn / lead
  aov: number // doanh thu mỗi đơn
}> = [
  { platform: 'FACEBOOK', dailySpend: 4_000_000, cpc: 2500, ctr: 0.021, crLead: 0.18, crOrder: 0.24, aov: 850_000 },
  { platform: 'GOOGLE', dailySpend: 3_200_000, cpc: 3200, ctr: 0.035, crLead: 0.22, crOrder: 0.28, aov: 920_000 },
  { platform: 'TIKTOK', dailySpend: 2_400_000, cpc: 1800, ctr: 0.028, crLead: 0.14, crOrder: 0.19, aov: 640_000 },
  { platform: 'ZALO', dailySpend: 1_500_000, cpc: 2100, ctr: 0.019, crLead: 0.16, crOrder: 0.21, aov: 780_000 },
  { platform: 'COCCOC', dailySpend: 900_000, cpc: 2800, ctr: 0.015, crLead: 0.12, crOrder: 0.17, aov: 700_000 },
]

/** Nhiễu theo ngày, tất định (không dùng Math.random). */
function noise(dayIndex: number, salt: number): number {
  const x = Math.sin((dayIndex + 1) * 12.9898 + salt * 78.233) * 43758.5453
  return 0.8 + (x - Math.floor(x)) * 0.4 // 0.8 – 1.2
}

async function clean() {
  const r = await prisma.adsInsight.deleteMany({ where: { accountId: MANUAL_ACCOUNT } })
  console.log(`  Đã xoá ${r.count} dòng số liệu quảng cáo mẫu`)
}

async function cleanPlans() {
  const r = await prisma.adsChannelPlan.deleteMany({})
  console.log(`  Đã xoá ${r.count} mục tiêu kênh mẫu`)
}

async function main() {
  const isClean = process.argv.includes('--clean')
  console.log(isClean ? 'Xoá số liệu ads mẫu' : 'Seed số liệu ads mẫu — bắt đầu')
  await clean()
  await cleanPlans()
  if (isClean) {
    console.log('Hoàn tất')
    return
  }

  // Tháng trước (trọn tháng) + tháng này tới hôm nay — để so kỳ có dữ liệu.
  const prevStart = new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth() - 1, 1))
  const thisStart = new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth(), 1))
  const days: Date[] = []
  for (let d = new Date(prevStart); d <= TODAY; d = new Date(d.getTime() + 86_400_000)) {
    // Bỏ các ngày tương lai của tháng này (sau hôm nay).
    if (d >= thisStart && d > TODAY) continue
    days.push(new Date(d))
  }

  let count = 0
  for (const [salt, ch] of CHANNELS.entries()) {
    for (const [dayIndex, date] of days.entries()) {
      const f = noise(dayIndex, salt)
      const spend = new Decimal(ch.dailySpend).times(f)
      const clicks = Math.round(spend.dividedBy(ch.cpc).toNumber())
      const impressions = Math.round(clicks / ch.ctr)
      const leads = Math.round(clicks * ch.crLead)
      const orders = Math.round(leads * ch.crOrder)
      const revenue = new Decimal(orders).times(ch.aov)

      const key = {
        platform: ch.platform,
        accountId: MANUAL_ACCOUNT,
        campaignExtId: SENTINEL,
        adsetExtId: SENTINEL,
        adExtId: SENTINEL,
        date,
      }

      await prisma.adsInsight.upsert({
        where: { platform_accountId_campaignExtId_adsetExtId_adExtId_date: key },
        update: {
          impressions,
          clicks,
          spend: spend.toFixed(2),
          leads,
          conversions: orders,
          revenue: revenue.toFixed(2),
        },
        create: {
          ...key,
          impressions,
          clicks,
          spend: spend.toFixed(2),
          leads,
          conversions: orders,
          revenue: revenue.toFixed(2),
        },
      })
      count++
    }
  }

  console.log(`  Số dòng thực tế: ${count}`)

  // Mục tiêu tháng cho từng kênh ≈ chi phí thực tế cả tháng, đặt cao hơn ~5% để
  // % đạt chi phí quanh 95% (đang tiêu ít hơn kế hoạch một chút = tốt).
  let planCount = 0
  const targetMonth = TODAY.getUTCMonth() + 1
  const targetYear = TODAY.getUTCFullYear()
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate()

  for (const ch of CHANNELS) {
    const monthSpend = new Decimal(ch.dailySpend).times(daysInTargetMonth)
    // Doanh thu mục tiêu suy từ ROAS trung bình của kênh.
    const roas = ch.aov / (ch.cpc / (ch.crLead * ch.crOrder))
    const monthRevenue = monthSpend.times(roas)
    const monthClicks = monthSpend.dividedBy(ch.cpc)
    const monthLeads = monthClicks.times(ch.crLead)
    const monthOrders = monthLeads.times(ch.crOrder)

    await prisma.adsChannelPlan.upsert({
      where: { platform_year_month: { platform: ch.platform, year: targetYear, month: targetMonth } },
      update: {
        spendTarget: monthSpend.times(1.05).toFixed(2),
        revenueTarget: monthRevenue.times(1.05).toFixed(2),
        leadsTarget: Math.round(monthLeads.times(1.05).toNumber()),
        ordersTarget: Math.round(monthOrders.times(1.05).toNumber()),
      },
      create: {
        platform: ch.platform,
        year: targetYear,
        month: targetMonth,
        spendTarget: monthSpend.times(1.05).toFixed(2),
        revenueTarget: monthRevenue.times(1.05).toFixed(2),
        leadsTarget: Math.round(monthLeads.times(1.05).toNumber()),
        ordersTarget: Math.round(monthOrders.times(1.05).toNumber()),
      },
    })
    planCount++
  }

  console.log(`  Mục tiêu kênh: ${planCount} (tháng ${targetMonth}/${targetYear})`)
  console.log('Seed số liệu ads mẫu — hoàn tất')
}

main()
  .catch((e) => {
    console.error('Seed ads thất bại:', e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
