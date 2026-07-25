import { z } from 'zod'

const code = z
  .string()
  .trim()
  .min(2, 'Mã phải có ít nhất 2 ký tự')
  .max(40, 'Mã không quá 40 ký tự')
  .regex(/^[A-Z][A-Z0-9_]*$/, 'Mã chỉ gồm chữ in hoa, số và dấu gạch dưới, bắt đầu bằng chữ')

const name = z.string().trim().min(1, 'Chưa nhập tên').max(120, 'Tên không quá 120 ký tự')

export const saveDepartmentSchema = z.object({
  id: z.string().optional(),
  /// Mã không đổi được sau khi tạo — dashboard chuyên biệt tra theo mã này.
  code,
  name,
  parentId: z.string().nullable(),
  sortOrder: z.number().int().min(0).max(999).default(0),
})

export const savePositionSchema = z.object({
  id: z.string().optional(),
  code,
  name,
  departmentId: z.string().min(1, 'Chưa chọn phòng ban'),
})

export const saveUserSchema = z.object({
  id: z.string().optional(),
  email: z.string().trim().toLowerCase().email('Email không đúng định dạng'),
  fullName: name,
  role: z.enum(['ADMIN', 'MARKETING_MANAGER', 'LEADER', 'EMPLOYEE']),
  departmentId: z.string().nullable(),
  positionId: z.string().nullable(),
  isActive: z.boolean().default(true),
  /// Chỉ có khi tạo mới hoặc đặt lại mật khẩu. Không bao giờ trả về client.
  password: z.string().optional(),
})

export const resetPasswordSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(1, 'Chưa nhập mật khẩu mới'),
})

export const deactivateSchema = z.object({
  id: z.string().min(1),
})

export type SaveDepartmentInput = z.infer<typeof saveDepartmentSchema>
export type SavePositionInput = z.infer<typeof savePositionSchema>
export type SaveUserInput = z.infer<typeof saveUserSchema>
