---
name: new-feature
description: Quy trình chuẩn để xây một tính năng mới trong MPMS từ đầu tới cuối — làm rõ yêu cầu theo đặc tả, thiết kế dữ liệu, viết logic server, dựng UI, phân quyền, audit, test và xác minh. Dùng khi người dùng yêu cầu thêm một chức năng mới (màn hình, luồng nghiệp vụ, module) chứ không phải sửa lỗi nhỏ.
---

# Xây tính năng mới trong MPMS

Áp dụng khi thêm chức năng mới. Với sửa lỗi nhỏ hoặc chỉnh UI đơn lẻ, bỏ qua skill này.

## Bước 1 — Làm rõ trước khi code

Đối chiếu [motaduan.md](../../../motaduan.md) và trả lời được:

- Mục tiêu người dùng là gì? Vai trò nào dùng (Admin / Manager / Leader / Employee)?
- Đầu vào, đầu ra là gì?
- Luồng chính gồm mấy bước?
- Edge case nào? Trạng thái lỗi nào?
- Tiêu chí hoàn thành đo được là gì?

Nếu đặc tả không nói rõ và các cách hiểu dẫn tới kết quả khác nhau → **hỏi người dùng**, đừng đoán.

## Bước 2 — Khảo sát code hiện có

Bắt buộc trước khi viết dòng đầu tiên:

- Có tính năng tương tự chưa? Tái dùng pattern đó.
- Có component/helper/service đã giải quyết một phần chưa?
- Có cần thêm bảng, hay dùng bảng sẵn có?

Không tạo hệ thống song song với thứ đã tồn tại.

## Bước 3 — Chốt phạm vi thay đổi

Liệt kê trước khi làm:

```
Schema:      <bảng/cột thay đổi, hoặc "không đổi">
Server:      <file trong src/server/**>
API:         <route handler / server action>
UI:          <màn hình + component>
Quyền:       <vai trò nào truy cập được, scope ra sao>
Audit:       <hành động nào cần ghi log>
Thông báo:   <sự kiện nào cần notification>
Test:        <những gì sẽ được test>
```

Nếu có thay đổi schema → **dừng, hỏi người dùng**, rồi dùng skill `db-migration`.

## Bước 4 — Triển khai theo thứ tự

1. **Schema** (nếu cần) — qua `db-migration`.
2. **Logic server** trong `src/server/<domain>/` — hàm thuần, không import React, có test.
3. **Phân quyền** — áp `resolveScope(user)`, kiểm quyền ở server.
4. **API layer** — route handler / server action, validate input bằng Zod.
5. **Audit + notification** — qua helper tập trung, cùng transaction với thay đổi dữ liệu.
6. **UI** — tái dùng component sẵn có, đủ 5 trạng thái (loading / empty / error / success / no-permission).

Xây **phiên bản nhỏ nhất hoàn chỉnh** trước. Không thêm tính năng phụ chưa ai yêu cầu.

## Bước 5 — Xác minh

```bash
npm run typecheck
npm run lint
npm test
npm run build     # khi đụng app/ hoặc build config
```

Tự kiểm thủ công:
- Luồng chính chạy đúng từ đầu tới cuối.
- Thử với **vai trò thấp nhất** — có rò rỉ dữ liệu ngoài phạm vi không?
- Trạng thái empty và error hiển thị đúng.
- Số liệu khớp với nguồn (nếu là màn hình dữ liệu).

## Bước 6 — Báo cáo

Ngắn gọn, đúng sự thật:
- Đã làm gì.
- File thay đổi.
- Lệnh kiểm thử đã chạy và kết quả **thật** (fail thì nói fail, kèm output).
- Phần chưa làm được và vì sao.
- Rủi ro còn lại.

## Chống lệch hướng

Không refactor code ngoài phạm vi. Không đổi tên biến không liên quan. Không format lại file khác. Không thêm dependency mới mà chưa hỏi.
