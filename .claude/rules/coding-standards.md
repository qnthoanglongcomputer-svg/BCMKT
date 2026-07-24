# Quy ước code — MPMS

## Ngôn ngữ

- **Tiếng Việt**: nội dung hiển thị cho người dùng, comment giải thích nghiệp vụ, thông báo lỗi, tài liệu.
- **Tiếng Anh**: tên biến, hàm, class, file, bảng, cột, enum value, commit message prefix.

Không trộn: đừng đặt tên hàm `tinhDiemKPI`, dùng `computeKpiScore`.

## Đặt tên

| Đối tượng | Quy ước | Ví dụ |
|---|---|---|
| File TS logic | kebab-case | `resolve-scope.ts` |
| File React component | PascalCase | `KpiCard.tsx` |
| Hàm, biến | camelCase | `computeAchievement` |
| Type, interface, class | PascalCase | `ScoreItem` |
| Hằng số module | SCREAMING_SNAKE | `MIN_DAYS_FOR_FORECAST` |
| Bảng DB | snake_case số nhiều | `kpi_targets` |
| Cột DB | snake_case | `period_start` |
| Enum DB & value | PascalCase / SCREAMING_SNAKE | `ReportStatus.APPROVED` |
| Metric code | SCREAMING_SNAKE | `ORGANIC_REACH` |

Không dùng tiền tố Hungarian (`strName`, `IUser`). Không viết tắt khó đoán (`calcKPIByDeptWk`).

## TypeScript

- `strict: true` và `noUncheckedIndexedAccess: true` đã bật — truy cập mảng trả về `T | undefined`, phải xử lý.
- **Cấm `any`.** Khi thật sự không biết kiểu, dùng `unknown` rồi thu hẹp bằng type guard hoặc Zod.
- Không `as` để ép kiểu cho qua compiler. `as` chỉ dùng khi bạn biết chắc điều mà compiler không suy ra được, và phải có comment giải thích.
- Type ở biên module (export public) khai báo tường minh. Bên trong hàm thì để suy luận.
- Ưu tiên `type` cho union/tổ hợp, `interface` cho hình dạng object được mở rộng.

## Cấu trúc hàm

- Hàm nghiệp vụ trong `src/server/**` phải **thuần**: nhận input tường minh, trả output tường minh, không đọc `process.env`, không gọi DB, không import React.
- Truy vấn DB tách riêng khỏi tính toán. Pattern: `fetchData()` → `compute()` → `persist()`.
- Một hàm làm một việc. Hàm dài quá ~50 dòng thường là dấu hiệu đang làm hai việc.
- Trả về giá trị thay vì mutate tham số.

## Xử lý lỗi

- Ném `Error` có class riêng cho từng miền: `AllocationError`, `ScoringError`, `RollupError`, `ForecastError`. Không ném string.
- **Thông báo lỗi phải hành động được**, tiếng Việt, nêu rõ số liệu: `Tổng các tháng nhập tay (80000) vượt mục tiêu năm (72000).` — không phải `Invalid input`.
- Không nuốt lỗi: `catch {}` rỗng là cấm. Ít nhất phải log kèm ngữ cảnh hoặc ném tiếp.
- Không dùng `console.log` trong code chạy production. Dùng logger tập trung khi có.

## Import

- Dùng alias `@/` cho import nội bộ, không dùng đường dẫn tương đối vượt cấp (`../../../`).
- Thứ tự: thư viện ngoài → alias `@/` → tương đối cùng thư mục.
- Không import từ `index.ts` của chính module mình đang ở trong (vòng lặp import).

## Comment

- Comment giải thích **tại sao**, không giải thích **cái gì**. Code đã nói cái gì rồi.
- Bắt buộc comment ở: công thức nghiệp vụ, quyết định thiết kế không hiển nhiên, chỗ chuyển đổi dữ liệu ngoài (múi giờ, tiền tệ), chỗ cố ý đi ngược pattern thông thường.
- Không comment out code chết — xoá đi, git nhớ hộ.

## Kích thước file

- File > 300 dòng: cân nhắc tách, nhưng **chỉ tách khi có ranh giới tự nhiên**. Tách bừa để cho ngắn làm code khó theo dõi hơn.
- Không tạo file `utils.ts` gom tạp nham. Đặt helper cạnh nơi dùng, hoặc trong module có tên rõ nghĩa.
