# 03 — Dashboard tổng quan

**Phụ thuộc**: [01 — Auth](01-auth-phan-quyen.md), [02 — Tổ chức](02-quan-ly-to-chuc.md)

## Mục tiêu

Màn hình đầu tiên sau khi đăng nhập. Trả lời trong 5 giây: **phòng Marketing đang đạt bao nhiêu % KPI, bộ phận nào kéo xuống, có gì cần xử lý ngay**.

## Vai trò

Mọi vai trò đều vào được, nhưng **phạm vi dữ liệu khác nhau** theo `resolveScope`:
- `ADMIN` / `MARKETING_MANAGER`: toàn phòng Marketing
- `LEADER`: subtree của mình, tiêu đề nêu rõ đang xem bộ phận nào
- `EMPLOYEE`: KPI cá nhân, không thấy so sánh giữa các bộ phận

## Bố cục

```
┌──────────────────────────────────────────────────────────────────┐
│ Marketing KPI          [Bộ lọc kỳ ▾]        Đạt: 84%  ·  Hạng B  │
├──────────────────────────────────────────────────────────────────┤
│ Doanh thu │ Lead │ CPA │ ROAS │ Chi phí │ Campaign đang chạy      │
│  (6 KPI tile, mỗi tile: giá trị · mục tiêu · % đạt · so kỳ trước)│
├──────────────────────────────────────────────────────────────────┤
│ Biểu đồ KPI theo thời gian (line: thực tế vs mục tiêu)           │
├──────────────────────────────────────────────────────────────────┤
│ Hiệu suất bộ phận (bar ngang, sắp giảm dần)                      │
│   Performance 91% ████████░  Content 82% ███████░                │
│   Trade 71% ██████░          Branding 65% █████░                 │
├──────────────────────────────────────────────────────────────────┤
│ Top nhân viên │ Top Campaign │ Cảnh báo │ Forecast cuối kỳ        │
├──────────────────────────────────────────────────────────────────┤
│ Chờ duyệt │ KPI sắp đến hạn │ Thông báo hệ thống                 │
└──────────────────────────────────────────────────────────────────┘
```

## Dữ liệu

Đọc từ **bảng summary**, không aggregate on-the-fly:
- `kpi_summary` — điểm, hạng, forecast theo `(owner_type, owner_id, period)`
- `kpi_targets` + `kpi_actuals` — cho KPI tile và biểu đồ xu hướng
- `alerts` — khối cảnh báo
- `reports` trạng thái `SUBMITTED` — khối chờ duyệt

Một endpoint trả đủ dữ liệu cho cả màn hình. Không 10 request nhỏ gây waterfall.

## Bộ lọc kỳ

Mặc định: **tháng hiện tại**. Lựa chọn: Hôm nay · Tuần này · Tháng này · Quý này · Năm nay · Tuỳ chọn.

Lưu trên URL: `?period=month&from=2026-07-01&to=2026-07-31`

## Quy tắc hiển thị

- KPI tile: giá trị lớn ở giữa, mục tiêu và % đạt nhỏ bên dưới, mũi tên so kỳ trước.
- Metric `LOWER_BETTER` (CPA, Chi phí): **chiều màu và mũi tên ngược lại**. CPA giảm 12% → xanh, mũi tên xuống.
- Giá trị `null` (chưa có dữ liệu, mẫu số 0) → hiện `—`, không hiện `0`.
- Màu trạng thái luôn kèm số và nhãn chữ.
- Biểu đồ xu hướng: đường mục tiêu vẽ nét đứt để phân biệt với đường thực tế.

## Edge case

- **Chưa có dữ liệu gì** (hệ thống mới) → empty state hướng dẫn: "Chưa có KPI cho kỳ này. Thiết lập KPI năm →"
- Có mục tiêu nhưng chưa có thực tế → tile hiện `0 / 6.000` và `0%`, không crash
- Chưa đủ 3 ngày dữ liệu → khối Forecast hiện "Chưa đủ dữ liệu để dự báo", không đoán bừa
- `EMPLOYEE` đăng nhập → ẩn khối so sánh bộ phận và Top nhân viên
- Kỳ tương lai (tháng sau) → hiện mục tiêu, thực tế bằng 0, không forecast

## Hiệu năng

- Dữ liệu từ bảng summary, mục tiêu < 1 giây với dữ liệu một năm đầy đủ
- Server Component cho khối tĩnh, Client Component cho bộ lọc và biểu đồ tương tác
- `queryKey` chứa đầy đủ tham số kỳ + scope

## Test bắt buộc

- Áp scope: `EMPLOYEE` không thấy dữ liệu bộ phận khác
- Đổi `dept` trên URL ngoài scope → bị chặn ở server
- Metric `LOWER_BETTER` hiển thị đúng chiều

## Tiêu chí hoàn thành

- [ ] 6 KPI tile hiển thị đúng số từ DB
- [ ] Biểu đồ xu hướng có cả đường thực tế và mục tiêu
- [ ] Bar so sánh bộ phận sắp xếp giảm dần
- [ ] Bộ lọc kỳ lưu trên URL, F5 giữ nguyên trạng thái
- [ ] Đủ 5 trạng thái UI, đặc biệt **empty state khi chưa có dữ liệu**
- [ ] Metric nghịch (CPA, Chi phí) hiển thị đúng chiều màu/mũi tên
- [ ] Thử với `EMPLOYEE` và `LEADER`: không rò rỉ dữ liệu
- [ ] Dùng được trên tablet
