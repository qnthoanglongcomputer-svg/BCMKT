# 13 — Năng suất & chất lượng

**Phụ thuộc**: [06 — Workflow báo cáo](06-workflow-bao-cao.md), [10 — Dashboard bộ phận](10-dashboard-bo-phan.md)

## Mục tiêu

Trả lời hai câu hỏi khác nhau:
- **Năng suất** (mục 18): làm được bao nhiêu trên mỗi giờ công?
- **Chất lượng** (mục 19): những gì làm ra có tạo ra kết quả kinh doanh không?

Đo output mà không đo outcome sẽ khuyến khích làm nhiều thứ vô ích.

## Phần A — Năng suất

### Công thức

```
năng_suất = tổng_output / tổng_giờ
```

Ví dụ trong đặc tả:

| Vị trí | Output | Giờ | Năng suất |
|---|---|---|---|
| Designer | 42 banner | 18 giờ | 2,3 banner/giờ |
| Editor | 5 video | 12 giờ | 0,42 video/giờ |
| Content | 64 bài | 35 giờ | 1,82 bài/giờ |

### Dữ liệu

`report_details.hours_spent` đã có trong schema. Form nhập báo cáo của vị trí sáng tạo (Designer/Editor/Content/Creator) phải có ô nhập giờ.

Kết quả lưu vào `performance_summary` (`output_count`, `hours_spent`, `productivity`).

### Quy tắc

- `hours_spent = 0` hoặc `null` → năng suất `null`, hiển thị `—`. **Không chia cho 0, không hiện 0.**
- Năng suất là metric `RATIO`: rollup lên bộ phận = `tổng output / tổng giờ`, **không** lấy trung bình năng suất cá nhân.
- Giờ công là số tự khai → dùng để tham khảo xu hướng, **không dùng làm cơ sở duy nhất để đánh giá**. Ghi chú rõ điều này trên UI.

## Phần B — Chất lượng (Output → Outcome)

Chuỗi quy đổi theo đặc tả:

```
Content:  64 bài    → Lead → Đơn hàng → Doanh thu
Editor:   5 video   → Ads sử dụng → Doanh thu
Designer: 40 banner → CTR → ROAS → Lead
```

### Cách làm

Đây là phần khó nhất về mặt dữ liệu: cần liên kết được **một sản phẩm cụ thể** với **kết quả nó tạo ra**.

Cách khả thi nhất với schema hiện tại: quy đổi ở **cấp campaign**, không cấp từng sản phẩm.

```
Campaign X: 40 banner của Designer A · CTR trung bình 2,1% · ROAS 4,2 · 890 lead
```

Quy đổi tới từng banner cụ thể đòi hỏi gắn `ad_ext_id` với `attachment_id` — chỉ làm được nếu quy trình vận hành có đánh mã sản phẩm.

> ⚠️ Cần chốt với người dùng: quy đổi ở cấp campaign (làm được ngay), hay cần tới cấp từng sản phẩm (phải bổ sung quy trình đánh mã + migration)?

### Màn hình `/performance/productivity`

1. **Bảng năng suất** — nhân viên · output · giờ · năng suất · so kỳ trước
2. **Biểu đồ năng suất theo thời gian** — phát hiện xu hướng giảm
3. **Bảng outcome** — theo campaign: output của từng bộ phận → kết quả kinh doanh

## Edge case

- Nhân viên không khai giờ → hiện `—` ở cột năng suất, vẫn hiện output. Không loại khỏi bảng.
- Giờ khai bất thường (> 24 giờ/ngày, < 0) → chặn ở form nhập
- Nhiều loại output khác nhau trong cùng vị trí (banner + poster + video) → năng suất tính theo từng loại, không cộng gộp các đơn vị khác nhau
- Kỳ chưa có báo cáo `APPROVED` nào → empty state
- Outcome không quy đổi được (campaign chưa có doanh thu) → hiện `—`, không hiện 0

## Test bắt buộc

- `hours_spent = 0` → năng suất `null`, không chia cho 0
- Rollup năng suất lên bộ phận = tổng output / tổng giờ, **khác** trung bình năng suất cá nhân
- Giờ khai ngoài khoảng hợp lệ bị chặn

## Tiêu chí hoàn thành

- [ ] Form nhập báo cáo có ô giờ cho vị trí sáng tạo
- [ ] Bảng năng suất hiển thị đúng theo từng loại output
- [ ] Năng suất rollup theo công thức RATIO, có test chứng minh khác trung bình
- [ ] Xử lý đúng giờ = 0 và giờ chưa khai
- [ ] UI ghi rõ giới hạn của số liệu giờ tự khai
- [ ] Đã chốt cấp độ quy đổi outcome với người dùng
