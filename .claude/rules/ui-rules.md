# Quy tắc giao diện — MPMS

Người dùng chính là Trưởng phòng Marketing và Ban Giám đốc. Họ cần đọc được tình hình trong 5 giây, rồi đào sâu tới từng nhân viên, từng quảng cáo.

## Nguyên tắc

- **Mật độ cao, không trang trí.** Đây là công cụ làm việc hằng ngày, không phải trang marketing. Không hero section, không testimonial, không animation trang trí.
- **Thông tin quan trọng nhất ở trên cùng bên trái.** Người Việt đọc từ trái sang phải, trên xuống dưới.
- **Nhất quán hơn là đẹp.** Màn hình thứ 10 phải trông và hoạt động như màn hình thứ nhất.

## Bố cục dashboard chuẩn

```
┌────────────────────────────────────────────────────────┐
│ Tiêu đề · Bộ lọc kỳ · % đạt tổng thể                   │
├────────────────────────────────────────────────────────┤
│ Hàng KPI tile: 4–6 chỉ số chính, kèm so sánh kỳ trước  │
├────────────────────────────────────────────────────────┤
│ Biểu đồ xu hướng theo thời gian                        │
├────────────────────────────────────────────────────────┤
│ So sánh theo nhóm │ Phân bổ / heatmap                  │
├────────────────────────────────────────────────────────┤
│ Bảng chi tiết (drill-down) │ Ranking │ Cảnh báo        │
└────────────────────────────────────────────────────────┘
```

Tối đa 6 tile ở hàng đầu. Nhiều hơn nghĩa là chưa xác định được cái gì quan trọng.

## Năm trạng thái bắt buộc

Mọi màn hình có dữ liệu phải xử lý đủ:

1. **Loading** — skeleton đúng hình dạng nội dung sắp hiện, không phải spinner giữa màn hình
2. **Empty** — kèm câu giải thích và hành động gợi ý (`Chưa có báo cáo nào trong kỳ này. Tạo báo cáo →`)
3. **Error** — nêu điều gì hỏng + nút thử lại. Không hiện stack trace.
4. **Success** — dữ liệu thật
5. **No-permission** — thông báo rõ ràng, không phải màn hình trắng hay 500

Đặt `min-height` cho vùng biểu đồ và tile để không giật layout khi dữ liệu về.

## Màu và trạng thái KPI

Thang trạng thái theo % đạt, dùng thống nhất toàn hệ thống:

| Mức | Ý nghĩa | Kèm theo |
|---|---|---|
| `>= 100%` | Đạt / vượt | Nhãn "Đạt" |
| `80–99%` | Cần chú ý | Nhãn "Gần đạt" |
| `< 80%` | Không đạt | Nhãn "Không đạt" |

**Màu không bao giờ là tín hiệu duy nhất.** Luôn kèm số và nhãn chữ — cho người mù màu và cho ảnh chụp đen trắng.

Metric `LOWER_BETTER` (CPA, CPC, chi phí, lỗi, trễ deadline): chiều màu và mũi tên **ngược lại**. CPA giảm 12% là tin tốt → xanh, mũi tên xuống. Đây là chỗ dễ hiển thị sai nhất, kiểm kỹ mỗi lần.

## Định dạng số

Tập trung tại `src/lib/format.ts`. Không tự viết lại ở component.

- Tiền: VND, phân cách nghìn bằng dấu chấm (`1.250.000 ₫`)
- Phần trăm: 1 chữ số thập phân (`84,3%`)
- Số lượng: phân cách nghìn (`72.000`)
- Rút gọn (`72K`, `1,2 tỷ`): **chỉ dùng ở KPI tile**. Bảng dữ liệu luôn hiện số đầy đủ để người dùng đối chiếu.
- Giá trị `null` (mẫu số = 0, chưa có dữ liệu): hiện `—`, **không hiện `0`**.
- Ngày: `dd/MM/yyyy`. Kỳ: `Tháng 7/2026`, `Quý 3/2026`, `Tuần 30/2026`.

## Biểu đồ

Luôn qua wrapper trong `src/components/charts/`. Không import Recharts trực tiếp trong màn hình.

| Mục đích | Dạng |
|---|---|
| Xu hướng theo thời gian | Line (nhiều chuỗi) / Area (một chuỗi) |
| So sánh giữa các nhóm | Bar ngang, sắp xếp giảm dần |
| Tỷ trọng đóng góp | Stacked bar (tránh pie khi > 5 nhóm) |
| Tiến độ một chỉ số | Gauge hoặc progress bar kèm số |
| Mật độ theo ngày | Heatmap |
| Xếp hạng | Bảng có thanh nền, không dùng biểu đồ |

- Trục luôn có đơn vị.
- Tooltip hiện đủ: giá trị thực · mục tiêu · % đạt.
- Đường mục tiêu vẽ dạng nét đứt để phân biệt với đường thực tế.
- Bảng màu thống nhất một hệ, dùng được ở cả light và dark mode.

## Bảng dữ liệu

- Cột số căn phải, cột chữ căn trái, cột trạng thái căn giữa.
- Hàng tiêu đề dính (sticky) khi cuộn.
- Bảng > 100 dòng: **phân trang phía server**, không tải hết rồi cắt ở client.
- Bảng rộng: cuộn ngang trong container riêng, thân trang không được cuộn ngang.
- Sắp xếp mặc định theo cột có ý nghĩa nhất (thường là % đạt tăng dần — để cái tệ nhất lên đầu).

## Drill-down và bộ lọc

- **Toàn bộ ngữ cảnh nằm trên URL**: `?dept=&team=&user=&platform=&campaign=&from=&to=`. Bắt buộc — để link chia sẻ được, back/forward hoạt động đúng, và F5 không mất trạng thái.
- Breadcrumb chỉ rõ vị trí hiện tại, click quay lại từng cấp.
- Bộ lọc thời gian dùng chung một component, giữ nguyên lựa chọn khi chuyển cấp.
- Dòng/cột click được phải có `cursor: pointer` và trạng thái hover rõ ràng.

## Khả năng tiếp cận

- Cấu trúc semantic: `<table>` cho bảng, `<button>` cho nút, `<nav>` cho menu.
- Điều hướng bàn phím dùng được, trạng thái focus nhìn thấy rõ.
- Tương phản đủ theo WCAG AA.
- Biểu đồ có bảng số liệu tương đương hoặc `aria-label` mô tả.

## Responsive

- Desktop là ưu tiên số một — người dùng làm việc trên màn hình lớn.
- Tablet phải dùng được: tile xuống 2 cột, bảng cuộn ngang.
- Mobile: chỉ cần đọc được KPI tổng quan và thông báo, không cần dựng lại toàn bộ dashboard.

## Component

- Dùng primitive shadcn/ui sẵn có. Không sửa file trong `components/ui/` trừ khi thật cần và nêu lý do.
- Component nghiệp vụ đặt trong `components/kpi/`, `components/charts/`, `components/layout/`.
- Server Component cho nội dung tĩnh. Client Component (`'use client'`) chỉ ở phần thực sự tương tác.
- Không tạo abstraction cho thứ dùng một lần.
