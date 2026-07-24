# 15 — Thông báo

**Phụ thuộc**: [06 — Workflow báo cáo](06-workflow-bao-cao.md), [14 — Cảnh báo](14-canh-bao.md)

## Mục tiêu

Đưa việc cần làm tới đúng người đúng lúc (mục 22 đặc tả), thay vì bắt họ vào hệ thống kiểm tra.

## Danh sách sự kiện

| Sự kiện | Gửi cho | Khi nào |
|---|---|---|
| Chưa nhập báo cáo | Nhân viên | Cuối ngày làm việc, nếu chưa có báo cáo |
| Leader chưa duyệt | Leader | Có báo cáo `SUBMITTED` quá 24h |
| Báo cáo bị từ chối | Người nhập | Ngay khi `REJECTED` |
| Báo cáo được duyệt | Người nhập | Ngay khi `APPROVED` |
| KPI dưới 80% | Nhân viên + Leader | Sau rollup hằng ngày |
| KPI sắp không đạt | Nhân viên + Leader | Khi forecast < 100% |
| Campaign vượt ngân sách | Manager + người phụ trách | Ngay khi phát hiện |
| KPI hoàn thành | Nhân viên + Leader | Khi đạt 100% mục tiêu kỳ |
| Sync ads thất bại | Admin | Ngay khi job fail |

## Dữ liệu

Đã có `notifications`: `user_id`, `type`, `title`, `body`, `link_url`, `read_at`, `dedupe_key`.

Unique `(user_id, dedupe_key)` — đây là cơ chế chống trùng ở tầng DB, không chỉ ở tầng code.

## Quy tắc chống làm phiền

Đây là phần quyết định thông báo có được dùng hay bị tắt hết.

1. **`dedupe_key` phải chứa đủ ngữ cảnh** để tránh gửi lại cùng một việc:
   ```
   kpi-below-80:{userId}:{period}
   report-pending:{reportId}
   campaign-over-budget:{campaignId}:{date}
   ```
2. **Gộp theo lô**: 12 báo cáo chờ duyệt → **một** thông báo "Bạn có 12 báo cáo chờ duyệt", không phải 12 thông báo.
3. **Không gửi lại khi tình trạng chưa đổi.** KPI vẫn dưới 80% ngày thứ hai → không gửi lại.
4. **Giờ yên tĩnh**: không gửi ngoài giờ làm việc (cấu hình được), trừ mức `CRITICAL`.
5. **Không thông báo về việc người dùng vừa tự làm.** Vừa submit báo cáo xong không cần báo "bạn đã submit".

## Cần xây

### `src/server/notifications/`

```
create.ts    # createNotification(tx, {userId, type, title, body, linkUrl, dedupeKey})
dispatch.ts  # gom sự kiện → danh sách người nhận theo scope → tạo notification
digest.ts    # gộp theo lô cho job cuối ngày
```

`createNotification` nhận `tx` — tạo trong **cùng transaction** với thay đổi dữ liệu gây ra nó.

### UI

- **Chuông trên header** — số chưa đọc, dropdown 10 thông báo gần nhất
- **`/notifications`** — danh sách đầy đủ, lọc theo loại và trạng thái đọc, đánh dấu đã đọc từng cái hoặc tất cả
- Mỗi thông báo có `link_url` dẫn thẳng tới màn hình cần xử lý

## Phân quyền

Người nhận xác định qua **`resolveScope`**, không phải danh sách cứng.

- Thông báo về nhân viên A → gửi A và Leader của A (theo cây phòng ban tại thời điểm gửi)
- **Không nhét số liệu nhạy cảm vào tiêu đề** — tiêu đề hiện ở dropdown và có thể hiện trên màn hình khoá nếu sau này làm push notification

## Edge case

- Người dùng bị vô hiệu hoá → không gửi, không lỗi
- Leader chưa được gán cho phòng ban → gửi lên Manager thay thế
- Nhân viên thuộc nhiều nhóm nhận cùng một thông báo → `dedupe_key` unique đã chặn trùng
- Thông báo cũ tích tụ → tự động dọn thông báo đã đọc quá 90 ngày (job riêng, ghi log số dòng xoá)
- Link trong thông báo trỏ tới bản ghi đã xoá → hiện "Nội dung không còn tồn tại", không lỗi 500

## Test bắt buộc

- `dedupe_key` chặn gửi trùng khi tình trạng chưa đổi
- Gộp lô: 12 báo cáo chờ duyệt → 1 thông báo
- Không gửi cho người ngoài scope
- Transaction rollback → notification cũng rollback

## Tiêu chí hoàn thành

- [ ] Đủ 9 loại sự kiện trong bảng trên
- [ ] Chống trùng qua `dedupe_key`, có test
- [ ] Gộp theo lô cho thông báo cuối ngày
- [ ] Chuông + trang danh sách hoạt động, đánh dấu đã đọc
- [ ] Mọi thông báo có link dẫn tới màn hình xử lý
- [ ] Người nhận xác định qua scope, không rò rỉ dữ liệu
- [ ] Tiêu đề không chứa số liệu nhạy cảm
