---
name: new-dashboard
description: Quy trình dựng một màn hình dashboard mới trong MPMS (dashboard bộ phận, dashboard campaign, dashboard cá nhân) — bố cục chuẩn, chọn dạng biểu đồ, drill-down qua URL, bộ lọc, phân quyền và hiệu năng. Dùng khi cần thêm màn hình phân tích số liệu mới.
---

# Dựng dashboard mới

## Bước 1 — Xác định người đọc và câu hỏi

Một dashboard tồn tại để trả lời một bộ câu hỏi cụ thể. Viết ra trước:

- Ai mở màn hình này? (vai trò nào)
- Họ cần biết gì trong 5 giây đầu?
- Họ cần đào sâu xuống đâu?
- Hành động nào họ sẽ thực hiện sau khi xem?

Không rõ được 4 điều này → hỏi người dùng, chưa code.

## Bước 2 — Bố cục chuẩn (giữ nhất quán toàn hệ thống)

```
┌────────────────────────────────────────────────────────┐
│ Tiêu đề · Bộ lọc kỳ · % đạt tổng thể                   │
├────────────────────────────────────────────────────────┤
│ Hàng KPI tile: 4–6 chỉ số chính, kèm so sánh kỳ trước  │
├────────────────────────────────────────────────────────┤
│ Biểu đồ xu hướng theo thời gian (line/area)            │
├────────────────────────────────────────────────────────┤
│ So sánh theo nhóm (bar) │ Phân bổ / heatmap            │
├────────────────────────────────────────────────────────┤
│ Bảng chi tiết (drill-down được) │ Ranking │ Cảnh báo   │
└────────────────────────────────────────────────────────┘
```

Tối đa 6 tile ở hàng đầu. Nhiều hơn nghĩa là chưa xác định được cái gì quan trọng.

## Bước 3 — Chọn dạng biểu đồ theo mục đích

| Mục đích | Dạng |
|---|---|
| Xu hướng theo thời gian | Line (nhiều chuỗi) / Area (một chuỗi) |
| So sánh giữa các nhóm | Bar ngang, sắp xếp giảm dần |
| Tỷ trọng đóng góp | Stacked bar (tránh pie khi > 5 nhóm) |
| Tiến độ một chỉ số | Gauge hoặc progress bar kèm số |
| Mật độ theo ngày/giờ | Heatmap |
| Xếp hạng | Bảng có thanh nền, không dùng biểu đồ |

Luôn qua wrapper `src/components/charts/`. Trục có đơn vị. Tooltip hiện: giá trị thực · mục tiêu · % đạt.

## Bước 4 — Bộ lọc và drill-down

- **Toàn bộ ngữ cảnh nằm trên URL**: `?dept=&team=&user=&platform=&campaign=&from=&to=`. Bắt buộc — để link chia sẻ được và back/forward hoạt động.
- Dùng chung component bộ lọc thời gian; giữ nguyên lựa chọn khi chuyển cấp.
- Breadcrumb chỉ rõ vị trí hiện tại, click quay lại từng cấp được.
- Đường drill-down phải khớp đặc tả mục 8: Marketing → Bộ phận → Nền tảng → Campaign → Ad Set → Ad → Nhân viên.

## Bước 5 — Dữ liệu

- Đọc từ bảng summary, **không** aggregate on-the-fly trên `kpi_day`.
- Một endpoint trả đủ dữ liệu cho một màn hình; tránh 10 request nhỏ gây waterfall.
- TanStack Query với `queryKey` chứa **đầy đủ** tham số lọc.
- Bảng > 100 dòng: phân trang phía server.
- Server Component cho phần tĩnh, Client Component chỉ ở phần tương tác.

## Bước 6 — Phân quyền

- Endpoint áp `resolveScope(user)`. Kiểm ở server, không dựa vào việc ẩn menu.
- Test bằng tài khoản `EMPLOYEE` và `LEADER`: có thấy dữ liệu ngoài phạm vi không? Đổi tham số URL sang phòng ban khác có bị chặn không?
- Không đủ quyền → trạng thái no-permission rõ ràng, không phải màn hình trắng hay lỗi 500.

## Bước 7 — Trạng thái và định dạng

- Đủ 5 trạng thái: loading (skeleton đúng hình dạng), empty (kèm gợi ý), error (kèm retry), success, no-permission.
- Đặt chiều cao tối thiểu vùng biểu đồ để không giật layout.
- Định dạng số qua `src/lib/format.ts`. Rút gọn chỉ ở tile; bảng hiện số đầy đủ.
- Metric `LOWER_BETTER` (CPA, chi phí): giảm là tốt — kiểm chiều màu và mũi tên.
- Màu không phải tín hiệu duy nhất, luôn kèm số/nhãn.

## Bước 8 — Xác minh

```bash
npm run typecheck && npm run lint && npm run build
```

Kiểm thủ công: 5 trạng thái; drill-down từng cấp và back; chia sẻ URL mở đúng ngữ cảnh; số liệu khớp nguồn; hoạt động trên tablet.

## Bước 9 — Báo cáo

Màn hình đã dựng, dữ liệu lấy từ đâu, đường drill-down, đã kiểm quyền với vai trò nào, phần chưa kiểm được.
