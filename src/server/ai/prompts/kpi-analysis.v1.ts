/**
 * Prompt phân tích hiệu suất KPI — phiên bản 1.
 *
 * Prompt được đánh version trong tên file. Đổi prompt là **đổi hành vi hệ
 * thống**: tạo file version mới thay vì sửa đè, để so sánh được chất lượng
 * trước và sau.
 */

export const PROMPT_VERSION = 'kpi-analysis.v1'

export interface MetricSnapshot {
  name: string
  unit: string
  /** 'Cao hơn tốt' hoặc 'Thấp hơn tốt' */
  direction: string
  target: number | null
  actual: number | null
  /** Tỷ lệ đạt so với tiến độ kỳ, 0.84 = 84% */
  attainment: number | null
  /** Thay đổi so kỳ trước, dạng tỷ lệ */
  delta: number | null
}

export interface AnalysisInput {
  scopeName: string
  periodLabel: string
  elapsedDays: number
  totalDays: number
  score: number | null
  grade: string | null
  metrics: MetricSnapshot[]
}

export const SYSTEM_PROMPT = `Bạn là chuyên gia phân tích hiệu suất Marketing, hỗ trợ Trưởng phòng Marketing của một doanh nghiệp Việt Nam.

NHIỆM VỤ: đọc số liệu KPI đã được hệ thống tính sẵn, chỉ ra nguyên nhân của các chỉ số bất thường và đề xuất hành động cụ thể.

RÀNG BUỘC BẮT BUỘC:
1. CHỈ kết luận từ dữ liệu được cung cấp. Không suy đoán số liệu không có trong đầu vào.
2. KHÔNG tự tính toán lại bất kỳ con số nào. Mọi con số đã được hệ thống tính; nhiệm vụ của bạn là diễn giải.
3. Nếu dữ liệu không đủ để kết luận, đặt "insufficientData": true và để mảng cause, recommendation rỗng.
4. Chú ý chiều của chỉ số: với chỉ số "Thấp hơn tốt" (CPA, chi phí, lỗi, trễ deadline), giá trị GIẢM là tin TỐT.
5. Mỗi nguyên nhân phải kèm bằng chứng là con số cụ thể lấy từ dữ liệu đầu vào.
6. Mỗi đề xuất phải hành động được ngay: nêu rõ làm gì, với đối tượng nào. Tránh lời khuyên chung chung như "cải thiện chất lượng".
7. Nếu mọi chỉ số đều bình thường, nói rõ không phát hiện bất thường. KHÔNG bịa ra vấn đề.
8. Viết bằng tiếng Việt.

ĐỊNH DẠNG: trả về DUY NHẤT một object JSON hợp lệ, không kèm giải thích, không bọc trong markdown:
{
  "cause": [{ "factor": "...", "evidence": "...", "impact": "HIGH|MEDIUM|LOW" }],
  "recommendation": [{ "action": "...", "priority": "HIGH|MEDIUM|LOW", "expectedEffect": "..." }],
  "confidence": 0.0-1.0,
  "insufficientData": false
}

Tối đa 6 nguyên nhân và 6 đề xuất. Ưu tiên chất lượng hơn số lượng.`

export function buildUserPrompt(input: AnalysisInput): string {
  const lines: string[] = [
    `Phạm vi: ${input.scopeName}`,
    `Kỳ: ${input.periodLabel} (đã qua ${input.elapsedDays}/${input.totalDays} ngày)`,
    input.score !== null
      ? `Điểm KPI: ${input.score.toFixed(1)}${input.grade ? ` (xếp loại ${input.grade})` : ''}`
      : 'Điểm KPI: chưa tính được',
    '',
    'CHỈ SỐ (% đạt tính theo tiến độ kỳ, không phải theo mục tiêu cả kỳ):',
  ]

  for (const m of input.metrics) {
    const parts = [
      `- ${m.name} (${m.unit}, ${m.direction})`,
      `  mục tiêu: ${m.target ?? 'chưa đặt'}`,
      `  thực tế: ${m.actual ?? 'chưa có dữ liệu'}`,
      `  % đạt: ${m.attainment === null ? 'chưa xác định' : `${(m.attainment * 100).toFixed(1)}%`}`,
      `  so kỳ trước: ${m.delta === null ? 'không có dữ liệu kỳ trước' : `${(m.delta * 100).toFixed(1)}%`}`,
    ]
    lines.push(parts.join('\n'))
  }

  lines.push(
    '',
    'Phân tích các chỉ số trên. Chỉ nêu vấn đề thực sự có trong dữ liệu.',
  )

  return lines.join('\n')
}
