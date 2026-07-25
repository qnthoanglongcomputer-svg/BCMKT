import { describe, expect, it } from 'vitest'
import { parseInsight } from './parse'

const VALID = {
  cause: [{ factor: 'CTR giảm', evidence: 'CTR 1,2% so với 2,1% kỳ trước', impact: 'HIGH' }],
  recommendation: [
    { action: 'Thay creative nhóm A', priority: 'HIGH', expectedEffect: 'CTR phục hồi' },
  ],
  confidence: 0.8,
  insufficientData: false,
}

describe('parseInsight — output đúng', () => {
  it('nhận JSON thuần', () => {
    const result = parseInsight(JSON.stringify(VALID))
    expect(result.ok).toBe(true)
    expect(result.insight.cause[0]?.factor).toBe('CTR giảm')
  })

  it('nhận JSON bọc trong rào markdown', () => {
    const result = parseInsight('```json\n' + JSON.stringify(VALID) + '\n```')
    expect(result.ok).toBe(true)
    expect(result.insight.recommendation).toHaveLength(1)
  })

  it('nhận JSON có câu dẫn phía trước', () => {
    const result = parseInsight('Đây là kết quả phân tích:\n' + JSON.stringify(VALID))
    expect(result.ok).toBe(true)
  })

  it('bỏ được phần thừa phía sau JSON', () => {
    const result = parseInsight(JSON.stringify(VALID) + '\n\nHy vọng giúp ích!')
    expect(result.ok).toBe(true)
  })

  it('không cắt nhầm khi chuỗi bên trong có dấu ngoặc nhọn', () => {
    const tricky = {
      ...VALID,
      cause: [{ factor: 'Lỗi {template}', evidence: 'Mẫu {name} không thay', impact: 'LOW' }],
    }
    const result = parseInsight(JSON.stringify(tricky))
    expect(result.ok).toBe(true)
    expect(result.insight.cause[0]?.factor).toBe('Lỗi {template}')
  })
})

describe('parseInsight — output hỏng phải trả fallback, không crash', () => {
  it('chuỗi rỗng', () => {
    const result = parseInsight('')
    expect(result.ok).toBe(false)
    expect(result.insight.insufficientData).toBe(true)
    expect(result.insight.cause).toEqual([])
  })

  it('text thô không có JSON', () => {
    const result = parseInsight('Xin lỗi, tôi không thể phân tích dữ liệu này.')
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/Không tìm thấy JSON/)
  })

  it('JSON sai cú pháp', () => {
    const result = parseInsight('{ "cause": [ }')
    expect(result.ok).toBe(false)
  })

  it('thiếu trường bắt buộc', () => {
    const result = parseInsight(JSON.stringify({ cause: [] }))
    expect(result.ok).toBe(false)
    expect(result.insight).toEqual(expect.objectContaining({ insufficientData: true }))
  })

  it('impact không đúng giá trị cho phép', () => {
    const bad = { ...VALID, cause: [{ factor: 'x', evidence: 'y', impact: 'RAT_CAO' }] }
    const result = parseInsight(JSON.stringify(bad))
    expect(result.ok).toBe(false)
  })

  it('confidence ngoài khoảng 0–1', () => {
    const result = parseInsight(JSON.stringify({ ...VALID, confidence: 5 }))
    expect(result.ok).toBe(false)
  })

  it('chấp nhận khi mô hình tự báo thiếu dữ liệu', () => {
    const result = parseInsight(
      JSON.stringify({ cause: [], recommendation: [], confidence: 0, insufficientData: true }),
    )
    expect(result.ok).toBe(true)
    expect(result.insight.insufficientData).toBe(true)
  })
})
