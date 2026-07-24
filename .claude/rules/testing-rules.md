# Quy tắc kiểm thử — MPMS

Không đặt mục tiêu phần trăm coverage. Đặt mục tiêu: **những chỗ sai sẽ gây hậu quả nghiêm trọng đều có test bảo vệ**.

## Bắt buộc phải có test

Đây là danh sách đóng, không thương lượng:

| Module | Vì sao |
|---|---|
| `kpi/allocation` | Sai → toàn bộ mục tiêu sai |
| `kpi/rollup` | Sai → số cấp trên không khớp cấp dưới |
| `kpi/scoring` | Sai → đánh giá nhân sự sai |
| `kpi/grading` | Sai → xếp loại sai |
| `kpi/forecast` | Sai → dự báo dẫn tới quyết định sai |
| `kpi/period` | Sai → lệch ngày, lệch năm nhuận |
| `auth/scope` | Sai → **rò rỉ dữ liệu giữa các vai trò** |
| `reports/workflow` | Sai → duyệt sai quy trình, dữ liệu bẩn vào rollup |
| `integrations/*` chuẩn hoá | Sai → dữ liệu bẩn ở gốc |

Không cần test: component hiển thị thuần, wrapper mỏng quanh Prisma, cấu hình.

## Case biên phải phủ

### Allocation
- Năm nhuận 366 ngày, tháng 2 có 29 ngày
- `SUM(kỳ con) === kỳ cha` tuyệt đối, kể cả khi chia lẻ (10 chia 3)
- Tuần vắt qua ranh giới tháng/năm
- `WEIGHTED` tổng tỷ trọng ≠ 100% → từ chối
- `MANUAL` tổng khoá > mục tiêu → từ chối, **không tự cắt bớt**
- `MANUAL` khoá đủ 12 tháng nhưng tổng lệch → báo lỗi rõ
- Mục tiêu = 0 chấp nhận, mục tiêu âm từ chối
- Idempotent: chạy 2 lần ra kết quả giống hệt

### Rollup
- Metric RATIO cho kết quả **khác** trung bình cộng của các tỷ lệ (test này chứng minh công thức đúng)
- Mẫu số = 0 → `null`, không phải 0, không chia cho 0
- Rollup 3 cấp = rollup 1 lần (nhờ giữ tử/mẫu)
- Cộng số thập phân không lệch như Float (`0.1 + 0.2 === 0.3`)

### Scoring
- `LOWER_BETTER` đảo đúng công thức
- `LOWER_BETTER` với `actual = 0` → trả trần, không chia cho 0
- Trần achievement 120% được áp
- `target = 0` → metric bị loại, trọng số còn lại chuẩn hoá lại
- Toàn bộ metric bị loại → 0 điểm, không crash
- Tổng trọng số đầu vào ≠ 100% vẫn chuẩn hoá đúng
- Grading tại **từng ngưỡng biên**: 95, 94.99, 90, 89.99, 80, 79.99, 70, 69.99

### Scope (khi làm tới)
- Từng vai trò trong 4 vai trò, trên cây phòng ban ≥ 3 tầng
- `LEADER` thấy subtree đệ quy, không chỉ phòng ban trực tiếp
- `EMPLOYEE` không thấy dữ liệu người khác
- Đổi tham số URL sang phòng ban ngoài scope → bị chặn

### Workflow (khi làm tới)
- Mọi cặp chuyển trạng thái **hợp lệ** thành công
- Mọi cặp **không hợp lệ** bị từ chối tường minh (`APPROVED → SUBMITTED`)
- Tự duyệt báo cáo của chính mình → bị chặn
- Transaction rollback thì audit cũng rollback

### Connector (khi làm tới)
- Chuyển múi giờ qua ranh giới ngày
- Đổi tiền tệ
- Response rỗng, response thiếu trường
- `upsert` chạy 2 lần không nhân đôi
- Retry khi 429

## Cách viết test

- Vitest, file `*.test.ts` đặt **cạnh** file được test.
- Tên test viết bằng **tiếng Việt**, mô tả hành vi nghiệp vụ chứ không mô tả code:
  - Tốt: `'từ chối khi tổng tháng khoá vượt mục tiêu năm, không tự cắt bớt'`
  - Tệ: `'should throw error'`
- `describe` nhóm theo hàm hoặc theo kịch bản nghiệp vụ.
- Một `it` kiểm một hành vi. Không nhồi 5 assertion không liên quan vào một test.
- So sánh `Decimal` bằng `.toString()` hoặc `.toFixed(n)`, **không** so sánh object trực tiếp.

## Không làm

- **Không gọi API thật** (Facebook, Google, TikTok, Claude) trong test. Dùng fixture JSON đã bỏ dữ liệu nhạy cảm.
- **Không phụ thuộc DB thật** trong unit test. Logic nghiệp vụ là hàm thuần, không cần DB.
- Không dùng `Date.now()` hay `new Date()` không tham số trong test — truyền ngày vào tường minh để test không hỏng theo thời gian.
- Không viết test chỉ để tăng coverage (test getter, test constructor).
- Không mock thứ mình sở hữu; nếu phải mock nhiều, thiết kế đang sai.

## Trước khi báo hoàn thành

```bash
npm run typecheck
npm run lint
npm test
npm run build     # khi đụng app/ hoặc build config
```

**Báo kết quả thật.** Test fail thì nói fail và dán output. Chưa chạy được thì nói chưa chạy được và vì sao. Không bao giờ tuyên bố "đã kiểm tra" khi chưa chạy.

## Kiểm thủ công

Test tự động không thay thế được việc mở màn hình ra xem. Với mỗi thay đổi UI:

- 5 trạng thái: loading, empty, error, success, no-permission
- Đăng nhập bằng vai trò thấp nhất — có rò rỉ dữ liệu không?
- Số liệu trên màn hình khớp với nguồn?
- Drill-down và nút back hoạt động?
- Chia sẻ URL mở đúng ngữ cảnh?
