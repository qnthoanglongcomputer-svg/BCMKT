# Quy tắc dữ liệu — MPMS

Đây là hệ thống mà con số **là** sản phẩm. Sai số liệu nghiêm trọng hơn sai giao diện.

## Kiểu số

| Loại dữ liệu | Kiểu DB | Kiểu code |
|---|---|---|
| Tiền (doanh thu, chi phí, CPA, AOV) | `Decimal(18,2)` | `Decimal` (decimal.js) |
| Tỷ lệ, trọng số, achievement | `Decimal(9,4)` | `Decimal` |
| Số lượng (lead, video, bài, click) | `Int` | `number` |
| Điểm KPI | `Decimal(9,4)` | `Decimal` |

**Cấm tuyệt đối `Float`/`number` cho dữ liệu tiền tệ và tỷ lệ.** `0.1 + 0.2 !== 0.3` trong IEEE 754 — với hệ thống báo cáo tài chính đây là lỗi không chấp nhận được.

Không `parseFloat` rồi cộng. Không `Number(decimal)` rồi tính. Giữ `Decimal` xuyên suốt, chỉ chuyển sang string/number ở tầng hiển thị.

## Metric cộng dồn vs metric tỷ lệ

Đây là nguồn sai số liệu phổ biến nhất trong hệ thống loại này.

- **SUM** (Lead, doanh thu, chi phí, số video, số bài): cộng dồn thẳng lên cây tổ chức và lên các kỳ lớn hơn.
- **RATIO** (CPA, CPC, CTR, ROAS, AOV, ROS): **tính lại từ tử số và mẫu số đã cộng dồn**.

```
SAI:  CPA_phòng = (CPA_A + CPA_B) / 2
ĐÚNG: CPA_phòng = (chi_phí_A + chi_phí_B) / (lead_A + lead_B)
```

Vì vậy `kpi_actuals` lưu `numerator_sum` và `denominator_sum` cho metric RATIO — không lưu mỗi giá trị tỷ lệ.

Mẫu số bằng 0 → trả `null` (chưa xác định), **không trả 0**, không chia cho 0. UI hiển thị `—`, không hiển thị `0`.

## Chiều tốt/xấu

`kpi_definitions.direction` quyết định công thức achievement:

- `HIGHER_BETTER`: `actual / target`
- `LOWER_BETTER`: `target / actual` — CPA, CPC, chi phí, lỗi thiết kế, trễ deadline, ROS

**Không suy đoán chiều theo tên metric.** Luôn đọc từ DB. Thêm metric mới phải khai `direction` tường minh.

Trên UI, metric `LOWER_BETTER` có chiều màu và mũi tên **ngược lại**: CPA giảm là tin tốt, hiển thị xanh và mũi tên xuống.

## Ngày tháng và múi giờ

- Múi giờ nghiệp vụ duy nhất: **`Asia/Ho_Chi_Minh`**.
- Cột ngày lịch dùng `@db.Date`, không dùng `DateTime` đầy đủ.
- Trong code, ngày lịch biểu diễn bằng `Date` ở **UTC-midnight**. Mọi phép tính dùng hàm `getUTC*`/`Date.UTC` để không lệch theo timezone của máy chạy.
- Dữ liệu từ nền tảng quảng cáo phải quy về `Asia/Ho_Chi_Minh` **tại connector**, trước khi gán `date`. Nền tảng trả theo timezone tài khoản của họ.
- Năm nhuận: 366 ngày. Không hardcode 365 ở bất kỳ đâu.
- Tuần: ISO (Thứ Hai → Chủ Nhật), cắt về trong phạm vi năm khi phân bổ.

## Bất biến của KPI

Phải luôn đúng, có test bảo vệ:

1. `SUM(12 tháng) = SUM(4 quý) = SUM(các tuần) = SUM(các ngày) = mục tiêu năm`
2. Sai số làm tròn dồn vào phần tử **cuối cùng**, không rải đều
3. Phân bổ lại là **idempotent**: cùng input → cùng output, chạy 2 lần không nhân đôi
4. Tuần vắt qua ranh giới tháng được tách theo số ngày thuộc từng tháng
5. `target = 0` → metric bị loại khỏi chấm điểm, trọng số còn lại được chuẩn hoá lại

## Làm tròn

- Mục tiêu và giá trị thực: 2 chữ số thập phân (`Decimal.ROUND_HALF_UP`).
- Tỷ lệ và điểm: 4 chữ số thập phân.
- **Chỉ làm tròn ở bước cuối**, không làm tròn giữa chừng rồi tính tiếp — sai số tích luỹ.
- Hiển thị làm tròn ít hơn lưu trữ, nhưng đừng để tổng hiển thị lệch tổng thật.

## Nguồn sự thật

- `kpi_day` là hạt nhân. Các cấp kỳ lớn hơn là **vật chất hoá** từ engine — không sửa tay, luôn sinh lại được.
- Bảng summary (`kpi_summary`, `performance_summary`) là cache để đọc nhanh, có thể xoá và tính lại bất cứ lúc nào.
- Chỉ report trạng thái `APPROVED` mới vào rollup và dashboard chính thức.
- Dữ liệu ads chỉ lưu số nguyên liệu; mọi metric tỷ lệ do engine tính. Hai nguồn sự thật cho cùng một con số là lỗi thiết kế.

## Idempotency

Mọi job ghi dữ liệu phải chạy lại được an toàn:

- Sync ads: `upsert` theo `(platform, account_id, entity_id, date)`, không `insert` mù.
- Rollup: xoá và ghi lại cho kỳ đó trong một transaction, hoặc upsert theo khoá unique.
- Phân bổ KPI: xoá `kpi_targets` cũ của plan rồi sinh lại, trong một transaction.

## Xoá dữ liệu

- Soft delete (`deleted_at`) cho `users`, `departments`, `campaigns`.
- **Không xoá cứng** `kpi_targets`, `kpi_actuals`, `reports`, `audit_log` trong mọi trường hợp.
- Mọi truy vấn trên bảng có soft delete phải lọc `deleted_at: null`.
