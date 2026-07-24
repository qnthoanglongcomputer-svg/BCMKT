---
name: new-kpi-metric
description: Quy trình thêm một chỉ số KPI mới vào MPMS (ví dụ Saves, Organic Reach, tỷ lệ audit POSM) — khai báo định nghĩa metric, chiều tốt/xấu, công thức, phân bổ theo kỳ, trọng số, rollup và hiển thị. Dùng khi cần bổ sung metric mới cho bất kỳ bộ phận nào.
---

# Thêm chỉ số KPI mới

Metric trong MPMS là **dữ liệu cấu hình**, không phải code. Nếu phải sửa nhiều file chỉ để thêm một metric, thiết kế đang sai — dừng lại và báo.

## Bước 1 — Định nghĩa metric

Trả lời đủ trước khi làm:

| Thuộc tính | Câu hỏi |
|---|---|
| `code` | Mã duy nhất, SCREAMING_SNAKE (`ORGANIC_REACH`) |
| `name` | Tên hiển thị tiếng Việt |
| `unit` | Đơn vị: số lượng / VND / % / tỷ lệ / giờ |
| `direction` | `HIGHER_BETTER` hay `LOWER_BETTER`? (CPA, CPC, chi phí, lỗi, trễ deadline là `LOWER_BETTER`) |
| `aggregation` | `SUM` (cộng dồn) hay `RATIO` (tính lại từ tử/mẫu)? |
| `numerator`/`denominator` | Nếu là `RATIO`: tử và mẫu là metric nào? |
| `source` | Nhập tay, hay lấy từ connector ads, hay tính từ metric khác? |
| `owner_types` | Áp dụng cho cấp nào: công ty / bộ phận / team / nhân viên |
| `cap` | Trần achievement, mặc định 120% |

**Sai lầm hay gặp**: khai CPA là `SUM`. CPA là `RATIO` = tổng chi phí / tổng lead. Cộng dồn hay lấy trung bình CPA đều cho số sai.

## Bước 2 — Kiểm tra trùng lặp

Grep trong `kpi_definitions` seed và `src/server/kpi/`: metric này đã tồn tại dưới tên khác chưa? Có thể suy ra từ metric sẵn có không? Nếu có → dùng cái đã có, đừng tạo nguồn sự thật thứ hai.

## Bước 3 — Khai báo

1. Thêm bản ghi vào `kpi_definitions` (seed hoặc màn hình admin). **Không hardcode trong code.**
2. Metric `RATIO`: khai `numerator`/`denominator` trỏ tới metric `SUM` đã có. Nếu tử/mẫu chưa có, tạo chúng trước.
3. Metric lấy từ ads: bổ sung field vào `NormalizedAdsRow` và map ở từng connector — xem skill `ads-connector`.

## Bước 4 — Phân bổ và trọng số

- Metric cần đặt mục tiêu năm → đảm bảo chạy được qua allocation (`EVEN` / `WEIGHTED` / `MANUAL`).
- Metric `RATIO` thường **không phân bổ theo kỳ** (không chia nhỏ CPA mục tiêu theo ngày được) — đặt mục tiêu cố định cho từng kỳ thay vì chia. Xác nhận cách xử lý với người dùng.
- Thêm metric vào nhóm trọng số của vị trí liên quan → **tổng weight nhóm đó phải vẫn = 100%**. Thêm metric mới nghĩa là phải điều chỉnh weight các metric cũ. Hỏi người dùng con số cụ thể, đừng tự chia.

## Bước 5 — Rollup

- `SUM`: engine tự cộng theo cây, không cần code thêm.
- `RATIO`: engine tính lại từ tử/mẫu đã cộng dồn. Kiểm tra `src/server/kpi/rollup.ts` xử lý đúng `direction` và mẫu = 0 (trả `null`, không chia cho 0).

## Bước 6 — Hiển thị

- Thêm vào dashboard bộ phận liên quan theo đúng nhóm trong đặc tả (mục 7 của [motaduan.md](../../../motaduan.md)).
- Định dạng qua `src/lib/format.ts` theo `unit`.
- Metric `LOWER_BETTER`: chiều màu/mũi tên phải **ngược lại** — CPA giảm là tốt. Đây là chỗ dễ hiển thị sai nhất, kiểm kỹ.

## Bước 7 — Test bắt buộc

- Scoring với `direction` đúng chiều.
- Rollup ra số đúng trên cây 3 tầng.
- Mẫu số = 0.
- Target = 0 → metric bị loại và weight được chuẩn hoá lại.

```bash
npm test && npm run typecheck
```

## Bước 8 — Báo cáo

Metric đã thêm (đầy đủ thuộc tính), weight các metric cũ đã điều chỉnh ra sao, màn hình nào đã hiển thị, test đã chạy, dữ liệu lịch sử có cần tính lại không.
