# 14 — Cảnh báo thông minh

**Phụ thuộc**: [05 — Chấm điểm](05-kpi-trong-so-cham-diem.md), [08 — Campaign](08-quan-ly-campaign.md)

## Mục tiêu

Hệ thống chủ động chỉ ra vấn đề (mục 14 đặc tả), thay vì bắt người dùng tự mò trong dashboard.

## Bộ cảnh báo (đã seed 5 rule)

| Mã | Nội dung | Mức |
|---|---|---|
| `CPA_OVER_TARGET` | CPA vượt mục tiêu > 10% | CRITICAL |
| `LEAD_DECLINING` | Lead giảm liên tục 3 ngày | WARNING |
| `KPI_BELOW_80` | Điểm KPI dưới 80 | WARNING |
| `FORECAST_MISS` | Dự báo cuối kỳ không đạt mục tiêu | WARNING |
| `CAMPAIGN_OVER_BUDGET` | Campaign vượt ngân sách | CRITICAL |

Cần bổ sung theo đặc tả: Content không đạt · Trade chưa audit · Video thiếu.

## Nguyên tắc thiết kế

1. **Ngưỡng là dữ liệu, không phải code.** Lưu ở `alert_rules.condition` (JSON), admin sửa được qua UI. Không hardcode số 80, 10% trong code.
2. **Chống nhiễu là yêu cầu cốt lõi.** Cảnh báo quá nhiều = không ai đọc = vô dụng.
3. **Mỗi cảnh báo phải hành động được.** Nêu rõ: cái gì sai · sai bao nhiêu · ảnh hưởng ai · nên làm gì.

## Dữ liệu

Đã có: `alert_rules` (code, name, kpi_definition_id, severity, condition, is_active), `alerts` (rule_id, owner_type, owner_id, severity, message, evidence, triggered_at, resolved_at).

## Rule engine — `src/server/alerts/`

```
evaluate.ts    # chạy các rule trên dữ liệu đã rollup, trả Alert[]
operators.ts   # gt, lt, declining, forecastLt — hàm thuần, có test
dedupe.ts      # gộp và chống lặp
```

Chạy **sau rollup**, trong cron job. Không chạy đồng bộ khi người dùng mở dashboard.

### Cấu trúc `condition`

```json
{ "operator": "gt", "thresholdRatio": 1.1 }
{ "operator": "declining", "consecutiveDays": 3 }
{ "operator": "lt", "thresholdScore": 80 }
{ "operator": "forecastLt", "thresholdRatio": 1 }
```

Thêm operator mới = thêm hàm trong `operators.ts` + test. Không sửa cấu trúc bảng.

## Chống nhiễu

- **Gộp trùng**: cùng rule + cùng đối tượng + tình trạng chưa đổi → **không tạo alert mới**, cập nhật `triggered_at` của alert đang mở.
- **Tự đóng**: tình trạng đã khắc phục → set `resolved_at`, không để alert treo mãi.
- **Giới hạn hiển thị**: dashboard hiện tối đa 5 cảnh báo nghiêm trọng nhất, còn lại vào trang `/alerts`.
- **Không cảnh báo khi chưa đủ dữ liệu**: `FORECAST_MISS` không kích hoạt khi < 3 ngày dữ liệu.

## Nội dung cảnh báo

Mỗi alert lưu `evidence` (JSON) để giải thích được, không chỉ một câu chữ:

```json
{
  "message": "CPA của Facebook Ads vượt mục tiêu 18%",
  "evidence": {
    "metric": "CPA", "target": 100000, "actual": 118000,
    "period": "2026-07", "trend7d": "+12%"
  }
}
```

UI hiển thị: mức độ · thông điệp · số liệu chứng minh · link tới màn hình liên quan.

## Màn hình

### Khối cảnh báo trên dashboard
5 cảnh báo nghiêm trọng nhất trong scope. Mỗi dòng click sang màn hình liên quan.

### `/alerts` — Trung tâm cảnh báo
Lọc theo mức độ, đối tượng, trạng thái (đang mở / đã đóng), khoảng thời gian. Phân trang server.

### `/admin/alert-rules` — Cấu hình
Bảng rule, bật/tắt, sửa ngưỡng. Xem trước: "Với dữ liệu 30 ngày qua, rule này sẽ tạo N cảnh báo" — giúp admin chỉnh ngưỡng hợp lý trước khi bật.

## Phân quyền

Alert chỉ gửi tới người **trong scope**. `EMPLOYEE` chỉ thấy cảnh báo về KPI của chính mình. Không broadcast dữ liệu ra ngoài phạm vi quyền.

## Edge case

- Rule tham chiếu metric đã vô hiệu hoá → tự tắt rule, báo admin
- Đối tượng bị xoá (nhân viên nghỉ việc) → đóng các alert đang mở
- Dữ liệu về muộn làm alert kích hoạt rồi tự đóng ngay → không gửi notification nếu alert đóng trong vòng 1 giờ
- Toàn bộ bộ phận cùng vi phạm một rule → gộp thành một alert cấp bộ phận, không tạo 20 alert cá nhân

## Test bắt buộc

- Từng operator: `gt`, `lt`, `declining`, `forecastLt` — hàm thuần
- Gộp trùng: chạy rule 2 lần trên cùng dữ liệu → không tạo alert thứ hai
- Tự đóng khi tình trạng khắc phục
- Alert không rò rỉ ra ngoài scope

## Tiêu chí hoàn thành

- [ ] Đủ 8 rule theo đặc tả, ngưỡng lưu ở DB
- [ ] Rule engine là hàm thuần, có test cho từng operator
- [ ] Chống trùng và tự đóng hoạt động, có test
- [ ] Mỗi alert có `evidence` giải thích được
- [ ] Admin sửa ngưỡng qua UI, có xem trước số lượng cảnh báo
- [ ] Alert tôn trọng scope, đã thử với `EMPLOYEE`
