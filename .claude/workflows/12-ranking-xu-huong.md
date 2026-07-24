# 12 — Ranking & theo dõi xu hướng

**Phụ thuộc**: [05 — Trọng số & chấm điểm](05-kpi-trong-so-cham-diem.md), [10 — Dashboard bộ phận](10-dashboard-bo-phan.md)

## Mục tiêu

Trả lời "ai/cái gì đang tốt nhất và tệ nhất" (mục 16) và "đang cải thiện hay suy giảm" (mục 17).

## Phần A — Ranking

### Bốn bảng xếp hạng

| Bảng | Xếp theo | Phạm vi |
|---|---|---|
| Top nhân viên | Điểm KPI | Trong scope người xem |
| Top Team | Điểm KPI trung bình có trọng số | Trong scope |
| Top Bộ phận | Điểm KPI | Toàn Marketing (chỉ Manager/Admin) |
| Top Campaign | ROI | Trong scope |

Kỳ: Tuần · Tháng · Quý · Năm.

### Quy tắc hiển thị

- Dùng **bảng có thanh nền**, không dùng biểu đồ — xếp hạng đọc bằng bảng nhanh hơn.
- Cột: hạng · tên · điểm · xếp loại · thay đổi hạng so kỳ trước (↑3 ↓2 —).
- **Hiển thị cả top và bottom.** Chỉ khoe người giỏi thì không giúp quản lý ra quyết định. Mặc định: 5 trên cùng + 5 dưới cùng.
- Xếp loại kèm nhãn chữ, không chỉ màu.

### Quy tắc nghiệp vụ

- Người/team **chưa có nhóm trọng số** hoặc chưa có dữ liệu → không xếp hạng, liệt kê riêng ở mục "Chưa đủ dữ liệu". Xếp họ hạng chót là sai và gây tranh cãi.
- Điểm bằng nhau → cùng hạng, hạng tiếp theo nhảy cóc (1, 2, 2, 4).
- `EMPLOYEE` chỉ thấy hạng của chính mình và tổng số người, không thấy tên người khác — tránh so sánh cá nhân gây căng thẳng nội bộ.

> ⚠️ Quy tắc cuối cần người dùng xác nhận: cho nhân viên thấy toàn bộ bảng xếp hạng hay chỉ thấy vị trí của mình?

## Phần B — Xu hướng

### Bốn cửa sổ thời gian

7 ngày · 30 ngày · 90 ngày · 12 tháng.

Áp dụng cho mọi metric chính: CPA, Lead, ROS, Doanh thu, Chi phí, Điểm KPI.

### Cách trình bày

- **Sparkline** trong KPI tile — xu hướng nhỏ gọn ngay cạnh con số
- **Line chart** đầy đủ ở màn hình xu hướng, có đường mục tiêu nét đứt
- Chỉ báo hướng: `↑ cải thiện` / `↓ suy giảm` / `→ ổn định`, kèm % thay đổi

### Xác định hướng

- So trung bình nửa sau cửa sổ với nửa đầu, không so hai điểm đầu-cuối (nhiễu).
- Ngưỡng "ổn định": thay đổi < 5% (cấu hình được, không hardcode).
- **Metric `LOWER_BETTER`: CPA giảm là cải thiện** → mũi tên xuống, màu xanh. Kiểm kỹ chỗ này.

## Dữ liệu

Đọc từ `kpi_summary` (điểm, hạng theo kỳ) và `kpi_actuals` (giá trị theo ngày cho sparkline).

Cửa sổ 12 tháng đọc từ `kpi_actuals` cấp `MONTH`, không cộng 365 dòng ngày.

## Edge case

- Chưa đủ dữ liệu cho cửa sổ (hệ thống mới dùng 10 ngày, chọn cửa sổ 90 ngày) → vẽ phần có dữ liệu, ghi rõ "Dữ liệu từ ngày X"
- Dữ liệu ngắt quãng (nghỉ lễ, không có báo cáo) → nối đường, không vẽ về 0
- Metric mới thêm giữa kỳ → xu hướng bắt đầu từ khi có dữ liệu
- Nhân viên mới vào giữa kỳ → không xếp hạng cho tới khi đủ dữ liệu tối thiểu (cấu hình)

## Test bắt buộc

- Xác định hướng đúng cho `LOWER_BETTER` (CPA giảm = cải thiện)
- Xếp hạng đồng điểm nhảy cóc đúng
- Người chưa đủ dữ liệu không bị xếp hạng chót
- `EMPLOYEE` không thấy tên người khác (nếu chốt phương án này)

## Tiêu chí hoàn thành

- [ ] 4 bảng xếp hạng, đủ 4 kỳ
- [ ] Hiện cả top và bottom
- [ ] Người chưa đủ dữ liệu tách riêng, không xếp hạng chót
- [ ] 4 cửa sổ xu hướng hoạt động
- [ ] Sparkline trong KPI tile
- [ ] Metric nghịch xác định hướng đúng — có test
- [ ] Đã chốt phạm vi ranking mà `EMPLOYEE` được thấy
