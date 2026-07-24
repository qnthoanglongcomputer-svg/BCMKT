---
name: db-migration
description: Quy trình thay đổi schema PostgreSQL/Prisma của MPMS một cách an toàn — đánh giá tác động, xin phê duyệt, migration nhiều bước không mất dữ liệu, backfill, kiểm thử và đường lùi. Dùng khi cần thêm/sửa/xoá bảng, cột, quan hệ, index hoặc enum.
---

# Migration cơ sở dữ liệu

Schema là thứ khó lùi nhất. Quy trình này bắt buộc, không rút gọn.

## Bước 0 — Xin phê duyệt (bắt buộc)

**Không chạy migration nào trước khi người dùng đồng ý.** Trình bày:

```
Thay đổi:        <bảng/cột cụ thể>
Lý do:           <vì sao cần>
Mất dữ liệu:     <có/không, cột nào>
Cần backfill:    <có/không>
Cần downtime:    <có/không>
Ảnh hưởng KPI:   <có phải tính lại dữ liệu lịch sử không>
Đường lùi:       <cách rollback>
```

Xoá cột hoặc bảng → hỏi rõ: "Tôi cần xoá [tên]. Bạn có đồng ý không?"

## Bước 1 — Khảo sát

- Đọc `prisma/schema.prisma` và vài migration gần nhất để nắm quy ước hiện tại.
- Grep toàn bộ chỗ dùng bảng/cột sắp đổi: `src/server/**`, `src/app/**`, seed, worker.
- Kiểm tra bảng có phải nguồn của rollup/summary không — nếu có, thay đổi sẽ kéo theo tính lại KPI.

## Bước 2 — Tuân thủ quy ước schema

- Tiền `Decimal(18,2)`, tỷ lệ `Decimal(9,4)`, số lượng `Int`. **Không `Float`.**
- Đủ `created_at`, `updated_at`, `created_by`, `updated_by`.
- Soft delete (`deleted_at`) cho `users`, `departments`, `campaigns`. KPI/report/audit không xoá cứng.
- Enum ở tầng DB cho trạng thái cố định.
- Đặt tên: bảng số nhiều snake_case, cột snake_case, FK `<entity>_id`.
- Ràng buộc đặt ở DB (unique, FK, check), không chỉ ở tầng ứng dụng.

## Bước 3 — Migration nhiều bước cho thay đổi phá vỡ tương thích

Không bao giờ đổi kiểu hoặc xoá cột trong một bước khi đã có dữ liệu:

```
Migration 1:  thêm cột mới (nullable, có default)
Backfill:     script riêng, chạy lại được, log số dòng
Deploy code:  code đọc/ghi cột mới, vẫn tương thích cột cũ
Migration 2:  đặt NOT NULL / thêm ràng buộc
Migration 3:  bỏ cột cũ (sau khi chắc chắn không còn ai dùng)
```

Đổi tên cột = thêm cột mới + backfill + bỏ cột cũ. Không dùng rename trực tiếp trên bảng có dữ liệu production.

## Bước 4 — Script backfill

- File riêng trong `prisma/scripts/`, không nhét vào file migration SQL.
- **Idempotent**: chạy lại không nhân đôi, không hỏng dữ liệu.
- Xử lý theo batch (1000–5000 dòng) cho bảng lớn, tránh khoá bảng lâu.
- Log: tổng số dòng, số dòng đã xử lý, số dòng bỏ qua, lỗi.
- Chạy thử trên bản sao dữ liệu thật trước.

## Bước 5 — Index

Chỉ thêm index khi có bằng chứng: chạy `EXPLAIN ANALYZE` cho truy vấn chậm, ghi lại kết quả trước/sau. Trên bảng lớn dùng `CREATE INDEX CONCURRENTLY` để không khoá ghi.

## Bước 6 — Thực thi và kiểm thử

```bash
npx prisma validate
npx prisma migrate dev --name <ten_mo_ta_ngan>
npx prisma generate
npm run typecheck
npm test
```

Kiểm bổ sung:
- Seed chạy lại từ DB rỗng thành công.
- Truy vấn ở các file đã grep ở bước 1 vẫn chạy đúng.
- Nếu đụng bảng KPI: chạy lại rollup trên dữ liệu mẫu và đối chiếu số trước/sau.

## Bước 7 — Quy tắc cấm

- **Không sửa file migration đã apply.** Sai thì tạo migration mới.
- Không `prisma migrate reset` trên DB có dữ liệu thật.
- Không `prisma db push` cho môi trường có dữ liệu — luôn dùng migration có version.
- Không đặt dữ liệu môi trường (tên phòng ban thật, user thật) vào seed dùng chung.

## Bước 8 — Báo cáo

Migration đã tạo (tên file), thay đổi cụ thể, backfill đã chạy và số dòng, lệnh kiểm thử và kết quả thật, KPI lịch sử có cần tính lại không, cách rollback.
