# 10 — Dashboard theo bộ phận

**Phụ thuộc**: [03 — Dashboard tổng quan](03-dashboard-tong-quan.md), [09 — Tích hợp Ads](09-tich-hop-ads.md) · **Quy trình**: skill [new-dashboard](../skills/new-dashboard/SKILL.md)

## Mục tiêu

Mỗi bộ phận có dashboard riêng với bộ chỉ số đặc thù (mục 7 đặc tả). Bố cục và tương tác **giống nhau**; chỉ khác tập metric.

## Nguyên tắc quan trọng

Dashboard tra theo `department.code`, **không hardcode tên tiếng Việt** trong code. Danh sách code tập trung tại một constant duy nhất `src/lib/departments.ts`:

```ts
export const DEPARTMENT_CODES = {
  PERFORMANCE: 'PERFORMANCE',
  CONTENT_SOCIAL: 'CONTENT_SOCIAL',
  TRADE: 'TRADE',
  BRANDING: 'BRANDING',
} as const
```

Bộ phận mới thêm qua UI mà chưa có dashboard chuyên biệt → dùng **dashboard mặc định** (KPI tile + xu hướng + bảng nhân sự), không lỗi 404.

## Bộ chỉ số theo bộ phận

### `/performance` — Performance / Digital
Nguồn: Facebook Ads · Google Ads · TikTok Ads

| Nhóm | Chỉ số |
|---|---|
| Chi phí & kết quả | Chi phí · Doanh thu · Lead · Đơn hàng |
| Hiệu quả | ROS · CPA · CPC · CTR · AOV · ROAS |

So sánh: KPI · kỳ trước · hôm qua · tháng trước · cùng kỳ năm trước.
Bảng chi tiết theo nền tảng → campaign → ad set → ad (drill-down).

### `/content-social` — Content & Social
Bài Fanpage · Website · Engagement · SEO · Reach · Organic Reach · Fanpage từng chi nhánh.
Bảng: từng fanpage/chi nhánh, sắp xếp theo reach giảm dần.

### `/content-creator` — Content Creator (TikTok)
Video · View · Follower · Saves · Share · Leads · Tỷ lệ Tim/View.
Biểu đồ: xu hướng follower theo ngày, top video theo view.

### `/designer` — Designer
Deadline (đúng hạn / trễ) · Feedback · Lỗi thiết kế · Thời gian thiết kế · Thiết kế phát sinh.
**Lưu ý**: Lỗi thiết kế và trễ deadline là `LOWER_BETTER` — chiều màu ngược lại.

### `/editor` — Editor
Video Ads · Video TikTok · Video Review · Cấu hình chụp.

### `/trade` — Trade Marketing
CTKM · Audit · POSM · Doanh thu CTKM · Khách mới · Đối thủ.

### `/branding` — Branding
Dùng dashboard mặc định cho tới khi người dùng chốt bộ chỉ số riêng.

## Bố cục dùng chung

```
Tiêu đề bộ phận · Bộ lọc kỳ · % đạt · Điểm KPI · Xếp loại
─────────────────────────────────────────────────────────
4–6 KPI tile chính (kèm so kỳ trước)
─────────────────────────────────────────────────────────
Biểu đồ xu hướng (thực tế vs mục tiêu)
─────────────────────────────────────────────────────────
So sánh nhân viên trong bộ phận (bar ngang)
─────────────────────────────────────────────────────────
Bảng chi tiết (drill-down) · Ranking · Cảnh báo của bộ phận
```

## Dữ liệu

Đọc từ `kpi_summary` và `kpi_actuals` cấp `DEPARTMENT`, **không** aggregate on-the-fly trên dữ liệu ngày.

Metric tỷ lệ đọc `numerator_sum` / `denominator_sum` rồi để engine tính — không đọc giá trị tỷ lệ đã lưu sẵn.

## Edge case

- Bộ phận chưa có KPI plan → empty state hướng dẫn thiết lập, không hiện 0%
- Bộ phận không có nhân viên → khối so sánh nhân viên ẩn đi
- `LEADER` của bộ phận khác truy cập → 404 (không phải 403, để không tiết lộ bộ phận tồn tại)
- Metric có mẫu số = 0 (chưa có lead nên chưa có CPA) → hiện `—`, không hiện `0`
- Bộ phận mới tạo chưa có dashboard chuyên biệt → dashboard mặc định

## Test bắt buộc

- `LEADER` bộ phận A không vào được dashboard bộ phận B
- Metric `LOWER_BETTER` hiển thị đúng chiều màu và mũi tên
- Metric RATIO tính lại từ tử/mẫu, không lấy giá trị trung bình

## Tiêu chí hoàn thành

- [ ] 6 dashboard bộ phận + 1 dashboard mặc định
- [ ] Bố cục và tương tác nhất quán giữa các bộ phận
- [ ] Tra theo `code`, không hardcode tên tiếng Việt
- [ ] Bộ phận mới không có dashboard riêng vẫn hoạt động
- [ ] Đủ 5 trạng thái UI trên mọi dashboard
- [ ] Metric nghịch hiển thị đúng chiều
- [ ] Áp scope đúng, đã thử với `LEADER` và `EMPLOYEE`
