import { FALLBACK_INSIGHT, insightSchema, type Insight } from './schema'

/**
 * Tách và kiểm tra JSON từ output của mô hình.
 *
 * Mô hình đôi khi bọc JSON trong ```json ... ``` hoặc kèm câu dẫn dù prompt đã
 * cấm. Hàm này chịu được cả hai, nhưng **không cố đoán** khi cấu trúc sai —
 * sai schema thì trả fallback để UI hiện thông báo thống nhất.
 *
 * Hàm thuần, test được không cần gọi API.
 */
export function parseInsight(raw: string): { insight: Insight; ok: boolean; reason?: string } {
  const json = extractJson(raw)
  if (json === null) {
    return { insight: FALLBACK_INSIGHT, ok: false, reason: 'Không tìm thấy JSON trong kết quả' }
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(json)
  } catch {
    return { insight: FALLBACK_INSIGHT, ok: false, reason: 'JSON không hợp lệ' }
  }

  const result = insightSchema.safeParse(parsedJson)
  if (!result.success) {
    return {
      insight: FALLBACK_INSIGHT,
      ok: false,
      reason: `Cấu trúc không đúng: ${result.error.issues[0]?.message ?? 'không rõ'}`,
    }
  }

  return { insight: result.data, ok: true }
}

/** Lấy object JSON đầu tiên trong chuỗi, bỏ qua rào markdown và câu dẫn. */
function extractJson(raw: string): string | null {
  const trimmed = raw.trim()

  // Trường hợp phổ biến nhất: cả chuỗi đã là JSON.
  if (trimmed.startsWith('{')) {
    const balanced = takeBalancedObject(trimmed)
    if (balanced) return balanced
  }

  const fenced = trimmed.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
  if (fenced?.[1]) return fenced[1]

  const firstBrace = trimmed.indexOf('{')
  if (firstBrace === -1) return null
  return takeBalancedObject(trimmed.slice(firstBrace))
}

/**
 * Cắt đúng object JSON cân bằng ngoặc, bỏ phần thừa phía sau.
 * Bỏ qua ngoặc nằm trong chuỗi để không cắt nhầm.
 */
function takeBalancedObject(text: string): string | null {
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (escaped) {
      escaped = false
      continue
    }
    if (char === '\\') {
      escaped = true
      continue
    }
    if (char === '"') {
      inString = !inString
      continue
    }
    if (inString) continue

    if (char === '{') depth++
    else if (char === '}') {
      depth--
      if (depth === 0) return text.slice(0, i + 1)
    }
  }

  return null
}
