# 05 — Trọng số & chấm điểm KPI

**Phụ thuộc**: [04 — KPI Planning](04-kpi-planning.md) · **Engine đã có**: `src/server/kpi/scoring.ts`, `grading.ts`

## Mục tiêu

Mỗi vị trí có bộ KPI riêng với trọng số riêng (mục 5 đặc tả). Hệ thống tự tính **điểm KPI 0–120** và **xếp loại A+/A/B/C/D** (mục 15).

## Vai trò

- `ADMIN`: cấu hình nhóm trọng số cho từng vị trí/phòng ban
- `MARKETING_MANAGER`: xem toàn bộ, đề xuất điều chỉnh
- `LEADER` / `EMPLOYEE`: xem trọng số áp dụng cho mình

## Dữ liệu

Đã có: `kpi_weight_groups` (position_id | department_id, effective_year), `kpi_weights` (group_id, kpi_definition_id, weight).

Seed đã tạo 3 nhóm mẫu:

| Vị trí | Trọng số |
|---|---|
| Ads Performance | Lead 40% · CPA 20% · ROAS 20% · Doanh thu 20% |
| Editor | Video Ads 40% · TikTok 20% · Deadline 20% · Chất lượng 20% |
| Designer | Deadline 30% · Lỗi thiết kế 30% · Feedback 20% · Số lượng 20% |

## Công thức (engine đã cài, có test)

```
achievement_i = actual_i / target_i                (HIGHER_BETTER)
achievement_i = target_i / actual_i                (LOWER_BETTER)
achievement_i = min(achievement_i, cap)            cap mặc định 1.2
score         = Σ (achievement_i × weight_chuẩn_hoá_i) × 100
```

Xếp loại: `≥95 A+` · `90–94.99 A` · `80–89.99 B` · `70–79.99 C` · `<70 D`

Ngưỡng nằm ở `src/server/kpi/grading.ts` — **nguồn duy nhất**, không hardcode nơi khác.

## Quy tắc nghiệp vụ

1. **Tổng weight trong một nhóm phải = 100%** — validate lúc lưu, không phải lúc chấm điểm.
2. `direction` đọc từ `kpi_definitions`, **không suy đoán theo tên metric**.
3. `target = 0` → metric bị **loại** khỏi công thức, trọng số các metric còn lại được **chuẩn hoá lại**. Không bao giờ chia cho 0.
4. `LOWER_BETTER` với `actual = 0` → trả trần (chi phí 0 là tốt nhất), không chia cho 0.
5. Nhóm trọng số có `effective_year` — đổi trọng số giữa năm **không làm thay đổi điểm của các kỳ đã qua**. Tạo nhóm mới cho năm sau thay vì sửa nhóm cũ.
6. Thêm metric mới vào nhóm → **phải điều chỉnh weight các metric cũ** để tổng vẫn 100%. Hỏi người dùng con số cụ thể, đừng tự chia.

## Màn hình

### `/kpi/weights` — Danh sách nhóm trọng số
Bảng: tên nhóm · vị trí/phòng ban · năm áp dụng · số metric · tổng weight (highlight đỏ nếu ≠ 100%)

### `/kpi/weights/[id]` — Chỉnh nhóm
- Danh sách metric trong nhóm, mỗi dòng có slider/input weight
- **Thanh tổng luôn hiển thị**, đổi màu khi ≠ 100%
- Nút thêm metric từ danh sách `kpi_definitions`
- Nút Lưu bị vô hiệu khi tổng ≠ 100%

### `/kpi/score/[ownerType]/[ownerId]` — Bảng điểm chi tiết
Cho mỗi metric: mục tiêu · thực tế · achievement · weight · đóng góp vào điểm. Dòng cuối: tổng điểm + xếp loại. Metric bị loại hiển thị mờ kèm lý do.

## Edge case

- Vị trí chưa có nhóm trọng số → không chấm điểm được, hiển thị "Chưa cấu hình trọng số cho vị trí này", không crash
- Toàn bộ metric trong nhóm có `target = 0` → điểm 0, hạng D, kèm ghi chú
- Metric trong nhóm bị vô hiệu hoá (`is_active = false`) → loại khỏi tính, chuẩn hoá lại weight, hiện cảnh báo cho admin
- Nhân viên có nhiều vị trí (kiêm nhiệm) → hiện tại schema chỉ cho 1 vị trí. Nếu cần kiêm nhiệm, **hỏi người dùng trước khi đổi schema**.

## Test bắt buộc

Engine đã có 21 test. Thêm ở tầng service:
- Lưu nhóm có tổng ≠ 100% → bị từ chối
- Đổi trọng số năm nay không ảnh hưởng điểm năm trước
- Metric bị vô hiệu hoá được loại và chuẩn hoá lại đúng

## Tiêu chí hoàn thành

- [ ] Cấu hình được nhóm trọng số hoàn toàn qua UI
- [ ] Validate tổng = 100% chặn ở cả UI và server
- [ ] Bảng điểm chi tiết hiển thị đủ: achievement, weight chuẩn hoá, đóng góp
- [ ] Metric bị loại hiển thị rõ lý do, không âm thầm biến mất
- [ ] Điểm và xếp loại khớp với tính tay trên ví dụ trong đặc tả
- [ ] Ghi audit khi đổi trọng số (cũ → mới)
