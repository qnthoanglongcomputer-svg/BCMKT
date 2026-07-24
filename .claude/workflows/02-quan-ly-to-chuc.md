# 02 — Quản lý tổ chức & nhân sự

**Phụ thuộc**: [01 — Auth & phân quyền](01-auth-phan-quyen.md)

## Mục tiêu

Admin quản lý cây phòng ban, vị trí công việc và nhân sự **mà không cần lập trình lại** (yêu cầu mục 2 đặc tả). Thêm bộ phận, team, vị trí mới là thao tác dữ liệu thuần.

## Vai trò

- `ADMIN`: toàn quyền tạo/sửa/vô hiệu hoá phòng ban, vị trí, user
- `MARKETING_MANAGER`: xem toàn bộ, không sửa
- `LEADER`: xem nhân sự trong subtree của mình
- `EMPLOYEE`: xem thông tin cá nhân

## Dữ liệu

Đã có: `departments` (self-reference `parent_id`, `code`, `level`), `positions`, `users`. Không cần migration.

Cây hiện tại sau seed:
```
COMPANY
└── MARKETING
    ├── PERFORMANCE   (5 vị trí)
    ├── CONTENT_SOCIAL (5 vị trí)
    ├── TRADE          (2 vị trí)
    └── BRANDING       (1 vị trí)
```

## Màn hình

### `/hr/departments` — Cây phòng ban
- Hiển thị dạng cây có thể mở/đóng, kéo thả đổi parent (tuỳ chọn, không bắt buộc ở bản đầu)
- Mỗi node: tên, mã, số nhân sự, số vị trí
- Thao tác: thêm phòng ban con, sửa tên, vô hiệu hoá

### `/hr/positions` — Vị trí công việc
- Bảng: mã, tên, phòng ban, số nhân sự đang giữ vị trí
- Lọc theo phòng ban

### `/hr/users` — Nhân sự
- Bảng: họ tên, email, vai trò, phòng ban, vị trí, trạng thái
- Lọc theo phòng ban, vai trò, trạng thái
- Thao tác: tạo, sửa, đổi vai trò, vô hiệu hoá, đặt lại mật khẩu
- **Áp scope**: `LEADER` chỉ thấy nhân sự trong subtree

## Quy tắc nghiệp vụ

- `code` phòng ban và vị trí là **duy nhất, không đổi được** sau khi tạo — dashboard chuyên biệt tra theo `code`.
- Không cho phép tạo vòng lặp trong cây (A là cha của B, B là cha của A). Kiểm khi đổi `parent_id`.
- **Không xoá cứng.** Phòng ban còn nhân sự hoặc còn KPI → chỉ vô hiệu hoá (`deleted_at`), chặn ở DB bằng `onDelete: Restrict`.
- Đổi phòng ban của một nhân viên: dữ liệu KPI lịch sử **giữ nguyên** ở phòng ban cũ. Không di chuyển dữ liệu quá khứ.
- `level` tự tính từ `parent_id`, không cho nhập tay.

## Edge case

- Tạo phòng ban con của phòng ban đã vô hiệu hoá → chặn
- Vô hiệu hoá phòng ban còn phòng ban con đang hoạt động → chặn, nêu rõ có bao nhiêu con
- Đổi parent làm thay đổi `level` của cả subtree → cập nhật đệ quy trong transaction
- User không có phòng ban (mới tạo, chưa gán) → hiển thị rõ, không crash dashboard
- Vị trí không thuộc phòng ban nào → không cho tạo, `department_id` bắt buộc

## Audit

Ghi log cho: tạo/sửa/vô hiệu hoá phòng ban, vị trí, user; đổi vai trò; đổi phòng ban của user; đặt lại mật khẩu (ghi sự kiện, **không ghi mật khẩu**).

## Test bắt buộc

- Phát hiện vòng lặp khi đổi `parent_id`
- `level` cập nhật đúng cho cả subtree khi đổi parent
- Chặn vô hiệu hoá phòng ban còn nhân sự
- `LEADER` chỉ thấy nhân sự trong subtree của mình

## Tiêu chí hoàn thành

- [ ] Thêm được phòng ban/team/vị trí mới hoàn toàn qua UI, **không sửa code**
- [ ] Cây phòng ban hiển thị đúng nhiều tầng
- [ ] Chống vòng lặp cây có test
- [ ] Áp scope đúng cho `LEADER` và `EMPLOYEE`
- [ ] Audit log đầy đủ cho mọi thay đổi
- [ ] 5 trạng thái UI đầy đủ trên cả 3 màn hình
