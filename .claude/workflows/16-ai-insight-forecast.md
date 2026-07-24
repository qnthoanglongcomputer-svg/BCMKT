# 16 — AI Insight & Forecast

**Phụ thuộc**: [09 — Tích hợp Ads](09-tich-hop-ads.md), [14 — Cảnh báo](14-canh-bao.md) · **Engine forecast đã có**: `src/server/kpi/forecast.ts`

## Mục tiêu

"Đây là phần Excel không có" (mục 12 đặc tả). Khi một chỉ số xấu đi, hệ thống chỉ ra **nguyên nhân**, **đề xuất hành động** và **mức độ ưu tiên**.

## Ví dụ đích đến

```
CPA tăng 18%
├── Nguyên nhân: CTR giảm 22% · Creative đã chạy 21 ngày · Frequency 4,2 (bão hoà)
└── Đề xuất:  1. Thay creative nhóm A            (ưu tiên cao)
              2. Test audience mới                (ưu tiên cao)
              3. Tăng ngân sách nhóm A hiệu quả   (trung bình)
              4. Tắt nhóm B                       (trung bình)
```

## Nguyên tắc nền tảng — không thương lượng

1. **AI diễn giải, không tính toán.** Mọi con số do `src/server/kpi/**` tính. AI nhận dữ liệu đã tổng hợp và giải thích. **Không cho AI truy cập DB**, không để AI tự cộng trừ.
2. **Output có schema cố định**, validate bằng Zod. Parse fail → fallback "chưa đủ dữ liệu để kết luận", **không hiển thị text thô**.
3. **Luôn gắn nhãn AI trên UI** và trong file export. Người dùng phải biết đâu là số liệu, đâu là suy luận máy.
4. **Không bịa.** Prompt yêu cầu rõ: chỉ kết luận từ dữ liệu được cung cấp; thiếu dữ liệu thì nói thiếu.

## Schema output

```ts
const InsightSchema = z.object({
  cause: z.array(z.object({
    factor: z.string(),
    evidence: z.string(),
    impact: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  })),
  recommendation: z.array(z.object({
    action: z.string(),
    priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    expectedEffect: z.string(),
  })),
  confidence: z.number().min(0).max(1),
})
```

## Cấu trúc

```
src/server/ai/
  client.ts              # wrapper @anthropic-ai/sdk, model claude-sonnet-5
  prompts/
    cpa-analysis.v1.ts
    lead-decline.v1.ts
    content-performance.v1.ts
    period-summary.v1.ts
  parse.ts               # validate output qua Zod
  cache.ts               # cache theo (scope, period, data_hash)
```

- Prompt **versioned trong tên file**. Đổi prompt = tạo version mới, không sửa đè — để so sánh chất lượng.
- Không nhúng prompt trong component hay route handler.

## Dữ liệu đầu vào cho AI

Cung cấp đủ chiều để suy luận, không chỉ mỗi con số xấu:

| Vấn đề | Dữ liệu kèm theo |
|---|---|
| CPA tăng | CTR, CPC, Frequency, tuổi creative, độ phủ audience, tỷ lệ chuyển đổi landing, ngân sách |
| Lead giảm | Chi phí, impressions, CTR, chất lượng creative, so cùng kỳ năm trước |
| Content không đạt | Số bài, reach, engagement, lead quy đổi |

**Không gửi**: thông tin cá nhân, lương, token, email nhân viên.

## Forecast

Số forecast do **engine** tính (`forecastPeriod`), AI chỉ diễn giải rủi ro và đề xuất điều chỉnh.

- Luôn nêu giả định: "nếu giữ tốc độ hiện tại"
- < 3 ngày dữ liệu → engine trả `null`, UI hiện lý do, **không gọi AI**
- Hiển thị kèm `confidence` và số ngày dữ liệu đã dùng

## Cache & chi phí

- Cache theo `(scope, period, data_hash)` trong bảng `ai_insights` (đã có, unique constraint sẵn)
- `data_hash` = hash của dữ liệu đầu vào. Dữ liệu không đổi → **không gọi lại API**
- Insight định kỳ chạy bằng cron; gọi trực tiếp chỉ khi người dùng bấm "Phân tích"
- Model mặc định `claude-sonnet-5`; chỉ nâng khi có lý do rõ ràng về chất lượng
- Có giới hạn số lần gọi/ngày, vượt thì hiện thông báo thay vì lỗi

## Màn hình `/ai-insight`

- Chọn phạm vi (bộ phận / campaign / nhân viên) + kỳ
- Khối nguyên nhân: mỗi dòng có yếu tố, bằng chứng số, mức ảnh hưởng
- Khối đề xuất: sắp xếp theo ưu tiên, có checkbox đánh dấu đã làm
- **Nhãn "Nội dung do AI phân tích"** rõ ràng ở đầu khối
- Nút "Phân tích lại" (bỏ qua cache) có giới hạn tần suất

Ngoài ra: widget AI Insight nhỏ trên dashboard tổng quan và dashboard bộ phận.

## Edge case

- API Claude lỗi/timeout → hiện "Chưa phân tích được, thử lại sau", giữ insight cũ nếu có
- Output không parse được → fallback, ghi log để cải thiện prompt, **không hiện text thô**
- Dữ liệu quá ít → không gọi API, hiện "Cần thêm dữ liệu để phân tích"
- Chỉ số bình thường, không có gì bất thường → AI vẫn nên nói "không phát hiện bất thường", không bịa vấn đề
- `ANTHROPIC_API_KEY` chưa cấu hình → ẩn tính năng, báo admin, không lỗi 500

## Test bắt buộc

- Parse output đúng schema
- Output hỏng (JSON sai, thiếu trường) → fallback, không crash
- Cache hit khi `data_hash` không đổi
- Grep xác nhận không có dữ liệu nhạy cảm trong prompt

## Tiêu chí hoàn thành

- [ ] Prompt versioned trong `src/server/ai/prompts/`
- [ ] Output validate qua Zod, có fallback khi hỏng
- [ ] AI không truy cập DB, chỉ nhận dữ liệu đã tính
- [ ] Cache theo `data_hash` hoạt động, có test
- [ ] Nhãn AI hiển thị rõ trên mọi nơi có nội dung AI
- [ ] Forecast lấy số từ engine, không để AI tự tính
- [ ] Xử lý đủ các trường hợp lỗi API
- [ ] Grep xác nhận không gửi dữ liệu nhạy cảm
