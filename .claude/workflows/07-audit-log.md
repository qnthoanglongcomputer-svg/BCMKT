# 07 — Nhật ký hệ thống (Audit Log)

**Phụ thuộc**: [01 — Auth](01-auth-phan-quyen.md) · **Nên làm sớm** vì mọi chức năng sau đều phải ghi audit

## Mục tiêu

"Không ai có thể sửa dữ liệu mà không có lịch sử" (mục 21 đặc tả). Mọi thay đổi dữ liệu nghiệp vụ đều truy vết được: ai, lúc nào, đổi gì, từ giá trị nào sang giá trị nào.

## Vai trò

- `ADMIN`: xem toàn bộ audit log
- `MARKETING_MANAGER`: xem audit trong phạm vi Marketing
- `LEADER` / `EMPLOYEE`: xem lịch sử thay đổi của bản ghi thuộc phạm vi mình (không xem log toàn hệ thống)

## Dữ liệu

Đã có `audit_log`: `actor_id`, `action`, `entity_type`, `entity_id`, `field`, `old_value`, `new_value`, `ip_address`, `user_agent`, `created_at`.

`AuditAction`: `CREATE` · `UPDATE` · `DELETE` · `APPROVE` · `REJECT` · `SUBMIT` · `REOPEN` · `EXPORT` · `LOGIN`

## Cần xây

### `src/server/audit/log.ts` — helper duy nhất

```ts
logAudit(tx, {
  actorId, action, entityType, entityId,
  changes: [{ field, oldValue, newValue }],
  ipAddress?, userAgent?,
})
```

- Nhận `tx` (Prisma transaction client) làm tham số — **bắt buộc ghi trong cùng transaction** với thay đổi dữ liệu.
- Nhiều field đổi trong một hành động → nhiều dòng audit cùng `entity_id` và `created_at`.
- Helper `diffFields(before, after, fields[])` để sinh danh sách thay đổi tự động.

### Màn hình `/admin/audit`

- Bảng: thời gian · người thực hiện · hành động · đối tượng · trường · giá trị cũ → mới
- Lọc: khoảng thời gian, người thực hiện, loại đối tượng, hành động
- Phân trang phía server (bảng này sẽ rất lớn)
- Xuất Excel (và bản thân việc xuất cũng ghi audit)

### Widget "Lịch sử thay đổi"

Nhúng vào màn hình chi tiết của KPI plan, báo cáo, user — hiện 10 thay đổi gần nhất của bản ghi đó.

## Quy tắc bất di bất dịch

1. **Chỉ append.** Không `update`, không `delete` — kể cả `ADMIN`. Code cho phép sửa audit log là lỗi nghiêm trọng, phải báo ngay.
2. **Cùng transaction** với thay đổi dữ liệu. Thay đổi thành công mà mất audit là không chấp nhận được. Rollback thì audit cũng rollback.
3. **Không ghi secret**: mật khẩu, hash, token, API key, connection string. Đặt lại mật khẩu chỉ ghi sự kiện, không ghi giá trị.
4. `old_value`/`new_value` lưu dạng string — dùng `JSON.stringify` cho giá trị phức tạp, `Decimal.toString()` cho số.

## Hành động bắt buộc ghi audit

| Miền | Hành động |
|---|---|
| Auth | Đăng nhập, đăng xuất, đổi mật khẩu, đổi vai trò |
| Tổ chức | Tạo/sửa/vô hiệu hoá phòng ban, vị trí, user; đổi phòng ban của user |
| KPI | Tạo/sửa kế hoạch, đổi mục tiêu, đổi chiến lược phân bổ, đổi trọng số |
| Báo cáo | Submit, approve, reject, reopen, sửa giá trị |
| Campaign | Tạo/sửa/kết thúc, đổi ngân sách |
| Cấu hình | Đổi ngưỡng cảnh báo, đổi định nghĩa metric |
| Export | Mỗi lần xuất PDF/Excel: ai, phạm vi nào |

## Edge case

- Hành động của hệ thống (cron rollup, sync ads) → `actor_id = null`, ghi rõ `entity_type` để phân biệt
- Bản ghi bị soft delete → audit vẫn giữ, `entity_id` vẫn tra được
- Giá trị quá dài (JSON lớn) → cắt ở độ dài hợp lý và đánh dấu đã cắt, không làm hỏng bảng
- Audit log lớn dần → **không xoá**. Nếu cần, archive sang bảng lạnh, và việc archive cũng phải ghi lại.

## Test bắt buộc

- Update một bản ghi → audit có đủ `old_value` và `new_value`
- Transaction rollback → audit cũng rollback, không còn dòng thừa
- Không có đường code nào `update`/`delete` trên `audit_log` (kiểm bằng grep)
- Đặt lại mật khẩu → audit ghi sự kiện nhưng không chứa mật khẩu

## Tiêu chí hoàn thành

- [ ] Helper `logAudit` là **đường duy nhất** ghi audit, grep xác nhận
- [ ] Mọi hành động trong bảng trên đều ghi audit
- [ ] Audit ghi trong cùng transaction, có test rollback
- [ ] Màn hình `/admin/audit` lọc và phân trang server-side
- [ ] Widget lịch sử thay đổi nhúng ở màn hình chi tiết
- [ ] Grep xác nhận không có secret nào lọt vào audit
