import NextAuth, { type DefaultSession } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from './password'
import type { Role } from './scope'

/**
 * Xác thực bằng email + mật khẩu.
 *
 * Dùng JWT session: vai trò và phòng ban nằm trong token nên không phải truy vấn
 * DB mỗi request. Đánh đổi: đổi vai trò của người đang đăng nhập chỉ có hiệu lực
 * ở lần làm mới token kế tiếp (tối đa `updateAge`), hoặc khi họ đăng nhập lại.
 */

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: Role
      departmentId: string | null
      fullName: string
    } & DefaultSession['user']
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 giờ — hết ca làm việc thì phải đăng nhập lại
    updateAge: 15 * 60, // làm mới token mỗi 15 phút để bắt kịp thay đổi vai trò
  },
  pages: {
    signIn: '/login',
  },
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mật khẩu', type: 'password' },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw)
        if (!parsed.success) return null

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase().trim() },
          select: {
            id: true,
            email: true,
            fullName: true,
            passwordHash: true,
            role: true,
            departmentId: true,
            isActive: true,
            deletedAt: true,
          },
        })

        // Cùng một kết quả cho mọi lý do thất bại: không tiết lộ email có tồn tại
        // hay không, cũng không tiết lộ tài khoản bị khoá.
        if (!user || !user.isActive || user.deletedAt) {
          // Vẫn chạy bcrypt trên hash giả để thời gian phản hồi không lộ thông tin.
          await verifyPassword(parsed.data.password, DUMMY_HASH)
          return null
        }

        const valid = await verifyPassword(parsed.data.password, user.passwordHash)
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          role: user.role,
          departmentId: user.departmentId,
          fullName: user.fullName,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.uid = user.id
        token.role = (user as { role: Role }).role
        token.departmentId = (user as { departmentId: string | null }).departmentId
        token.fullName = (user as { fullName: string }).fullName
        return token
      }

      // Làm mới định kỳ: bắt kịp việc admin đổi vai trò hoặc vô hiệu hoá tài khoản.
      if (trigger === 'update' && typeof token.uid === 'string') {
        const fresh = await prisma.user.findUnique({
          where: { id: token.uid },
          select: { role: true, departmentId: true, fullName: true, isActive: true, deletedAt: true },
        })
        if (!fresh || !fresh.isActive || fresh.deletedAt) return null
        token.role = fresh.role
        token.departmentId = fresh.departmentId
        token.fullName = fresh.fullName
      }

      return token
    },
    async session({ session, token }) {
      if (typeof token.uid === 'string') {
        session.user.id = token.uid
        session.user.role = token.role as Role
        session.user.departmentId = (token.departmentId as string | null) ?? null
        session.user.fullName = (token.fullName as string) ?? ''
      }
      return session
    },
  },
})

/**
 * Hash của một mật khẩu không tồn tại. Dùng để bcrypt vẫn chạy khi email sai,
 * giữ thời gian phản hồi tương đương — chống dò email qua thời gian phản hồi.
 */
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.aQFHkGGKkGGKkGGKkGGKkGGKkGGKkGG'
