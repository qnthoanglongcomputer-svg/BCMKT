import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MPMS — Quản trị hiệu suất Marketing',
  description: 'Hệ thống quản trị KPI và báo cáo phòng Marketing',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  )
}
