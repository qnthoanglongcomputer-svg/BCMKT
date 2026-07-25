import Anthropic from '@anthropic-ai/sdk'

/**
 * Wrapper quanh Claude API.
 *
 * Chưa cấu hình `ANTHROPIC_API_KEY` → `isConfigured()` trả false và UI ẩn tính
 * năng thay vì lỗi 500. Đây là trạng thái bình thường khi mới cài đặt, không
 * phải sự cố.
 */

export class AiInsightError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiInsightError'
  }
}

/** Model mặc định theo CLAUDE.md mục 1; đổi được qua biến môi trường. */
const DEFAULT_MODEL = 'claude-sonnet-5'

/** Đủ chỗ cho một object JSON có 6 nguyên nhân và 6 đề xuất. */
const MAX_TOKENS = 4096

export function isConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim())
}

export function getModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL
}

let cachedClient: Anthropic | null = null

function getClient(): Anthropic {
  if (!isConfigured()) {
    throw new AiInsightError('Chưa cấu hình ANTHROPIC_API_KEY cho hệ thống.')
  }
  cachedClient ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return cachedClient
}

export interface CompletionResult {
  text: string
  inputTokens: number
  outputTokens: number
}

/**
 * Gọi model một lượt, trả về text thô để tầng parse xử lý.
 *
 * Không đặt `temperature`: model hiện tại từ chối tham số này (trả 400).
 * Muốn đổi giọng văn hay độ chi tiết thì sửa prompt, không sửa tham số sinh.
 *
 * Tắt thinking: đây là tác vụ trích xuất có cấu trúc, không phải bài toán suy
 * luận nhiều bước — bật thinking chỉ thêm độ trễ và chi phí.
 */
export async function complete(
  systemPrompt: string,
  userPrompt: string,
): Promise<CompletionResult> {
  const client = getClient()

  try {
    const response = await client.messages.create({
      model: getModel(),
      max_tokens: MAX_TOKENS,
      thinking: { type: 'disabled' },
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    if (response.stop_reason === 'refusal') {
      throw new AiInsightError('Mô hình từ chối phân tích nội dung này.')
    }

    // `content` là union — phải thu hẹp theo `type` trước khi đọc `text`.
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')

    if (text.trim() === '') {
      throw new AiInsightError('Mô hình trả về nội dung rỗng.')
    }

    return {
      text,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    }
  } catch (error) {
    if (error instanceof AiInsightError) throw error

    if (error instanceof Anthropic.RateLimitError) {
      throw new AiInsightError('Đã vượt giới hạn gọi API. Vui lòng thử lại sau ít phút.')
    }
    if (error instanceof Anthropic.AuthenticationError) {
      throw new AiInsightError('Khoá API không hợp lệ. Kiểm tra lại ANTHROPIC_API_KEY.')
    }
    if (error instanceof Anthropic.APIConnectionError) {
      throw new AiInsightError('Không kết nối được tới dịch vụ AI. Kiểm tra mạng rồi thử lại.')
    }

    // Không để lộ chi tiết kỹ thuật ra client; log lại để chẩn đoán.
    console.error('Gọi Claude API thất bại:', error)
    throw new AiInsightError('Không phân tích được. Vui lòng thử lại sau.')
  }
}
