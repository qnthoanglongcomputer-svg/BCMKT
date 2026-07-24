# 04 — Lập kế hoạch KPI năm

**Phụ thuộc**: [01 — Auth](01-auth-phan-quyen.md), [02 — Tổ chức](02-quan-ly-to-chuc.md) · **Engine đã có**: `src/server/kpi/allocation.ts`

## Mục tiêu

Chức năng quan trọng nhất hệ thống (mục 4 đặc tả). Admin nhập KPI **một lần cho cả năm**, hệ thống tự sinh xuống Quý → Tháng → Tuần → Ngày cho mọi cấp trong cây tổ chức.

## Vai trò

- `ADMIN`: tạo, sửa, phân bổ lại KPI cho mọi cấp
- `MARKETING_MANAGER`: xem toàn bộ, duyệt kế hoạch
- `LEADER` / `EMPLOYEE`: chỉ xem KPI thuộc phạm vi của mình

## Dữ liệu

Đã có: `kpi_plans` (year, owner_type, owner_id, kpi_definition_id, year_target, strategy, month_weights, locked_months), `kpi_targets` (kết quả phân bổ). Không cần migration.

## Luồng chính

```
Chọn năm + cấp sở hữu (Công ty/Bộ phận/Team/Nhân viên)
        ↓
Chọn metric + nhập mục tiêu năm      (VD: Lead = 72.000)
        ↓
Chọn chiến lược phân bổ
   ├── EVEN      → chia theo số ngày thực của từng tháng
   ├── WEIGHTED  → nhập tỷ trọng 12 tháng, tổng phải = 100%
   └── MANUAL    → khoá một số tháng, hệ thống cân lại phần còn lại
        ↓
Xem trước bảng phân bổ (12 tháng · 4 quý · ~53 tuần · 365/366 ngày)
        ↓
Lưu → sinh kpi_targets cho tất cả các cấp kỳ, trong 1 transaction
```

## Màn hình

### `/kpi/planning` — Danh sách kế hoạch
Bảng: năm · cấp · đối tượng · metric · mục tiêu năm · chiến lược · trạng thái. Lọc theo năm, bộ phận, metric.

### `/kpi/planning/new` và `/kpi/planning/[id]` — Nhập & phân bổ
Ba khối:
1. **Thông tin chung** — năm, cấp sở hữu, đối tượng, metric, mục tiêu năm
2. **Chiến lược phân bổ** — chọn 1 trong 3, form đổi theo lựa chọn
3. **Xem trước** — bảng 12 tháng + biểu đồ cột, **tổng luôn hiển thị ở cuối để đối chiếu**

Nút Lưu chỉ bật khi phân bổ hợp lệ.

## Quy tắc nghiệp vụ

Engine đã đảm bảo (có test):

1. `SUM(12 tháng) = SUM(4 quý) = SUM(tuần) = SUM(ngày) = mục tiêu năm` — tuyệt đối
2. Sai số làm tròn dồn vào phần tử **cuối cùng**
3. `EVEN` chia theo **số ngày thực** (tháng 1 có 31 ngày > tháng 2 có 28)
4. Năm nhuận 366 ngày
5. Tuần vắt qua ranh giới tháng tách theo số ngày thuộc từng tháng
6. `WEIGHTED` tổng ≠ 100% → từ chối kèm số cụ thể
7. `MANUAL` tổng khoá > mục tiêu → **từ chối, không tự cắt bớt**
8. Phân bổ lại **idempotent**

Tầng UI/service cần thêm:

- Lưu = **xoá `kpi_targets` cũ của plan rồi sinh lại**, trong một transaction. Không cộng dồn.
- Sửa kế hoạch đã có dữ liệu thực tế → **cảnh báo rõ**: "% đạt của các kỳ đã qua sẽ thay đổi". Yêu cầu xác nhận.
- Ghi audit: mục tiêu cũ → mục tiêu mới, chiến lược cũ → mới.

## Metric RATIO — quyết định cần xác nhận

Metric tỷ lệ (CPA, ROAS, CTR, AOV, ROS) **không chia nhỏ theo kỳ được** — "CPA mục tiêu 100.000₫" không thể chia cho 12 tháng.

Cách xử lý: đặt **cùng một giá trị mục tiêu cho mọi kỳ**, không phân bổ. UI phải ẩn phần chọn chiến lược khi metric là RATIO và nói rõ lý do.

> ⚠️ Cần người dùng xác nhận cách này trước khi code.

## Edge case

- Mục tiêu năm = 0 → chấp nhận (metric không áp dụng kỳ này), mọi kỳ con = 0
- Mục tiêu âm → từ chối
- Đổi chiến lược từ WEIGHTED sang EVEN → xoá `month_weights`, sinh lại
- Hai plan trùng `(year, owner_type, owner_id, kpi_definition_id)` → unique constraint chặn, thông báo rõ đã tồn tại
- Tạo plan cho phòng ban đã vô hiệu hoá → chặn
- Năm ngoài khoảng 2000–2100 → từ chối

## Test bắt buộc

Engine đã có 23 test cho allocation. Thêm ở tầng service:
- Lưu 2 lần cùng input → không nhân đôi `kpi_targets`
- Đổi mục tiêu → target cũ bị xoá sạch, không còn sót
- Transaction fail → không để lại target nửa vời

## Tiêu chí hoàn thành

- [ ] Nhập KPI năm một lần, sinh đủ 4 cấp kỳ trong DB
- [ ] Cả 3 chiến lược hoạt động đúng, có xem trước
- [ ] Tổng ở mọi cấp kỳ luôn khớp mục tiêu năm — kiểm bằng query thật trên DB
- [ ] Lưu lại nhiều lần không nhân đôi dữ liệu
- [ ] Thông báo lỗi tiếng Việt, nêu số cụ thể
- [ ] Cảnh báo khi sửa kế hoạch đã có dữ liệu thực tế
- [ ] Audit log ghi đủ thay đổi
- [ ] Đã chốt cách xử lý metric RATIO với người dùng
