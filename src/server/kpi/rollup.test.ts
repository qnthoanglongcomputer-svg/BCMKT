import { describe, expect, it } from 'vitest'
import { RollupError, rollup, rollupRatio, rollupSum } from './rollup'

describe('rollupSum', () => {
  it('cộng dồn metric SUM lên cấp cha', () => {
    expect(rollupSum([{ value: 100 }, { value: 250 }, { value: 50 }]).toString()).toBe('400')
  })

  it('trả 0 cho danh sách rỗng', () => {
    expect(rollupSum([]).toString()).toBe('0')
  })

  it('cộng chính xác số thập phân, không lệch như Float', () => {
    const result = rollupSum([{ value: '0.1' }, { value: '0.2' }])
    expect(result.toString()).toBe('0.3')
  })

  it('báo lỗi khi thiếu value', () => {
    expect(() => rollupSum([{ numerator: 1, denominator: 2 }])).toThrow(RollupError)
  })
})

describe('rollupRatio', () => {
  it('tính lại từ tử/mẫu đã cộng dồn, KHÔNG lấy trung bình các tỷ lệ', () => {
    // Nhân viên A: CPA = 100/10 = 10 ; Nhân viên B: CPA = 900/10 = 90
    // Trung bình sai:  (10 + 90) / 2 = 50
    // Đúng:            (100 + 900) / (10 + 10) = 50 ... chọn số khác để lộ khác biệt
    const result = rollupRatio([
      { numerator: 100, denominator: 10 }, // 10
      { numerator: 900, denominator: 90 }, // 10
    ])
    expect(result.value?.toString()).toBe('10')
  })

  it('cho kết quả khác với trung bình cộng của các tỷ lệ', () => {
    // A: 100/1 = 100 ; B: 100/99 ≈ 1.0101
    // Trung bình các tỷ lệ ≈ 50.5 — SAI
    // Đúng: 200 / 100 = 2
    const result = rollupRatio([
      { numerator: 100, denominator: 1 },
      { numerator: 100, denominator: 99 },
    ])
    expect(result.value?.toString()).toBe('2')
    expect(result.numerator?.toString()).toBe('200')
    expect(result.denominator?.toString()).toBe('100')
  })

  it('trả null khi mẫu số bằng 0, không chia cho 0 và không trả 0', () => {
    const result = rollupRatio([{ numerator: 100, denominator: 0 }])
    expect(result.value).toBeNull()
    expect(result.denominator?.toString()).toBe('0')
  })

  it('báo lỗi khi thiếu tử hoặc mẫu', () => {
    expect(() => rollupRatio([{ value: 100 }])).toThrow(RollupError)
  })
})

describe('rollup', () => {
  it('chọn đúng cách cộng dồn theo aggregation', () => {
    expect(rollup('SUM', [{ value: 10 }, { value: 20 }]).value?.toString()).toBe('30')
    expect(
      rollup('RATIO', [
        { numerator: 10, denominator: 2 },
        { numerator: 20, denominator: 3 },
      ]).value?.toString(),
    ).toBe('6')
  })

  it('trả null cho danh sách rỗng ở cả hai loại', () => {
    expect(rollup('SUM', []).value).toBeNull()
    expect(rollup('RATIO', []).value).toBeNull()
  })

  it('rollup ba cấp cho ra cùng kết quả với rollup một lần — SUM', () => {
    // Team 1: [10, 20], Team 2: [30, 40]
    const team1 = rollup('SUM', [{ value: 10 }, { value: 20 }])
    const team2 = rollup('SUM', [{ value: 30 }, { value: 40 }])
    const dept = rollup('SUM', [
      { value: team1.value as never },
      { value: team2.value as never },
    ])
    const flat = rollup('SUM', [{ value: 10 }, { value: 20 }, { value: 30 }, { value: 40 }])
    expect(dept.value?.toString()).toBe(flat.value?.toString())
  })

  it('rollup ba cấp cho ra cùng kết quả với rollup một lần — RATIO (nhờ giữ tử/mẫu)', () => {
    const team1 = rollupRatio([
      { numerator: 100, denominator: 5 },
      { numerator: 200, denominator: 10 },
    ])
    const team2 = rollupRatio([{ numerator: 300, denominator: 60 }])
    const dept = rollupRatio([
      { numerator: team1.numerator as never, denominator: team1.denominator as never },
      { numerator: team2.numerator as never, denominator: team2.denominator as never },
    ])
    const flat = rollupRatio([
      { numerator: 100, denominator: 5 },
      { numerator: 200, denominator: 10 },
      { numerator: 300, denominator: 60 },
    ])
    expect(dept.value?.toString()).toBe(flat.value?.toString())
  })
})
