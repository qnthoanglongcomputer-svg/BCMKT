---
name: ads-connector
description: Quy trình thêm hoặc sửa connector nền tảng quảng cáo trong MPMS (Facebook Ads, Google Ads, TikTok Ads) — chuẩn hoá dữ liệu về schema chung, xử lý múi giờ và tiền tệ, job sync idempotent, rate limit, quản lý token và đối soát số liệu lệch. Dùng khi tích hợp nền tảng mới hoặc khi dữ liệu ads sai/thiếu/trùng.
---

# Connector nền tảng quảng cáo

Dữ liệu từ đây là đầu vào của toàn bộ dashboard Performance. Sai ở tầng này lan ra mọi con số phía sau.

## Bước 1 — Interface chung, không ngoại lệ

```ts
interface AdsConnector {
  platform: 'FACEBOOK' | 'GOOGLE' | 'TIKTOK'
  fetchInsights(range: DateRange, accountId: string): Promise<NormalizedAdsRow[]>
}
```

Thêm nền tảng = thêm một module trong `src/server/integrations/<platform>/`, **không sửa tầng trên**. Nếu buộc phải sửa tầng trên → thiết kế sai, dừng lại và báo.

## Bước 2 — Chuẩn hoá tại connector

`NormalizedAdsRow` chỉ chứa **số nguyên liệu**, không chứa metric tỷ lệ:

```
platform, account_id, campaign_id, adset_id, ad_id, date,
impressions, clicks, spend, conversions, revenue, leads,
video_views, campaign_name, adset_name, ad_name
```

- **Không lưu CTR / CPC / CPA / ROAS lấy từ API.** Chỉ lưu tử và mẫu; KPI engine tính. Hai nguồn sự thật là nguyên nhân lệch số phổ biến nhất.
- Ba điểm bắt buộc kiểm kỹ:
  1. **Múi giờ** — quy về `Asia/Ho_Chi_Minh` trước khi gán `date`. Nền tảng trả theo timezone tài khoản, không phải của bạn.
  2. **Tiền tệ** — quy về VND tại connector; tỷ giá từ cấu hình, không hardcode.
  3. **Định nghĩa conversion** — mỗi nền tảng định nghĩa khác nhau; chọn đúng loại và **ghi chú lý do ngay tại chỗ map**.
- Dùng `Decimal`, không `Float`.

## Bước 3 — Job sync

- **Idempotent** theo khoá `(platform, account_id, entity_id, date)` — dùng `upsert`, tuyệt đối không `insert` mù.
- **Backfill** mặc định 7 ngày gần nhất mỗi lần chạy: nền tảng cập nhật số liệu hồi tố. Khoảng backfill là cấu hình, không hardcode.
- Chia nhỏ theo ngày và theo account; không kéo một request khổng lồ.
- Ghi sync log mỗi lần chạy: thời điểm, phạm vi, số dòng, trạng thái, lỗi. Hiển thị được ở màn hình admin.

## Bước 4 — Rate limit và lỗi

- Tôn trọng giới hạn API của từng nền tảng; đọc header rate limit khi có.
- Retry exponential backoff + jitter, giới hạn số lần thử.
- Phân biệt lỗi tạm thời (429, 5xx → retry) và lỗi vĩnh viễn (401, 403, tham số sai → dừng, báo admin).
- **Không nuốt lỗi.** Sync fail phải nhìn thấy trên UI và tạo notification.

## Bước 5 — Token

- Lưu mã hoá, đọc từ env hoặc secret store.
- **Không log token, không trả về client, không đưa vào audit log hay thông báo lỗi.**
- Token hết hạn → refresh tự động. Refresh fail → đánh dấu kết nối `NEEDS_REAUTH`, báo admin, dừng retry.

## Bước 6 — Test

- Dùng fixture JSON của response thật (đã bỏ dữ liệu nhạy cảm), **không gọi API thật trong test**.
- Case bắt buộc: chuyển múi giờ qua ranh giới ngày; đổi tiền tệ; response rỗng; response thiếu trường; upsert chạy 2 lần không nhân đôi; retry khi 429.

```bash
npm test && npm run typecheck
```

## Bước 7 — Đối soát khi số lệch

Kiểm theo đúng thứ tự này, dừng ở nguyên nhân đầu tiên tìm thấy:

1. Múi giờ và ranh giới ngày
2. Cửa sổ attribution của nền tảng
3. Dữ liệu hồi tố chưa backfill
4. Bộ lọc account/campaign khác nhau
5. Đơn vị tiền và tỷ giá
6. Lọc trạng thái entity (đã xoá / tạm dừng)
7. Cuối cùng mới nghi ngờ công thức KPI

Kết luận phải kèm số cụ thể chứng minh, không suy đoán.

## Bước 8 — Báo cáo

Connector thay đổi, các quy ước chuyển đổi đã áp dụng (múi giờ, tiền tệ, conversion), test đã chạy, có cần chạy lại backfill cho dữ liệu cũ không.
