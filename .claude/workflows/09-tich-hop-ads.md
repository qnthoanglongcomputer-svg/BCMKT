# 09 — Tích hợp Ads (Facebook / Google / TikTok)

**Phụ thuộc**: [08 — Campaign](08-quan-ly-campaign.md) · **Quy trình chi tiết**: skill [ads-connector](../skills/ads-connector/SKILL.md)

## Mục tiêu

Tự động nạp số liệu quảng cáo từ 3 nền tảng vào hệ thống, chuẩn hoá về một schema chung, để dashboard Performance không phải đọc raw payload của bất kỳ nền tảng nào.

## Vai trò

- `ADMIN`: cấu hình kết nối, quản lý token, xem log sync, chạy sync thủ công
- Người dùng khác: chỉ tiêu thụ dữ liệu đã sync, không thấy cấu hình kết nối

## Dữ liệu

Đã có:
- `ads_insights` — dữ liệu đã chuẩn hoá, unique `(platform, account_id, campaign_ext_id, adset_ext_id, ad_ext_id, date)`
- `ads_sync_logs` — lịch sử sync: phạm vi, số dòng, trạng thái, lỗi

Cần bổ sung (migration mới, **hỏi trước khi làm**): bảng `ads_accounts` lưu kết nối — platform, account_id, tên hiển thị, token mã hoá, trạng thái, lần sync cuối.

## Kiến trúc

```
src/server/integrations/
  types.ts                  # AdsConnector, NormalizedAdsRow
  facebook/connector.ts
  google/connector.ts
  tiktok/connector.ts
  sync.ts                   # orchestrator dùng chung
worker/
  sync-ads.ts               # cron job
```

Interface chung — thêm nền tảng mới **không được sửa tầng trên**:

```ts
interface AdsConnector {
  platform: AdsPlatform
  fetchInsights(range: DateRange, accountId: string): Promise<NormalizedAdsRow[]>
}
```

## `NormalizedAdsRow` — chỉ số nguyên liệu

```
platform · accountId · campaignExtId · adsetExtId · adExtId · date
impressions · clicks · spend · conversions · leads · revenue · videoViews · frequency
campaignName · adsetName · adName
```

**Không lưu CTR / CPC / CPA / ROAS lấy từ API.** Chỉ lưu tử và mẫu; KPI engine tính. Hai nguồn sự thật cho cùng một con số là lỗi thiết kế.

## Ba điểm chuyển đổi bắt buộc kiểm kỹ

1. **Múi giờ** — quy về `Asia/Ho_Chi_Minh` **tại connector**, trước khi gán `date`. Nền tảng trả theo timezone tài khoản của họ. Đây là nguồn lệch số phổ biến nhất.
2. **Tiền tệ** — quy về VND tại connector, tỷ giá từ cấu hình, không hardcode.
3. **Định nghĩa conversion** — mỗi nền tảng định nghĩa khác nhau. Chọn đúng loại và **ghi chú lý do ngay tại chỗ map**.

## Job sync

- Chạy theo cron (mặc định mỗi giờ, cấu hình được)
- **Idempotent**: `upsert` theo khoá tự nhiên, không `insert` mù
- **Backfill 7 ngày gần nhất** mỗi lần chạy — nền tảng cập nhật số liệu hồi tố. Khoảng backfill là cấu hình.
- Chia nhỏ theo ngày và theo account, không kéo một request khổng lồ
- Rate limit: tôn trọng giới hạn API, retry exponential backoff + jitter, giới hạn số lần thử
- Phân biệt lỗi tạm thời (429, 5xx → retry) và vĩnh viễn (401, 403 → dừng, báo admin)
- Ghi `ads_sync_logs` mỗi lần chạy

## Màn hình `/admin/integrations`

- Danh sách kết nối: nền tảng · tài khoản · trạng thái · lần sync cuối · số dòng
- Trạng thái `NEEDS_REAUTH` hiển thị nổi bật kèm nút kết nối lại
- Lịch sử sync: thời gian, phạm vi, số dòng, lỗi
- Nút sync thủ công cho một khoảng ngày cụ thể

## Bảo mật

- Token lưu **mã hoá**, đọc từ env hoặc secret store
- **Không log token**, không trả về client, không đưa vào audit log hay thông báo lỗi
- Token hết hạn → refresh tự động; refresh fail → `NEEDS_REAUTH`, báo admin, dừng retry

## Gắn dữ liệu ads vào tổ chức

`ads_insights.owner_id` và `campaign_id` cần được gán để rollup lên đúng người/bộ phận:
- Map `campaign_ext_id` → `campaigns.id` qua bảng ánh xạ do admin cấu hình
- Map account/campaign → nhân viên phụ trách

> ⚠️ Cách ánh xạ này cần chốt với người dùng trước khi code: theo quy ước đặt tên campaign, hay bảng ánh xạ thủ công?

## Edge case

- Response rỗng (không có dữ liệu ngày đó) → ghi log, không coi là lỗi
- Response thiếu trường → dùng 0 cho số đếm, ghi cảnh báo, không crash
- Campaign bị xoá trên nền tảng → dữ liệu lịch sử giữ nguyên
- Cùng một ad chạy nhiều account → khoá unique đã tách theo `account_id`
- Sync hai lần cùng khoảng ngày → không nhân đôi (test bắt buộc)

## Đối soát khi số lệch

Kiểm theo thứ tự, dừng ở nguyên nhân đầu tiên: (1) múi giờ và ranh giới ngày → (2) cửa sổ attribution → (3) dữ liệu hồi tố chưa backfill → (4) bộ lọc account/campaign → (5) tiền tệ và tỷ giá → (6) trạng thái entity → (7) cuối cùng mới nghi ngờ công thức KPI.

Kết luận phải kèm số cụ thể chứng minh.

## Test bắt buộc

Dùng fixture JSON đã bỏ dữ liệu nhạy cảm, **không gọi API thật**:
- Chuyển múi giờ qua ranh giới ngày
- Đổi tiền tệ
- Response rỗng, response thiếu trường
- `upsert` chạy 2 lần không nhân đôi
- Retry khi 429, dừng khi 401

## Tiêu chí hoàn thành

- [ ] 3 connector cùng implement `AdsConnector`, thêm nền tảng không sửa tầng trên
- [ ] Múi giờ và tiền tệ quy đổi tại connector, có test
- [ ] Sync idempotent, chạy lại không nhân đôi
- [ ] Rate limit + retry backoff hoạt động
- [ ] Token mã hoá, grep xác nhận không lọt vào log/response
- [ ] Màn hình admin hiện trạng thái sync và lỗi rõ ràng
- [ ] Đã chốt cách ánh xạ ads → campaign/nhân viên với người dùng
