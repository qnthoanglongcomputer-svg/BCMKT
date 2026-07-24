---
name: report-export
description: Quy trình xây hoặc sửa chức năng xuất báo cáo PDF/Excel trong MPMS — bộ lọc theo kỳ và tổ chức, phân quyền dữ liệu xuất, định dạng số, xử lý file lớn theo job nền, và audit việc xuất báo cáo. Dùng khi làm tính năng export, in ấn, hoặc báo cáo định kỳ gửi tự động.
---

# Xuất báo cáo PDF / Excel

## Bước 1 — Xác định phạm vi báo cáo

Chốt trước khi code:

- Loại kỳ: ngày / tuần / tháng / quý / năm
- Bộ lọc: chi nhánh, bộ phận, team, nhân viên, campaign
- Nội dung: chỉ số nào, có biểu đồ không, có chi tiết từng dòng không
- Ai được xuất, và **xuất được dữ liệu của ai**

## Bước 2 — Phân quyền (quan trọng nhất)

File xuất ra rời khỏi hệ thống và có thể bị chuyển tiếp. Rò rỉ ở đây không thu hồi được.

- Dữ liệu đưa vào file **phải đi qua `resolveScope(user)`**, giống hệt dashboard. Không có đường tắt "xuất hết rồi lọc sau".
- `EMPLOYEE` chỉ xuất được dữ liệu cá nhân. `LEADER` chỉ subtree của mình.
- Kiểm tham số bộ lọc từ client: người dùng sửa `dept_id` trên request phải bị chặn ở server.
- **Ghi audit log mỗi lần xuất**: ai, lúc nào, phạm vi nào, loại file gì.
- Không đưa dữ liệu nhạy cảm ngoài phạm vi báo cáo (lương, thông tin cá nhân, token) vào file.

## Bước 3 — Excel (ExcelJS)

- Mỗi nhóm nội dung một sheet: Tổng quan · Theo bộ phận · Theo nhân viên · Theo campaign · Chi tiết.
- Hàng đầu: tiêu đề báo cáo, kỳ, bộ lọc đã áp dụng, thời điểm xuất, người xuất. Người nhận phải biết file này là gì.
- Định dạng ô đúng kiểu **ở tầng Excel**, không format thành chuỗi: tiền `#,##0`, phần trăm `0.0%`, ngày `dd/mm/yyyy`. Người nhận cần cộng/lọc được.
- Freeze hàng tiêu đề, bật auto filter, đặt độ rộng cột hợp lý.
- Số liệu để nguyên giá trị thật — **không rút gọn** (72K, 1,2 tỷ) trong file Excel.

## Bước 4 — PDF

- Dùng template HTML rồi render (Puppeteer / react-pdf), không dựng PDF thủ công từng toạ độ.
- Có header (logo, tên báo cáo, kỳ) và footer (số trang, thời điểm xuất, người xuất) trên mọi trang.
- Ngắt trang có kiểm soát: không cắt đôi bảng hoặc biểu đồ.
- Nhúng font hỗ trợ tiếng Việt đầy đủ — kiểm dấu hiển thị đúng, đây là lỗi hay gặp nhất.
- Biểu đồ render server-side thành ảnh; không phụ thuộc JS chạy ở client.
- Nội dung do AI sinh phải có nhãn rõ trong file.

## Bước 5 — Hiệu năng và file lớn

- Ước lượng khối lượng trước. Vượt ngưỡng (ví dụ > 20.000 dòng hoặc > 10 giây) → chuyển sang **job nền**: trả về job id, người dùng nhận thông báo khi xong, tải file qua link có hạn.
- Streaming khi ghi Excel lớn, không dựng toàn bộ trong bộ nhớ.
- Truy vấn dữ liệu theo batch, đọc từ bảng summary thay vì aggregate on-the-fly.
- Đặt timeout rõ ràng; quá hạn thì báo lỗi có ý nghĩa, không treo vô hạn.

## Bước 6 — Đặt tên và lưu trữ

- Tên file có ngữ nghĩa: `MPMS_BaoCao_<PhamVi>_<Ky>_<YYYYMMDD>.xlsx`, không dấu, không khoảng trắng.
- File tạm dọn sau khi tải hoặc sau TTL. Không tích tụ trong thư mục public.
- Link tải phải kiểm quyền lại tại thời điểm tải, **không dùng URL đoán được**.

## Bước 7 — Kiểm thử

- Xuất với dữ liệu rỗng → file hợp lệ có thông báo "không có dữ liệu", không lỗi.
- Xuất với dữ liệu lớn → không timeout, không tràn bộ nhớ.
- Mở file bằng Excel thật: kiểm dấu tiếng Việt, định dạng số, công thức lọc.
- Mở PDF: kiểm dấu, ngắt trang, header/footer.
- Xuất bằng tài khoản `EMPLOYEE` và `LEADER`: **file có chứa dữ liệu ngoài phạm vi không?**

```bash
npm run typecheck && npm test
```

## Bước 8 — Báo cáo

Loại báo cáo đã làm, phạm vi dữ liệu và cách áp quyền, đã kiểm với vai trò nào, xử lý file lớn ra sao, phần chưa kiểm được.
