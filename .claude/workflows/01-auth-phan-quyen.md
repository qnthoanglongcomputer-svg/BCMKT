# 01 — Xác thực & phân quyền

**Phụ thuộc**: không · **Chặn**: toàn bộ chức năng còn lại

## Mục tiêu

Người dùng đăng nhập bằng email/mật khẩu, hệ thống xác định vai trò và **phạm vi dữ liệu** họ được truy cập. Mọi truy vấn nghiệp vụ về sau đều đi qua phạm vi này.

## Vai trò và phạm vi

| Role | Thấy được gì | Duyệt được gì |
|---|---|---|
| `ADMIN` | Toàn hệ thống | Tất cả |
| `MARKETING_MANAGER` | Toàn phòng Marketing | Tất cả trong Marketing |
| `LEADER` | Subtree phòng ban mình phụ trách (đệ quy) | Báo cáo trong subtree |
| `EMPLOYEE` | Chỉ dữ liệu cá nhân | Không |

## Dữ liệu

Bảng đã có: `users` (email, password_hash, role, department_id, position_id, is_active), `departments` (parent_id — cây tự mở rộng).

Không cần migration mới.

## Luồng chính

```
Đăng nhập → xác thực credentials → tạo session
                                       ↓
                          Mỗi request: đọc session
                                       ↓
                          resolveScope(user) → { departmentIds[], userIds[] }
                                       ↓
                          Áp vào mọi query nghiệp vụ
```

## Cần xây

### `src/server/auth/scope.ts`

```ts
interface Scope {
  /** Danh sách department_id được phép đọc. null = toàn bộ (ADMIN) */
  departmentIds: string[] | null
  /** Danh sách user_id được phép đọc. null = toàn bộ trong departmentIds */
  userIds: string[] | null
  canApprove: boolean
}

function resolveScope(user: SessionUser): Promise<Scope>
```

- `ADMIN` → `{ departmentIds: null, userIds: null, canApprove: true }`
- `MARKETING_MANAGER` → subtree của `MARKETING`, `canApprove: true`
- `LEADER` → subtree đệ quy của `user.departmentId`, `canApprove: true`
- `EMPLOYEE` → `{ departmentIds: [user.departmentId], userIds: [user.id], canApprove: false }`

Truy vấn subtree dùng **recursive CTE**, không đệ quy trong JS gây N+1.

### `src/server/auth/guard.ts`

```ts
requireUser()                    // chưa đăng nhập → ném UnauthorizedError
requireRole(user, roles[])       // không đủ vai trò → ném ForbiddenError
assertInScope(scope, departmentId | userId)  // ngoài phạm vi → ném ForbiddenError
```

### Màn hình
- `/login` — email, mật khẩu, thông báo lỗi chung chung (`Email hoặc mật khẩu không đúng`), không tiết lộ email có tồn tại
- Layout `(dashboard)` — guard chuyển hướng về `/login` khi chưa đăng nhập
- Sidebar ẩn menu ngoài quyền (chỉ là trải nghiệm, không phải bảo mật)

### Seed
Tài khoản `ADMIN` đầu tiên tạo qua script riêng, mật khẩu truyền qua biến môi trường, **không hardcode trong seed**.

## Edge case

- User bị `is_active = false` → không đăng nhập được, thông báo rõ
- User bị soft delete (`deleted_at`) → như trên
- `LEADER` không có `department_id` → scope rỗng, thấy đúng dữ liệu của chính mình
- Phòng ban bị đổi parent giữa chừng → scope tính lại mỗi request, không cache dài
- Đổi vai trò của user đang đăng nhập → session phải phản ánh vai trò mới ở request kế tiếp

## Bảo mật

- Hash mật khẩu bằng bcrypt/argon2. Không tự viết crypto.
- Session có thời hạn và thu hồi được.
- Kiểm quyền **ở server**, không tin `role` từ client.
- Ghi audit khi đăng nhập, đổi mật khẩu, đổi vai trò.
- Không log mật khẩu, hash, hay session token.

## Test bắt buộc

- `resolveScope` cho cả 4 vai trò trên cây phòng ban ≥ 3 tầng
- `LEADER` thấy subtree đệ quy, không chỉ phòng ban trực tiếp
- `EMPLOYEE` không thấy dữ liệu người khác cùng phòng
- Đổi `dept` trên URL sang phòng ban ngoài scope → bị chặn ở server
- User `is_active = false` không đăng nhập được

## Tiêu chí hoàn thành

- [ ] Đăng nhập/đăng xuất hoạt động, session bền qua F5
- [ ] `resolveScope` có test đủ 4 vai trò, pass
- [ ] Layout dashboard chặn truy cập khi chưa đăng nhập
- [ ] Có script tạo admin đầu tiên, mật khẩu từ env
- [ ] Ghi audit cho đăng nhập và đổi vai trò
- [ ] Thử bằng tài khoản `EMPLOYEE`: không thấy dữ liệu ngoài phạm vi qua UI **và** qua sửa URL
