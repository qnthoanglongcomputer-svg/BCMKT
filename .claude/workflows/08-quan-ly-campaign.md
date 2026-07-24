# 08 — Quản lý Campaign

**Phụ thuộc**: [02 — Tổ chức](02-quan-ly-to-chuc.md), [06 — Workflow báo cáo](06-workflow-bao-cao.md)

## Mục tiêu

"Toàn bộ dữ liệu phải gắn với Campaign" (mục 9 đặc tả). Hệ thống trả lời được: campaign nào hiệu quả nhất, bộ phận nào đóng góp nhiều nhất, ROI và chi phí từng campaign.

## Ví dụ đích đến

```
Back To School
├── Facebook Ads    → chi phí 120tr · lead 3.200 · CPA 37.500₫
├── Content         → 45 bài · reach 890K
├── Trade           → 28 điểm POSM · 12 CTKM
├── Designer        → 62 banner
├── Editor          → 18 video
└── Kết quả         → doanh thu 1,8 tỷ · ROI 15x
```

## Vai trò

- `ADMIN` / `MARKETING_MANAGER`: tạo, sửa, kết thúc campaign; đặt ngân sách
- `LEADER`: xem campaign, gắn báo cáo của team vào campaign
- `EMPLOYEE`: chọn campaign khi nhập báo cáo

## Dữ liệu

Đã có `campaigns` (code, name, start_date, end_date, budget, is_active). Liên kết: `reports.campaign_id`, `kpi_actuals.campaign_id`, `ads_insights.campaign_id`.

## Màn hình

### `/campaigns` — Danh sách
Bảng: tên · mã · thời gian · ngân sách · đã chi · % ngân sách · doanh thu · ROI · trạng thái.
Sắp xếp mặc định theo ROI giảm dần. Highlight đỏ campaign vượt ngân sách.

### `/campaigns/[id]` — Chi tiết
1. **Tổng quan** — thời gian, ngân sách vs đã chi (progress bar), doanh thu, ROI, ROAS
2. **Đóng góp theo bộ phận** — stacked bar: mỗi bộ phận đóng góp gì (chi phí, output, kết quả)
3. **Xu hướng** — line: chi phí và doanh thu theo ngày
4. **Chi tiết theo nền tảng** — bảng ads: FB/Google/TikTok, chi phí, lead, CPA, ROAS
5. **Báo cáo liên quan** — danh sách báo cáo gắn campaign này

### `/campaigns/compare` — So sánh
Chọn 2–5 campaign, so sánh cạnh nhau: chi phí, doanh thu, ROI, CPA, số lượng output.

## Quy tắc nghiệp vụ

- `code` duy nhất, không đổi sau khi tạo.
- `end_date >= start_date`, validate ở cả UI và server.
- **ROI** = `(doanh thu − chi phí) / chi phí`. Chi phí = 0 → ROI `null`, hiện `—`.
- **ROAS** = `doanh thu / chi phí`. Cũng `null` khi chi phí = 0.
- Chi phí campaign gồm: chi phí ads (từ `ads_insights`) + chi phí nhập tay trong báo cáo. Nêu rõ nguồn trên UI để tránh nghi ngờ số liệu.
- Campaign đã kết thúc (`end_date` đã qua) → không cho gắn báo cáo mới, nhưng dữ liệu cũ giữ nguyên.
- Vượt ngân sách → sinh `alert` (xem [14 — Cảnh báo](14-canh-bao.md)).

## Edge case

- Campaign chồng thời gian nhau → hợp lệ, nhiều campaign chạy song song là bình thường
- Báo cáo không gắn campaign → hợp lệ, gom vào nhóm "Không thuộc campaign"
- Campaign chưa có dữ liệu → hiện empty state, không hiện ROI = 0 (gây hiểu nhầm)
- Ngân sách `null` (chưa đặt) → không cảnh báo vượt ngân sách, hiện `—`
- Xoá campaign còn dữ liệu → **chặn**, chỉ cho vô hiệu hoá. `onDelete: SetNull` trên `reports.campaign_id` là để an toàn, không phải để dùng.

## Test bắt buộc

- ROI/ROAS trả `null` khi chi phí = 0, không chia cho 0
- Chi phí campaign gộp đúng cả nguồn ads và nguồn nhập tay, không đếm trùng
- `end_date < start_date` bị chặn
- Chặn xoá campaign còn dữ liệu

## Tiêu chí hoàn thành

- [ ] Tạo/sửa campaign qua UI, gắn được vào báo cáo và dữ liệu ads
- [ ] Trang chi tiết hiện đủ 5 khối, đóng góp theo bộ phận đúng
- [ ] ROI/ROAS tính đúng, xử lý chia 0
- [ ] So sánh nhiều campaign hoạt động
- [ ] Cảnh báo vượt ngân sách hoạt động
- [ ] Nêu rõ nguồn chi phí trên UI
- [ ] Audit log cho tạo/sửa/đổi ngân sách
