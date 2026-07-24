/**
 * Tạo hoặc đặt lại mật khẩu cho một tài khoản.
 *
 * Chạy:
 *   npm run db:create-user -- --email admin@congty.vn --name "Nguyễn Văn A" --role ADMIN
 *
 * Mật khẩu đọc từ biến môi trường `MPMS_USER_PASSWORD`, **không truyền qua tham số
 * dòng lệnh** — tham số dòng lệnh lưu lại trong lịch sử shell và hiện trong danh
 * sách tiến trình.
 *
 *   PowerShell:  $env:MPMS_USER_PASSWORD = "..."; npm run db:create-user -- ...
 *   Bash:        MPMS_USER_PASSWORD="..." npm run db:create-user -- ...
 *
 * Script này không in mật khẩu ra màn hình và không ghi vào log.
 */
import { PrismaClient, type Role } from '@prisma/client'
import { hashPassword, validatePasswordStrength } from '../src/server/auth/password'

const prisma = new PrismaClient()

const VALID_ROLES: Role[] = ['ADMIN', 'MARKETING_MANAGER', 'LEADER', 'EMPLOYEE']

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  if (index === -1) return undefined
  return process.argv[index + 1]
}

async function main() {
  const email = arg('email')?.toLowerCase().trim()
  const name = arg('name')
  const role = (arg('role') ?? 'ADMIN') as Role
  const departmentCode = arg('department')
  const positionCode = arg('position')
  const password = process.env.MPMS_USER_PASSWORD

  if (!email || !name) {
    console.error('Thiếu tham số. Ví dụ:')
    console.error('  npm run db:create-user -- --email admin@congty.vn --name "Quản trị viên" --role ADMIN')
    process.exitCode = 1
    return
  }

  if (!VALID_ROLES.includes(role)) {
    console.error(`Vai trò không hợp lệ: ${role}. Chọn một trong: ${VALID_ROLES.join(', ')}`)
    process.exitCode = 1
    return
  }

  if (!password) {
    console.error('Chưa đặt biến môi trường MPMS_USER_PASSWORD.')
    console.error('  PowerShell: $env:MPMS_USER_PASSWORD = "MatKhau123"')
    console.error('  Bash:       export MPMS_USER_PASSWORD="MatKhau123"')
    process.exitCode = 1
    return
  }

  const weak = validatePasswordStrength(password)
  if (weak) {
    console.error(`Mật khẩu chưa đạt: ${weak}`)
    process.exitCode = 1
    return
  }

  let departmentId: string | null = null
  if (departmentCode) {
    const department = await prisma.department.findUnique({ where: { code: departmentCode } })
    if (!department) {
      console.error(`Không tìm thấy phòng ban có mã ${departmentCode}`)
      process.exitCode = 1
      return
    }
    departmentId = department.id
  }

  let positionId: string | null = null
  if (positionCode) {
    const position = await prisma.position.findUnique({ where: { code: positionCode } })
    if (!position) {
      console.error(`Không tìm thấy vị trí có mã ${positionCode}`)
      process.exitCode = 1
      return
    }
    positionId = position.id
  }

  const passwordHash = await hashPassword(password)

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, fullName: name, role, departmentId, positionId, isActive: true, deletedAt: null },
    create: { email, passwordHash, fullName: name, role, departmentId, positionId },
    select: { id: true, email: true, fullName: true, role: true },
  })

  console.log('Đã tạo/cập nhật tài khoản:')
  console.log(`  Email:    ${user.email}`)
  console.log(`  Họ tên:   ${user.fullName}`)
  console.log(`  Vai trò:  ${user.role}`)
  console.log(`  Phòng ban: ${departmentCode ?? '(chưa gán)'}`)
  console.log('\nMật khẩu đã được băm và lưu. Script không in mật khẩu.')
}

main()
  .catch((error) => {
    console.error('Tạo tài khoản thất bại:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
