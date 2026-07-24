# 06 — Nhập báo cáo & workflow duyệt

**Phụ thuộc**: [01 — Auth](01-auth-phan-quyen.md), [04 — KPI Planning](04-kpi-planning.md)

## Mục tiêu

Nhân viên nhập số liệu hằng ngày, Leader duyệt, Manager duyệt (mục 10 đặc tả). **Chỉ dữ liệu đã duyệt mới vào rollup và dashboard chính thức.**

## Luồng trạng thái

```
DRAFT ──submit──▶ SUBMITTED ──approve──▶ APPROVED
                      │                      │
                      └──reject──▶ REJECTED  │
                                     │       │
                                     └─sửa───┘
                                             │
                          reopen (Admin/Manager) ◀┘
```

| Trạng thái | Nhân viên sửa được? | Vào rollup? |
|---|---|---|
| `DRAFT` | Có | Không |
| `SUBMITTED` | **Không** (đã khoá) | Không |
| `APPROVED` | Không (bất biến) | **Có** |
| `REJECTED` | Có | Không |

## Vai trò

- `EMPLOYEE`: tạo/sửa báo cáo của mình, submit
- `LEADER`: duyệt báo cáo trong subtree — **không tự duyệt báo cáo của chính mình**
- `MARKETING_MANAGER`: duyệt toàn phòng, mở lại (`reopen`) báo cáo đã duyệt
- `ADMIN`: toàn quyền

## Dữ liệu

Đã có: `reports` (author_id, department_id, campaign_id, report_date, status, submitted_at, reviewed_at, reviewer_id, reject_reason), `report_details` (kpi_definition_id, value, hours_spent), `attachments`.

Unique: `(author_id, report_date, campaign_id)` — một người một ngày một campaign chỉ một báo cáo.

## Cần xây

### `src/server/reports/workflow.ts` — **điểm duy nhất** chuyển trạng thái

```ts
submitReport(reportId, actor)
approveReport(reportId, actor)
rejectReport(reportId, actor, reason)   // reason bắt buộc
reopenReport(reportId, actor, reason)   // chỉ ADMIN / MANAGER
```

Mỗi hàm, trong **một transaction**:
1. Kiểm quyền theo scope
2. Kiểm trạng thái nguồn hợp lệ → không hợp lệ thì ném lỗi tường minh (`409`)
3. Cập nhật trạng thái + timestamp + reviewer
4. Ghi `audit_log`
5. Tạo `notification` cho người liên quan
6. Nếu `APPROVED` → kích hoạt rollup cho kỳ đó

**Không set `status` trực tiếp ở bất kỳ nơi nào khác.**

### Màn hình

- `/reports/new` — form nhập theo metric của vị trí người dùng, có `hours_spent` cho vị trí sáng tạo (Designer/Editor/Content)
- `/reports` — danh sách báo cáo của tôi, lọc theo trạng thái và kỳ
- `/reports/approvals` — hàng chờ duyệt (chỉ Leader/Manager), duyệt hàng loạt được
- `/reports/[id]` — chi tiết, lịch sử chuyển trạng thái

## Quy tắc nghiệp vụ

- Form nhập chỉ hiện metric thuộc nhóm trọng số của vị trí người dùng — không bắt nhập 32 metric.
- Giá trị nhập validate theo `unit` của metric: số lượng là `Int`, tiền là `Decimal ≥ 0`.
- `reject` **bắt buộc có lý do**, hiển thị cho người nhập.
- `reopen` báo cáo `APPROVED` → phải ghi lý do vào audit, và **rollup phải tính lại** cho kỳ đó.
- Báo cáo ngày tương lai → chặn.
- Báo cáo quá hạn (quá N ngày, cấu hình được) → cho nhập nhưng đánh dấu trễ và thông báo Leader.

## Edge case

- Nhân viên submit rồi phát hiện sai → không sửa được, phải nhờ Leader `reject` để mở lại
- Leader duyệt đúng lúc nhân viên đang sửa → transaction + kiểm trạng thái nguồn chặn được race condition
- Nhân viên nghỉ việc (`is_active = false`) còn báo cáo `SUBMITTED` → Manager vẫn duyệt được
- Báo cáo không gắn campaign → hợp lệ, `campaign_id = null`
- Duyệt hàng loạt mà một báo cáo lỗi → **không rollback cả lô**, báo rõ cái nào thành công cái nào không

## Test bắt buộc

- Mọi cặp chuyển trạng thái hợp lệ thành công
- Mọi cặp không hợp lệ bị từ chối (`APPROVED → SUBMITTED`, `DRAFT → APPROVED`)
- Tự duyệt báo cáo của chính mình → bị chặn ở mọi vai trò
- `SUBMITTED` không sửa được bởi tác giả
- Transaction rollback → audit cũng rollback
- Chỉ `APPROVED` được đưa vào rollup

## Tiêu chí hoàn thành

- [ ] Đủ 4 trạng thái, chuyển đúng luồng
- [ ] Chuyển trạng thái chỉ qua `workflow.ts`, grep không thấy `status:` set ở nơi khác
- [ ] Không ai tự duyệt được báo cáo của mình
- [ ] Audit + notification ghi đủ cho mọi lần chuyển
- [ ] Rollup chỉ nhận dữ liệu `APPROVED`
- [ ] `reopen` kích hoạt tính lại rollup
- [ ] Form chỉ hiện metric liên quan tới vị trí người dùng
