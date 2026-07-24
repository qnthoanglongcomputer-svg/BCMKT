import bcrypt from 'bcryptjs'

/**
 * Băm và kiểm mật khẩu. Không tự viết crypto — dùng bcrypt đã được kiểm chứng.
 * Mật khẩu **không bao giờ** được lưu, log, hay trả về dạng gốc.
 */

const SALT_ROUNDS = 12

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

/**
 * Yêu cầu tối thiểu cho mật khẩu. Trả về null khi hợp lệ, thông báo tiếng Việt
 * khi không.
 */
export function validatePasswordStrength(plain: string): string | null {
  if (plain.length < 8) return 'Mật khẩu phải có ít nhất 8 ký tự'
  if (!/[a-zA-Z]/.test(plain)) return 'Mật khẩu phải có ít nhất một chữ cái'
  if (!/\d/.test(plain)) return 'Mật khẩu phải có ít nhất một chữ số'
  return null
}
