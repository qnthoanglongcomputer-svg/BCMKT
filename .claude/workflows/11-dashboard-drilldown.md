# 11 — Drill-down nhiều cấp

**Phụ thuộc**: [10 — Dashboard bộ phận](10-dashboard-bo-phan.md)

## Mục tiêu

Từ con số tổng ở dashboard, đào sâu tới tận nguyên nhân gốc (mục 8 đặc tả) mà **không mất ngữ cảnh**.

## Hai đường drill-down chính

```
Marketing → Performance → Facebook → Campaign → Ad Set → Ad → Nhân viên
Marketing → Content     → Nhân viên → Bài viết
```

Ngoài ra: Campaign → Bộ phận đóng góp → Nhân viên.

## Nguyên tắc bắt buộc

**Toàn bộ ngữ cảnh nằm trên URL**:

```
/performance?dept=PERFORMANCE&platform=FACEBOOK&campaign=abc&adset=def&from=2026-07-01&to=2026-07-31
```

Lý do: link chia sẻ được cho sếp, nút back/forward hoạt động đúng, F5 không mất trạng thái. Đây là yêu cầu cứng, không phải tuỳ chọn.

## Cần xây

### `src/lib/drilldown.ts` — quản lý ngữ cảnh

```ts
interface DrilldownContext {
  dept?: string
  team?: string
  user?: string
  platform?: string
  campaign?: string
  adset?: string
  ad?: string
  from: string   // yyyy-MM-dd
  to: string
}

parseContext(searchParams): DrilldownContext
buildUrl(base, context, override): string    // giữ tham số cũ, ghi đè cái mới
buildBreadcrumb(context): BreadcrumbItem[]
```

Đi xuống một cấp = thêm tham số, **giữ nguyên các tham số đã có**. Không reset bộ lọc thời gian khi chuyển cấp.

### Component `<Breadcrumb />`
Hiện đường đi hiện tại, mỗi cấp click quay lại được:
`Marketing › Performance › Facebook › Back To School › Ad Set A`

### Bảng drill-down
- Dòng click được → `cursor: pointer`, hover rõ ràng
- Cột cuối có icon mũi tên chỉ rõ "còn đào sâu được"
- Cấp cuối (Ad, Bài viết) không click được nữa — không để người dùng click vào chỗ trống

## Quy tắc bảo mật — quan trọng nhất

Người dùng sửa `?dept=` trên thanh địa chỉ là chuyện đương nhiên sẽ xảy ra.

- **Mọi tham số từ URL phải kiểm lại với `resolveScope` ở server.**
- Ngoài phạm vi → trả `404`, không phải `403`. Trả `403` là tiết lộ rằng bộ phận đó tồn tại.
- Không dựa vào việc "họ không thấy nút" để bảo vệ dữ liệu.

## Hiệu năng

- Mỗi cấp là một truy vấn riêng, chỉ tải dữ liệu của cấp đang xem.
- Không tải sẵn toàn bộ cây rồi lọc ở client.
- Bảng > 100 dòng: phân trang phía server.
- `queryKey` của TanStack Query phải chứa **đầy đủ** ngữ cảnh — thiếu một tham số là hiện nhầm dữ liệu.

## Edge case

- Tham số không tồn tại (campaign đã xoá) → thông báo "Không tìm thấy", đề xuất quay lại cấp trên
- Tham số mâu thuẫn (`adset` không thuộc `campaign` đã chọn) → bỏ qua tham số con, quay về cấp hợp lệ gần nhất
- Cấp không có dữ liệu con → empty state, không phải bảng trống
- Khoảng thời gian không có dữ liệu ở cấp sâu → hiện rõ "Không có dữ liệu trong kỳ này", giữ nguyên breadcrumb
- Người dùng đào quá sâu rồi bấm back nhiều lần → phải về đúng từng cấp, không nhảy về đầu

## Test bắt buộc

- Đổi `dept` sang phòng ban ngoài scope → nhận `404`
- Tham số con không thuộc tham số cha → xử lý an toàn, không crash
- URL đầy đủ ngữ cảnh mở ra đúng màn hình đúng bộ lọc
- Back/forward đi đúng lịch sử

## Tiêu chí hoàn thành

- [ ] Đủ hai đường drill-down chính trong đặc tả
- [ ] Ngữ cảnh nằm hoàn toàn trên URL, F5 không mất
- [ ] Copy URL gửi người khác mở ra đúng màn hình
- [ ] Back/forward hoạt động đúng từng cấp
- [ ] Breadcrumb click quay lại được mọi cấp
- [ ] Sửa tham số URL ngoài scope bị chặn ở **server**, trả 404
- [ ] Bộ lọc thời gian giữ nguyên khi chuyển cấp
