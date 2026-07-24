# Quy tắc bảo mật — MPMS

Hệ thống chứa KPI cá nhân, đánh giá hiệu suất và số liệu kinh doanh. Rò rỉ giữa các vai trò là sự cố nghiêm trọng, không phải lỗi giao diện.

## Phân quyền

| Role | Phạm vi dữ liệu |
|---|---|
| `ADMIN` | Toàn hệ thống + cấu hình + quản lý user |
| `MARKETING_MANAGER` | Toàn phòng Marketing: xem, duyệt, xuất báo cáo |
| `LEADER` | Subtree phòng ban mình phụ trách (đệ quy): xem + duyệt |
| `EMPLOYEE` | Chỉ dữ liệu cá nhân: xem KPI, nhập báo cáo |

### Quy tắc cứng

1. **Mọi truy vấn dữ liệu nghiệp vụ đi qua `resolveScope(user)`** (`src/server/auth/scope.ts`). Query Prisma đọc `kpi_*`, `reports`, `users` mà không áp scope là lỗ hổng — sửa ngay khi phát hiện.
2. **Kiểm quyền ở server.** Ẩn menu, disable nút, ẩn cột ở UI chỉ là trải nghiệm. Route handler và server action đều phải tự kiểm, không tin tham số từ client.
3. `LEADER` áp dụng theo **subtree đệ quy** của cây phòng ban, không chỉ phòng ban trực tiếp.
4. **Không ai tự duyệt báo cáo của chính mình**, kể cả Leader và Manager.
5. Quyền là **dữ liệu**, không phải code. Thêm phòng ban/vị trí không được đòi hỏi sửa logic phân quyền.
6. Tham số lọc từ URL (`?dept=&user=`) phải được kiểm lại với scope. Người dùng đổi `dept_id` trên thanh địa chỉ phải bị chặn ở server, không phải chỉ không thấy nút.

### Checklist khi thêm endpoint mới

- [ ] Đã lấy user từ session, không tin `userId` truyền lên?
- [ ] Đã gọi `resolveScope` và áp vào `where`?
- [ ] Vai trò thấp nhất (`EMPLOYEE`) chạy endpoint này thấy được gì?
- [ ] Sửa tham số URL sang phòng ban khác có bị chặn không?
- [ ] Không đủ quyền → trả 403 rõ ràng, không phải 500 hay màn hình trắng?

## Bí mật

Không bao giờ đưa vào log, response, audit log, thông báo lỗi, screenshot hay file export:

- Mật khẩu, password hash
- Access token / refresh token của Facebook, Google, TikTok
- `ANTHROPIC_API_KEY`, `AUTH_SECRET`
- Connection string database
- Session cookie

Quy tắc:

- Secret chỉ đọc từ `process.env`, chỉ ở tầng server. Biến `NEXT_PUBLIC_*` là công khai — không đặt secret vào đó.
- `.env` nằm trong `.gitignore`. Chỉ commit `.env.example` với giá trị giả.
- Token của nền tảng ads lưu mã hoá trong DB hoặc secret store, không lưu plaintext.
- Thông báo lỗi trả về client không chứa stack trace, tên bảng, hay câu SQL.

## Xác thực

- Mật khẩu hash bằng bcrypt/argon2, không bao giờ lưu plaintext.
- Session có thời hạn, có cách thu hồi.
- Không tự viết crypto. Dùng thư viện đã được kiểm chứng.
- Đăng nhập thất bại: thông báo chung chung (`Email hoặc mật khẩu không đúng`), không tiết lộ email có tồn tại hay không.

## Audit log

- Mọi thay đổi dữ liệu nghiệp vụ ghi qua helper duy nhất `src/server/audit/log.ts`.
- Nội dung: thời điểm, actor, entity, field, `old_value`, `new_value`, IP, user agent.
- **Chỉ append.** Không update, không delete — kể cả `ADMIN`. Code cho phép sửa audit log là lỗi nghiêm trọng.
- Ghi trong **cùng transaction** với thay đổi dữ liệu. Thay đổi thành công mà mất audit là không chấp nhận được.
- Hành động phải ghi audit: sửa KPI, chuyển trạng thái report, đổi trọng số, đổi phân quyền, tạo/sửa/xoá user, xuất báo cáo, đăng nhập.

## Xuất báo cáo

File xuất ra rời khỏi hệ thống và có thể bị chuyển tiếp — rò rỉ không thu hồi được.

- Dữ liệu vào file phải qua `resolveScope`, **không có đường tắt "xuất hết rồi lọc sau"**.
- Ghi audit mỗi lần xuất: ai, lúc nào, phạm vi nào.
- Link tải kiểm quyền lại tại thời điểm tải. Không dùng URL đoán được. File tạm có TTL.

## Đầu vào

- Validate mọi input từ client bằng **Zod** ở tầng server, kể cả khi UI đã validate.
- Không nội suy chuỗi vào SQL. Dùng Prisma hoặc parameterized query.
- Giới hạn kích thước upload, kiểm mime type thật (không tin phần mở rộng tên file).
- Escape nội dung do người dùng nhập khi render — React đã escape mặc định, cẩn thận với `dangerouslySetInnerHTML`.

## AI

- Không gửi dữ liệu cá nhân, lương, token vào prompt.
- Output AI luôn parse qua schema Zod, không render text thô.
- Nội dung do AI sinh phải gắn nhãn rõ trên UI và trong file export.
