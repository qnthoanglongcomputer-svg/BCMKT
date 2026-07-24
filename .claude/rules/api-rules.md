# Quy tắc API & tầng server — MPMS

## Chọn Server Action hay Route Handler

| Dùng | Khi nào |
|---|---|
| **Server Action** | Form submit, mutation từ UI của chính app (tạo/sửa/duyệt báo cáo, lưu KPI plan) |
| **Route Handler** (`app/api/**`) | Đọc dữ liệu cho TanStack Query, webhook, export file, endpoint gọi từ worker/cron |

Không tạo route handler chỉ để UI của chính mình gọi khi Server Action làm được — thêm một tầng không cần thiết.

## Cấu trúc bắt buộc của mọi endpoint

Thứ tự này không được đảo:

```
1. Lấy user từ session          → chưa đăng nhập: 401
2. Kiểm quyền theo vai trò      → không đủ quyền: 403
3. Validate input bằng Zod      → sai định dạng: 400, kèm chi tiết lỗi
4. Áp resolveScope(user)        → giới hạn phạm vi dữ liệu
5. Gọi logic ở src/server/**    → không viết nghiệp vụ trong route handler
6. Ghi audit + notification     → cùng transaction với thay đổi
7. Trả response                 → định dạng thống nhất
```

**Không tin bất cứ thứ gì từ client**, kể cả `userId`, `departmentId`, `role`. Lấy từ session.

## Validate

- Zod cho mọi input, kể cả khi UI đã validate.
- Schema đặt cạnh endpoint hoặc trong `src/server/<domain>/schemas.ts` khi dùng lại nhiều nơi.
- Thông báo lỗi validate bằng **tiếng Việt**, nêu rõ trường nào sai và sai thế nào.
- Số tiền và tỷ lệ nhận dạng **string** rồi chuyển sang `Decimal` — không nhận `number` để tránh mất độ chính xác khi qua JSON.

```ts
const schema = z.object({
  yearTarget: z.string().refine((v) => !Number.isNaN(Number(v)), 'Mục tiêu phải là số'),
  strategy: z.enum(['EVEN', 'WEIGHTED', 'MANUAL']),
})
```

## Định dạng response

Thành công:
```json
{ "data": { ... } }
```

Lỗi:
```json
{ "error": { "code": "SCOPE_DENIED", "message": "Bạn không có quyền xem dữ liệu của bộ phận này." } }
```

- `message` là tiếng Việt, hiển thị được thẳng cho người dùng.
- `code` là SCREAMING_SNAKE, dùng cho client phân nhánh xử lý.
- **Không trả stack trace, tên bảng, hay câu SQL** về client.

Mã HTTP: `200` OK · `400` input sai · `401` chưa đăng nhập · `403` không đủ quyền · `404` không tìm thấy (trong phạm vi cho phép) · `409` xung đột trạng thái · `422` vi phạm quy tắc nghiệp vụ · `500` lỗi hệ thống.

**Cẩn thận `404` vs `403`**: trả `404` cho tài nguyên nằm ngoài scope, để không tiết lộ sự tồn tại của nó.

## Transaction

Phải nằm trong một transaction:

- Chuyển trạng thái báo cáo + ghi audit + tạo notification
- Phân bổ lại KPI (xoá target cũ + sinh target mới)
- Rollup một kỳ (xoá summary cũ + ghi summary mới)
- Bất kỳ thao tác nào ghi vào ≥ 2 bảng và không được để lại trạng thái nửa vời

Transaction rollback thì audit cũng phải rollback — không ghi audit cho việc chưa xảy ra.

## Truy vấn

- Đọc dashboard từ bảng summary, **không** aggregate on-the-fly trên `kpi_actuals` cấp ngày.
- `select` đúng cột cần dùng, không `select *` trên bảng rộng.
- Tránh N+1: dùng `include`/`select` có chủ đích, hoặc raw SQL với recursive CTE cho truy vấn cây phòng ban.
- Phân trang bằng cursor cho danh sách lớn, không `skip` với offset lớn.
- Lọc `deleted_at: null` trên bảng có soft delete.

## Phân tầng

```
app/api/**            → orchestrate: auth, validate, gọi service, format response
src/server/<domain>/  → nghiệp vụ thuần, test được, không import React/Next
src/lib/prisma.ts     → client duy nhất
```

Route handler **không chứa công thức nghiệp vụ**. Nếu thấy phép tính KPI trong `app/api/`, chuyển vào `src/server/kpi/`.

## Idempotency

Endpoint ghi dữ liệu nên chịu được gọi lại:

- Sync ads: `upsert` theo khoá tự nhiên.
- Chuyển trạng thái: kiểm trạng thái nguồn hợp lệ trước; gọi `approve` lần hai trên report đã `APPROVED` → trả `409`, không ghi audit trùng.
- Phân bổ KPI: xoá và sinh lại, không cộng dồn.

## Job nền

- Tác vụ > 10 giây (export lớn, backfill, rollup toàn năm) chuyển sang job nền, trả về job id.
- Job ghi log tiến độ và trạng thái, hiển thị được ở màn hình admin.
- Job phải có timeout và retry có giới hạn. Không retry vô hạn.

## Caching

- `queryKey` của TanStack Query phải chứa **đầy đủ** tham số lọc — thiếu một tham số là hiện nhầm dữ liệu của bộ lọc khác.
- Dữ liệu kỳ đã chốt (tháng trước) `staleTime` dài; dữ liệu hôm nay `staleTime` ngắn.
- AI insight cache theo `(scope, period, data_hash)`.
- Không cache ở tầng CDN cho dữ liệu có phân quyền.
