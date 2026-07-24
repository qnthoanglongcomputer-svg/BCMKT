# 17 — Xuất báo cáo PDF / Excel

**Phụ thuộc**: [10 — Dashboard bộ phận](10-dashboard-bo-phan.md), [07 — Audit log](07-audit-log.md) · **Quy trình**: skill [report-export](../skills/report-export/SKILL.md)

## Mục tiêu

Xuất báo cáo PDF và Excel theo ngày/tuần/tháng/quý/năm, có bộ lọc chi nhánh · bộ phận · team · nhân viên · campaign (mục 23 đặc tả).

## Vai trò

Mọi vai trò xuất được, nhưng **dữ liệu trong file giới hạn theo `resolveScope`**:
- `EMPLOYEE` chỉ xuất dữ liệu cá nhân
- `LEADER` chỉ subtree của mình
- `MARKETING_MANAGER` / `ADMIN` toàn phòng

## Điểm quan trọng nhất — phân quyền

File xuất ra **rời khỏi hệ thống** và có thể bị chuyển tiếp. Rò rỉ ở đây không thu hồi được.

- Dữ liệu vào file **phải qua `resolveScope`**. Không có đường tắt "xuất hết rồi lọc sau".
- Kiểm tham số bộ lọc từ client — người dùng sửa `dept_id` trên request phải bị chặn ở server.
- **Ghi audit mỗi lần xuất**: ai · lúc nào · phạm vi nào · loại file gì.
- Không đưa dữ liệu ngoài phạm vi báo cáo (lương, thông tin cá nhân, token) vào file.

## Loại báo cáo

| Loại | Nội dung |
|---|---|
| Báo cáo KPI kỳ | Mục tiêu · thực tế · % đạt · điểm · xếp loại theo từng cấp |
| Báo cáo bộ phận | Chỉ số đặc thù của bộ phận + so sánh nhân viên |
| Báo cáo campaign | Chi phí · doanh thu · ROI · đóng góp theo bộ phận |
| Báo cáo nhân sự | Điểm KPI · xếp hạng · năng suất theo nhân viên |

## Excel (ExcelJS)

- Mỗi nhóm nội dung một sheet: Tổng quan · Theo bộ phận · Theo nhân viên · Theo campaign · Chi tiết
- **Hàng đầu**: tiêu đề · kỳ · bộ lọc đã áp dụng · thời điểm xuất · người xuất. Người nhận phải biết file này là gì.
- Định dạng ô đúng kiểu **ở tầng Excel**, không format thành chuỗi: tiền `#,##0`, phần trăm `0.0%`, ngày `dd/mm/yyyy`. Người nhận cần cộng và lọc được.
- Freeze hàng tiêu đề, bật auto filter, độ rộng cột hợp lý
- **Không rút gọn số** (72K, 1,2 tỷ) trong Excel — để nguyên giá trị thật

## PDF (template HTML → Puppeteer/react-pdf)

- Dùng template HTML rồi render, không dựng PDF thủ công từng toạ độ
- Header (logo, tên báo cáo, kỳ) và footer (số trang, thời điểm xuất, người xuất) trên mọi trang
- Ngắt trang có kiểm soát: không cắt đôi bảng hoặc biểu đồ
- **Nhúng font hỗ trợ tiếng Việt đầy đủ** — kiểm dấu hiển thị đúng. Đây là lỗi hay gặp nhất.
- Biểu đồ render server-side thành ảnh, không phụ thuộc JS chạy ở client
- Nội dung do AI sinh phải có nhãn rõ trong file

## Hiệu năng

- Ước lượng khối lượng trước. Vượt ngưỡng (> 20.000 dòng hoặc > 10 giây) → **job nền**: trả job id, thông báo khi xong, tải qua link có hạn.
- Streaming khi ghi Excel lớn, không dựng toàn bộ trong bộ nhớ
- Truy vấn theo batch, đọc từ bảng summary
- Timeout rõ ràng; quá hạn báo lỗi có ý nghĩa, không treo

## Đặt tên và lưu trữ

- `MPMS_BaoCao_<PhamVi>_<Ky>_<YYYYMMDD>.xlsx` — không dấu, không khoảng trắng
- File tạm dọn sau khi tải hoặc sau TTL, không tích tụ trong thư mục public
- **Link tải kiểm quyền lại tại thời điểm tải**, không dùng URL đoán được

## Edge case

- Dữ liệu rỗng → file hợp lệ có dòng "Không có dữ liệu trong kỳ này", không lỗi
- Dữ liệu rất lớn → job nền, không timeout
- Người dùng đóng trình duyệt giữa chừng → job nền vẫn chạy, thông báo khi xong
- Giá trị `null` (mẫu số 0) → ô trống hoặc `—`, **không phải 0**
- Xuất kỳ tương lai → chỉ có mục tiêu, phần thực tế trống

## Test bắt buộc

- Xuất với dữ liệu rỗng → file hợp lệ
- Xuất bằng `EMPLOYEE` và `LEADER` → **file không chứa dữ liệu ngoài phạm vi**
- Sửa tham số bộ lọc sang phòng ban ngoài scope → bị chặn
- Audit ghi đủ mỗi lần xuất

## Kiểm thủ công bắt buộc

- Mở file bằng Excel thật: dấu tiếng Việt, định dạng số, lọc và cộng được
- Mở PDF: dấu tiếng Việt, ngắt trang, header/footer đủ mọi trang

## Tiêu chí hoàn thành

- [ ] Xuất Excel và PDF cho 4 loại báo cáo
- [ ] Đủ 5 mức kỳ và đủ bộ lọc theo đặc tả
- [ ] Dữ liệu qua `resolveScope`, đã thử với vai trò thấp nhất
- [ ] Audit ghi mỗi lần xuất
- [ ] Dấu tiếng Việt hiển thị đúng trong cả Excel và PDF
- [ ] Định dạng ô Excel đúng kiểu, lọc và cộng được
- [ ] File lớn chuyển job nền, không timeout
- [ ] Link tải kiểm quyền lại, có TTL
