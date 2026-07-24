/**
 * Seed dữ liệu nền cho MPMS: cây phòng ban, vị trí, định nghĩa KPI, nhóm trọng số.
 *
 * Idempotent — chạy lại nhiều lần không nhân đôi dữ liệu (dùng upsert theo `code`).
 * Không chứa dữ liệu thật của doanh nghiệp: nhân sự thật được tạo qua màn hình quản trị.
 */
import { PrismaClient, MetricAggregation, MetricDirection } from '@prisma/client'

const prisma = new PrismaClient()

const EFFECTIVE_YEAR = 2026

// ─────────────────────────────────────────────────────────────
// Cây phòng ban — theo mục 2 của đặc tả.
// Thêm phòng ban mới chỉ cần thêm dòng ở đây hoặc tạo qua UI quản trị.
// ─────────────────────────────────────────────────────────────
const DEPARTMENTS: Array<{
  code: string
  name: string
  parentCode: string | null
  level: number
}> = [
  { code: 'COMPANY', name: 'Công ty', parentCode: null, level: 0 },
  { code: 'MARKETING', name: 'Phòng Marketing', parentCode: 'COMPANY', level: 1 },

  { code: 'PERFORMANCE', name: 'Performance / Digital', parentCode: 'MARKETING', level: 2 },
  { code: 'CONTENT_SOCIAL', name: 'Content & Social', parentCode: 'MARKETING', level: 2 },
  { code: 'TRADE', name: 'Trade Marketing', parentCode: 'MARKETING', level: 2 },
  { code: 'BRANDING', name: 'Branding', parentCode: 'MARKETING', level: 2 },
]

// ─────────────────────────────────────────────────────────────
// Vị trí công việc
// ─────────────────────────────────────────────────────────────
const POSITIONS: Array<{ code: string; name: string; departmentCode: string }> = [
  { code: 'LEAD_ADS', name: 'Lead Ads', departmentCode: 'PERFORMANCE' },
  { code: 'ADS_PERFORMANCE', name: 'Ads Performance', departmentCode: 'PERFORMANCE' },
  { code: 'CONTENT_VIDEO_ADS', name: 'Content Video Ads', departmentCode: 'PERFORMANCE' },
  { code: 'DESIGNER_PERF', name: 'Designer (Performance)', departmentCode: 'PERFORMANCE' },
  { code: 'EDITOR_PERF', name: 'Editor (Performance)', departmentCode: 'PERFORMANCE' },

  { code: 'CONTENT_SOCIAL_EXEC', name: 'Content Social', departmentCode: 'CONTENT_SOCIAL' },
  { code: 'TIKTOK_CREATOR', name: 'TikTok Creator', departmentCode: 'CONTENT_SOCIAL' },
  { code: 'DESIGNER_SOCIAL', name: 'Designer (Content)', departmentCode: 'CONTENT_SOCIAL' },
  { code: 'EDITOR_SOCIAL', name: 'Editor (Content)', departmentCode: 'CONTENT_SOCIAL' },
  { code: 'SEO_CONTENT', name: 'SEO Content', departmentCode: 'CONTENT_SOCIAL' },

  { code: 'TRADE_LEADER', name: 'Trade Leader', departmentCode: 'TRADE' },
  { code: 'TRADE_EXECUTIVE', name: 'Trade Executive', departmentCode: 'TRADE' },

  { code: 'BRANDING_EXECUTIVE', name: 'Branding Executive', departmentCode: 'BRANDING' },
]

// ─────────────────────────────────────────────────────────────
// Định nghĩa KPI.
// direction: LOWER_BETTER cho chi phí, CPA, CPC, lỗi, trễ deadline.
// aggregation: RATIO cho mọi chỉ số tỷ lệ — tính lại từ tử/mẫu, không cộng dồn.
// ─────────────────────────────────────────────────────────────
type MetricSeed = {
  code: string
  name: string
  unit: string
  direction: MetricDirection
  aggregation: MetricAggregation
  numeratorCode?: string
  denominatorCode?: string
}

const METRICS: MetricSeed[] = [
  // Số nguyên liệu — cộng dồn được
  { code: 'LEAD', name: 'Lead', unit: 'lead', direction: 'HIGHER_BETTER', aggregation: 'SUM' },
  { code: 'REVENUE', name: 'Doanh thu', unit: 'VND', direction: 'HIGHER_BETTER', aggregation: 'SUM' },
  { code: 'SPEND', name: 'Chi phí', unit: 'VND', direction: 'LOWER_BETTER', aggregation: 'SUM' },
  { code: 'ORDERS', name: 'Đơn hàng', unit: 'đơn', direction: 'HIGHER_BETTER', aggregation: 'SUM' },
  { code: 'IMPRESSIONS', name: 'Lượt hiển thị', unit: 'lượt', direction: 'HIGHER_BETTER', aggregation: 'SUM' },
  { code: 'CLICKS', name: 'Lượt click', unit: 'lượt', direction: 'HIGHER_BETTER', aggregation: 'SUM' },

  { code: 'VIDEO', name: 'Video', unit: 'video', direction: 'HIGHER_BETTER', aggregation: 'SUM' },
  { code: 'VIDEO_ADS', name: 'Video Ads', unit: 'video', direction: 'HIGHER_BETTER', aggregation: 'SUM' },
  { code: 'VIDEO_TIKTOK', name: 'Video TikTok', unit: 'video', direction: 'HIGHER_BETTER', aggregation: 'SUM' },
  { code: 'CONTENT_POST', name: 'Bài viết', unit: 'bài', direction: 'HIGHER_BETTER', aggregation: 'SUM' },
  { code: 'BANNER', name: 'Banner thiết kế', unit: 'banner', direction: 'HIGHER_BETTER', aggregation: 'SUM' },

  { code: 'REACH', name: 'Reach', unit: 'lượt', direction: 'HIGHER_BETTER', aggregation: 'SUM' },
  { code: 'ORGANIC_REACH', name: 'Organic Reach', unit: 'lượt', direction: 'HIGHER_BETTER', aggregation: 'SUM' },
  { code: 'ENGAGEMENT', name: 'Engagement', unit: 'lượt', direction: 'HIGHER_BETTER', aggregation: 'SUM' },
  { code: 'VIDEO_VIEW', name: 'View', unit: 'lượt', direction: 'HIGHER_BETTER', aggregation: 'SUM' },
  { code: 'FOLLOWER', name: 'Follower', unit: 'người', direction: 'HIGHER_BETTER', aggregation: 'SUM' },
  { code: 'SAVES', name: 'Saves', unit: 'lượt', direction: 'HIGHER_BETTER', aggregation: 'SUM' },
  { code: 'SHARES', name: 'Share', unit: 'lượt', direction: 'HIGHER_BETTER', aggregation: 'SUM' },

  { code: 'DESIGN_ERROR', name: 'Lỗi thiết kế', unit: 'lỗi', direction: 'LOWER_BETTER', aggregation: 'SUM' },
  { code: 'DEADLINE_MISS', name: 'Trễ deadline', unit: 'lần', direction: 'LOWER_BETTER', aggregation: 'SUM' },
  { code: 'FEEDBACK_SCORE', name: 'Điểm feedback', unit: 'điểm', direction: 'HIGHER_BETTER', aggregation: 'SUM' },
  { code: 'QUALITY_SCORE', name: 'Điểm chất lượng', unit: 'điểm', direction: 'HIGHER_BETTER', aggregation: 'SUM' },

  { code: 'PROMO_COUNT', name: 'CTKM triển khai', unit: 'chương trình', direction: 'HIGHER_BETTER', aggregation: 'SUM' },
  { code: 'AUDIT_COUNT', name: 'Lượt audit', unit: 'lượt', direction: 'HIGHER_BETTER', aggregation: 'SUM' },
  { code: 'POSM_COUNT', name: 'POSM triển khai', unit: 'điểm', direction: 'HIGHER_BETTER', aggregation: 'SUM' },
  { code: 'NEW_CUSTOMERS', name: 'Khách mới', unit: 'khách', direction: 'HIGHER_BETTER', aggregation: 'SUM' },

  // Chỉ số tỷ lệ — LUÔN tính lại từ tử/mẫu, không bao giờ lấy trung bình
  {
    code: 'CPA', name: 'CPA', unit: 'VND',
    direction: 'LOWER_BETTER', aggregation: 'RATIO',
    numeratorCode: 'SPEND', denominatorCode: 'LEAD',
  },
  {
    code: 'CPC', name: 'CPC', unit: 'VND',
    direction: 'LOWER_BETTER', aggregation: 'RATIO',
    numeratorCode: 'SPEND', denominatorCode: 'CLICKS',
  },
  {
    code: 'CTR', name: 'CTR', unit: '%',
    direction: 'HIGHER_BETTER', aggregation: 'RATIO',
    numeratorCode: 'CLICKS', denominatorCode: 'IMPRESSIONS',
  },
  {
    code: 'ROAS', name: 'ROAS', unit: 'lần',
    direction: 'HIGHER_BETTER', aggregation: 'RATIO',
    numeratorCode: 'REVENUE', denominatorCode: 'SPEND',
  },
  {
    code: 'AOV', name: 'AOV', unit: 'VND',
    direction: 'HIGHER_BETTER', aggregation: 'RATIO',
    numeratorCode: 'REVENUE', denominatorCode: 'ORDERS',
  },
  {
    code: 'ROS', name: 'ROS', unit: '%',
    direction: 'LOWER_BETTER', aggregation: 'RATIO',
    numeratorCode: 'SPEND', denominatorCode: 'REVENUE',
  },
]

// ─────────────────────────────────────────────────────────────
// Nhóm trọng số theo vị trí — mục 5 của đặc tả. Tổng mỗi nhóm = 100%.
// ─────────────────────────────────────────────────────────────
const WEIGHT_GROUPS: Array<{
  name: string
  positionCode: string
  weights: Array<{ kpiCode: string; weight: string }>
}> = [
  {
    name: 'Ads Performance 2026',
    positionCode: 'ADS_PERFORMANCE',
    weights: [
      { kpiCode: 'LEAD', weight: '0.4' },
      { kpiCode: 'CPA', weight: '0.2' },
      { kpiCode: 'ROAS', weight: '0.2' },
      { kpiCode: 'REVENUE', weight: '0.2' },
    ],
  },
  {
    name: 'Editor 2026',
    positionCode: 'EDITOR_PERF',
    weights: [
      { kpiCode: 'VIDEO_ADS', weight: '0.4' },
      { kpiCode: 'VIDEO_TIKTOK', weight: '0.2' },
      { kpiCode: 'DEADLINE_MISS', weight: '0.2' },
      { kpiCode: 'QUALITY_SCORE', weight: '0.2' },
    ],
  },
  {
    name: 'Designer 2026',
    positionCode: 'DESIGNER_PERF',
    weights: [
      { kpiCode: 'DEADLINE_MISS', weight: '0.3' },
      { kpiCode: 'DESIGN_ERROR', weight: '0.3' },
      { kpiCode: 'FEEDBACK_SCORE', weight: '0.2' },
      { kpiCode: 'BANNER', weight: '0.2' },
    ],
  },
]

// ─────────────────────────────────────────────────────────────
// Quy tắc cảnh báo — ngưỡng là dữ liệu, không hardcode trong code
// ─────────────────────────────────────────────────────────────
const ALERT_RULES = [
  {
    code: 'CPA_OVER_TARGET',
    name: 'CPA vượt mục tiêu',
    kpiCode: 'CPA',
    severity: 'CRITICAL' as const,
    condition: { operator: 'gt', thresholdRatio: 1.1 },
  },
  {
    code: 'LEAD_DECLINING',
    name: 'Lead giảm liên tục',
    kpiCode: 'LEAD',
    severity: 'WARNING' as const,
    condition: { operator: 'declining', consecutiveDays: 3 },
  },
  {
    code: 'KPI_BELOW_80',
    name: 'KPI dưới 80%',
    kpiCode: null,
    severity: 'WARNING' as const,
    condition: { operator: 'lt', thresholdScore: 80 },
  },
  {
    code: 'FORECAST_MISS',
    name: 'Dự báo không đạt KPI',
    kpiCode: null,
    severity: 'WARNING' as const,
    condition: { operator: 'forecastLt', thresholdRatio: 1 },
  },
  {
    code: 'CAMPAIGN_OVER_BUDGET',
    name: 'Campaign vượt ngân sách',
    kpiCode: 'SPEND',
    severity: 'CRITICAL' as const,
    condition: { operator: 'gt', thresholdRatio: 1 },
  },
]

async function main() {
  console.log('Seed MPMS — bắt đầu')

  // Phòng ban: seed theo thứ tự để parent luôn tồn tại trước con.
  const departmentIdByCode = new Map<string, string>()
  for (const dept of DEPARTMENTS) {
    const parentId = dept.parentCode
      ? (departmentIdByCode.get(dept.parentCode) ?? null)
      : null
    const record = await prisma.department.upsert({
      where: { code: dept.code },
      update: { name: dept.name, parentId, level: dept.level },
      create: { code: dept.code, name: dept.name, parentId, level: dept.level },
    })
    departmentIdByCode.set(dept.code, record.id)
  }
  console.log(`  Phòng ban: ${DEPARTMENTS.length}`)

  // Vị trí
  const positionIdByCode = new Map<string, string>()
  for (const pos of POSITIONS) {
    const departmentId = departmentIdByCode.get(pos.departmentCode)
    if (!departmentId) throw new Error(`Không tìm thấy phòng ban ${pos.departmentCode}`)
    const record = await prisma.position.upsert({
      where: { code: pos.code },
      update: { name: pos.name, departmentId },
      create: { code: pos.code, name: pos.name, departmentId },
    })
    positionIdByCode.set(pos.code, record.id)
  }
  console.log(`  Vị trí: ${POSITIONS.length}`)

  // Định nghĩa KPI
  const metricIdByCode = new Map<string, string>()
  for (const [index, metric] of METRICS.entries()) {
    const record = await prisma.kpiDefinition.upsert({
      where: { code: metric.code },
      update: {
        name: metric.name,
        unit: metric.unit,
        direction: metric.direction,
        aggregation: metric.aggregation,
        numeratorCode: metric.numeratorCode ?? null,
        denominatorCode: metric.denominatorCode ?? null,
        sortOrder: index,
      },
      create: {
        code: metric.code,
        name: metric.name,
        unit: metric.unit,
        direction: metric.direction,
        aggregation: metric.aggregation,
        numeratorCode: metric.numeratorCode ?? null,
        denominatorCode: metric.denominatorCode ?? null,
        sortOrder: index,
      },
    })
    metricIdByCode.set(metric.code, record.id)
  }
  console.log(`  Định nghĩa KPI: ${METRICS.length}`)

  // Nhóm trọng số
  for (const group of WEIGHT_GROUPS) {
    const positionId = positionIdByCode.get(group.positionCode)
    if (!positionId) throw new Error(`Không tìm thấy vị trí ${group.positionCode}`)

    const sum = group.weights.reduce((acc, w) => acc + Number(w.weight), 0)
    if (Math.abs(sum - 1) > 0.0001) {
      throw new Error(
        `Nhóm trọng số "${group.name}" có tổng ${(sum * 100).toFixed(2)}%, phải bằng 100%.`,
      )
    }

    // Không dùng upsert vì khoá unique có cột nullable (departmentId) —
    // Prisma không nhận null trong compound unique where.
    const existing = await prisma.kpiWeightGroup.findFirst({
      where: { positionId, departmentId: null, effectiveYear: EFFECTIVE_YEAR },
    })
    const record = existing
      ? await prisma.kpiWeightGroup.update({
          where: { id: existing.id },
          data: { name: group.name },
        })
      : await prisma.kpiWeightGroup.create({
          data: { name: group.name, positionId, effectiveYear: EFFECTIVE_YEAR },
        })

    for (const w of group.weights) {
      const kpiDefinitionId = metricIdByCode.get(w.kpiCode)
      if (!kpiDefinitionId) throw new Error(`Không tìm thấy metric ${w.kpiCode}`)
      await prisma.kpiWeight.upsert({
        where: { groupId_kpiDefinitionId: { groupId: record.id, kpiDefinitionId } },
        update: { weight: w.weight },
        create: { groupId: record.id, kpiDefinitionId, weight: w.weight },
      })
    }
  }
  console.log(`  Nhóm trọng số: ${WEIGHT_GROUPS.length}`)

  // Quy tắc cảnh báo
  for (const rule of ALERT_RULES) {
    const kpiDefinitionId = rule.kpiCode ? (metricIdByCode.get(rule.kpiCode) ?? null) : null
    await prisma.alertRule.upsert({
      where: { code: rule.code },
      update: { name: rule.name, severity: rule.severity, condition: rule.condition, kpiDefinitionId },
      create: {
        code: rule.code,
        name: rule.name,
        severity: rule.severity,
        condition: rule.condition,
        kpiDefinitionId,
      },
    })
  }
  console.log(`  Quy tắc cảnh báo: ${ALERT_RULES.length}`)

  console.log('Seed MPMS — hoàn tất')
}

main()
  .catch((error) => {
    console.error('Seed thất bại:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
