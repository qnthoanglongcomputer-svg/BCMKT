import { describe, expect, it } from 'vitest'
import { computeAchievement, computeScore, validateWeightGroup } from './scoring'
import { gradeFromScore } from './grading'
import type { ScoreItem } from './types'

describe('computeAchievement', () => {
  it('HIGHER_BETTER: actual chia target', () => {
    const a = computeAchievement({
      kpiCode: 'LEAD',
      target: 6000,
      actual: 4850,
      weight: 1,
      direction: 'HIGHER_BETTER',
    })
    expect(a.toFixed(4)).toBe('0.8083')
  })

  it('LOWER_BETTER: đảo công thức — CPA thấp hơn mục tiêu là vượt chỉ tiêu', () => {
    const a = computeAchievement({
      kpiCode: 'CPA',
      target: 100000,
      actual: 90000,
      weight: 1,
      direction: 'LOWER_BETTER',
    })
    // 100000 / 90000 = 1.1111 (dưới trần 1.2)
    expect(a.toFixed(4)).toBe('1.1111')
  })

  it('LOWER_BETTER: CPA vượt mục tiêu 18% thì achievement dưới 1', () => {
    const a = computeAchievement({
      kpiCode: 'CPA',
      target: 100000,
      actual: 118000,
      weight: 1,
      direction: 'LOWER_BETTER',
    })
    expect(a.toFixed(4)).toBe('0.8475')
  })

  it('áp trần achievement mặc định 120%', () => {
    const a = computeAchievement({
      kpiCode: 'LEAD',
      target: 100,
      actual: 500,
      weight: 1,
      direction: 'HIGHER_BETTER',
    })
    expect(a.toString()).toBe('1.2')
  })

  it('cho phép ghi đè trần theo từng metric', () => {
    const a = computeAchievement({
      kpiCode: 'LEAD',
      target: 100,
      actual: 500,
      weight: 1,
      direction: 'HIGHER_BETTER',
      cap: 2,
    })
    expect(a.toString()).toBe('2')
  })

  it('LOWER_BETTER với actual = 0 trả về trần, không chia cho 0', () => {
    const a = computeAchievement({
      kpiCode: 'DESIGN_ERROR',
      target: 5,
      actual: 0,
      weight: 1,
      direction: 'LOWER_BETTER',
    })
    expect(a.toString()).toBe('1.2')
  })

  it('không trả achievement âm', () => {
    const a = computeAchievement({
      kpiCode: 'REVENUE',
      target: 100,
      actual: -50,
      weight: 1,
      direction: 'HIGHER_BETTER',
    })
    expect(a.toString()).toBe('0')
  })

  it('ném lỗi khi target = 0 (phải loại metric trước khi gọi)', () => {
    expect(() =>
      computeAchievement({
        kpiCode: 'LEAD',
        target: 0,
        actual: 100,
        weight: 1,
        direction: 'HIGHER_BETTER',
      }),
    ).toThrow(/target = 0/)
  })
})

describe('computeScore', () => {
  const performanceItems: ScoreItem[] = [
    { kpiCode: 'LEAD', target: 6000, actual: 6000, weight: 0.4, direction: 'HIGHER_BETTER' },
    { kpiCode: 'CPA', target: 100, actual: 100, weight: 0.2, direction: 'LOWER_BETTER' },
    { kpiCode: 'ROAS', target: 3, actual: 3, weight: 0.2, direction: 'HIGHER_BETTER' },
    { kpiCode: 'REVENUE', target: 1000, actual: 1000, weight: 0.2, direction: 'HIGHER_BETTER' },
  ]

  it('đạt đúng mục tiêu mọi metric cho 100 điểm', () => {
    const result = computeScore(performanceItems)
    expect(result.score.toString()).toBe('100')
    expect(result.grade).toBe('A+')
  })

  it('tính đúng điểm có trọng số khi các metric đạt khác nhau', () => {
    const result = computeScore([
      { kpiCode: 'LEAD', target: 100, actual: 90, weight: 0.4, direction: 'HIGHER_BETTER' },
      { kpiCode: 'CPA', target: 100, actual: 100, weight: 0.6, direction: 'LOWER_BETTER' },
    ])
    // 0.9*0.4 + 1.0*0.6 = 0.96 → 96
    expect(result.score.toString()).toBe('96')
    expect(result.grade).toBe('A+')
  })

  it('loại metric có target = 0 và chuẩn hoá lại trọng số còn lại', () => {
    const result = computeScore([
      { kpiCode: 'LEAD', target: 100, actual: 80, weight: 0.5, direction: 'HIGHER_BETTER' },
      { kpiCode: 'VIDEO', target: 0, actual: 0, weight: 0.5, direction: 'HIGHER_BETTER' },
    ])
    const video = result.items.find((i) => i.kpiCode === 'VIDEO')
    const lead = result.items.find((i) => i.kpiCode === 'LEAD')
    expect(video?.excluded).toBe(true)
    expect(lead?.normalizedWeight.toString()).toBe('1') // 0.5 / 0.5
    expect(result.score.toString()).toBe('80')
  })

  it('trả 0 điểm khi toàn bộ metric bị loại, không chia cho 0', () => {
    const result = computeScore([
      { kpiCode: 'A', target: 0, actual: 0, weight: 0.5, direction: 'HIGHER_BETTER' },
      { kpiCode: 'B', target: 0, actual: 0, weight: 0.5, direction: 'HIGHER_BETTER' },
    ])
    expect(result.score.toString()).toBe('0')
    expect(result.grade).toBe('D')
  })

  it('chuẩn hoá đúng khi tổng trọng số đầu vào khác 100%', () => {
    const result = computeScore([
      { kpiCode: 'A', target: 100, actual: 100, weight: 2, direction: 'HIGHER_BETTER' },
      { kpiCode: 'B', target: 100, actual: 50, weight: 2, direction: 'HIGHER_BETTER' },
    ])
    expect(result.score.toString()).toBe('75')
  })

  it('giữ nguyên thứ tự metric đầu vào', () => {
    const result = computeScore(performanceItems)
    expect(result.items.map((i) => i.kpiCode)).toEqual([
      'LEAD',
      'CPA',
      'ROAS',
      'REVENUE',
    ])
  })

  it('từ chối trọng số âm', () => {
    expect(() =>
      computeScore([
        { kpiCode: 'A', target: 100, actual: 100, weight: -1, direction: 'HIGHER_BETTER' },
      ]),
    ).toThrow(/không được âm/)
  })

  it('từ chối danh sách rỗng', () => {
    expect(() => computeScore([])).toThrow(/Không có metric nào/)
  })
})

describe('gradeFromScore', () => {
  it('xếp loại đúng tại các ngưỡng biên', () => {
    expect(gradeFromScore(100)).toBe('A+')
    expect(gradeFromScore(95)).toBe('A+')
    expect(gradeFromScore('94.99')).toBe('A')
    expect(gradeFromScore(90)).toBe('A')
    expect(gradeFromScore('89.99')).toBe('B')
    expect(gradeFromScore(80)).toBe('B')
    expect(gradeFromScore('79.99')).toBe('C')
    expect(gradeFromScore(70)).toBe('C')
    expect(gradeFromScore('69.99')).toBe('D')
    expect(gradeFromScore(0)).toBe('D')
  })

  it('điểm vượt 100 (nhờ trần 120%) vẫn là A+', () => {
    expect(gradeFromScore(115)).toBe('A+')
  })
})

describe('validateWeightGroup', () => {
  it('chấp nhận nhóm có tổng đúng 100%', () => {
    expect(() => validateWeightGroup([0.4, 0.2, 0.2, 0.2])).not.toThrow()
  })

  it('từ chối nhóm có tổng khác 100%', () => {
    expect(() => validateWeightGroup([0.4, 0.2, 0.2])).toThrow(/phải bằng 100%/)
  })

  it('từ chối nhóm rỗng', () => {
    expect(() => validateWeightGroup([])).toThrow(/rỗng/)
  })
})
