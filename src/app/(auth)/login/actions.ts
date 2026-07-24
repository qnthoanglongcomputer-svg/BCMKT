'use server'

import { AuthError } from 'next-auth'
import { headers } from 'next/headers'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { signIn } from '@/server/auth/config'
import { logAudit } from '@/server/audit/log'

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Chưa nhập email').email('Email không đúng định dạng'),
  password: z.string().min(1, 'Chưa nhập mật khẩu'),
})

export interface LoginResult {
  ok: boolean
  error?: string
}

export async function loginAction(formData: FormData): Promise<LoginResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }
  }

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      // Thông báo chung chung cho mọi lý do thất bại: sai mật khẩu, email không
      // tồn tại, tài khoản bị khoá. Không tiết lộ email nào đang có trong hệ thống.
      return { ok: false, error: 'Email hoặc mật khẩu không đúng' }
    }
    throw error
  }

  await recordLogin(parsed.data.email)
  return { ok: true }
}

/** Ghi audit đăng nhập thành công. Lỗi ở đây không được chặn việc đăng nhập. */
async function recordLogin(email: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true },
    })
    if (!user) return

    const headerList = await headers()
    await prisma.$transaction(async (tx) => {
      await logAudit(tx, {
        actorId: user.id,
        action: 'LOGIN',
        entityType: 'user',
        entityId: user.id,
        ipAddress: headerList.get('x-forwarded-for') ?? null,
        userAgent: headerList.get('user-agent') ?? null,
      })
    })
  } catch (error) {
    console.error('Không ghi được audit đăng nhập:', error)
  }
}
