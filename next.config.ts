import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // typedRoutes tắt trong giai đoạn đầu: nó sinh kiểu từ .next/types nên
  // `npm run typecheck` chạy độc lập sẽ báo lỗi cho mọi route chưa được xây.
  // Bật lại khi bộ màn hình đã ổn định.
}

export default nextConfig
