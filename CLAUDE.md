# MPMS — Marketing Performance Management System

Hệ thống web quản trị KPI & báo cáo phòng Marketing. Đặc tả nghiệp vụ gốc: [motaduan.md](motaduan.md) — file này là **nguồn sự thật duy nhất** về yêu cầu nghiệp vụ. Khi code mâu thuẫn với đặc tả, hỏi lại người dùng trước khi tự quyết.

---

## 1. Tech stack (đã chốt)

| Lớp | Công nghệ |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript strict |
| Database | PostgreSQL + Prisma ORM |
| Auth | NextAuth (Credentials) + RBAC tự quản |
| Server logic | Next.js Route Handlers + Server Actions |
| Data fetching (client) | TanStack Query |
| UI | Tailwind CSS + shadcn/ui |
| Biểu đồ | Recharts |
| Bảng dữ liệu | TanStack Table |
| Form + validate | React Hook Form + Zod |
| Job định kỳ | node-cron worker riêng (rollup, sync ads, forecast, alert) |
| Export | ExcelJS (xlsx), Puppeteer/react-pdf (PDF) |
| AI | Claude API (`@anthropic-ai/sdk`), model mặc định `claude-sonnet-5` |

**Không thêm dependency mới** nếu stack trên đã giải quyết được. Muốn thêm → hỏi trước, nêu lý do và chi phí bảo trì.

---

## 2. Cấu trúc thư mục

```
src/
  app/
    (auth)/                 # login, quên mật khẩu
    (dashboard)/            # layout có sidebar + guard
      dashboard/            # dashboard tổng quan
      kpi/                  # KPI planning, phân bổ, trọng số
      performance/          # dashboard bộ phận Performance
      content-social/
      content-creator/
      designer/
      editor/
      trade/
      branding/
      campaigns/
      hr/                   # nhân sự, phòng ban, vị trí
      ai-insight/
      reports/
      notifications/
      admin/                # cấu hình hệ thống, audit log
    api/                    # route handlers
  server/
    kpi/                    # engine KPI: allocation, rollup, scoring, forecast
    reports/                # submit/approve workflow
    integrations/           # facebook, google, tiktok ads connectors
    ai/                     # insight, forecast prompts + parsers
    notifications/
    audit/
    auth/                   # rbac, scope resolver
  components/
    ui/                     # shadcn primitives — không sửa tay trừ khi cần
    charts/                 # wrapper Recharts dùng chung
    kpi/                    # KpiCard, KpiGauge, KpiTree, ProgressBar
    layout/
  lib/                      # prisma client, utils, date helpers, formatters
  types/
prisma/
  schema.prisma
  migrations/
worker/                     # cron jobs
```

Quy tắc biên: `app/` chỉ orchestrate + render. Toàn bộ logic nghiệp vụ nằm ở `src/server/**`, thuần hàm, test được, **không import React**.

---

## 3. Mô hình dữ liệu cốt lõi

Bảng bắt buộc (theo đặc tả mục 24):
`users`, `roles`, `departments`, `positions`, `campaigns`, `kpi_definitions`, `kpi_year`, `kpi_quarter`, `kpi_month`, `kpi_week`, `kpi_day`, `kpi_weight`, `reports`, `report_details`, `performance_summary`, `kpi_summary`, `notifications`, `audit_log`, `attachments`.

Nguyên tắc:

- **Cây tổ chức tự mở rộng**: `departments.parent_id` self-reference. Thêm phòng ban / team / vị trí là thao tác dữ liệu, **tuyệt đối không hardcode** tên bộ phận trong code. Chỉ được hardcode `department.code` cho các dashboard chuyên biệt (`PERFORMANCE`, `CONTENT_SOCIAL`, …) và phải tra qua constant tập trung.
- **KPI đa cấp**: mỗi bản ghi KPI gắn `owner_type` (`COMPANY|DEPARTMENT|TEAM|EMPLOYEE`) + `owner_id` + `kpi_definition_id` + `period`.
- **Đơn vị thời gian**: `kpi_day` là hạt nhân. Các cấp trên (`week/month/quarter/year`) là bảng vật chất hoá (materialized) để đọc nhanh — luôn sinh lại từ engine, không sửa tay.
- **Số tiền**: `Decimal(18,2)`. Tỷ lệ/tỷ trọng: `Decimal(9,4)`. **Không dùng `Float`** cho bất kỳ số liệu nghiệp vụ nào.
- **Soft delete** cho `users`, `departments`, `campaigns` (`deleted_at`). Dữ liệu KPI/report không xoá cứng.
- Mọi bảng nghiệp vụ có `created_at`, `updated_at`, `created_by`, `updated_by`.

Đổi schema → xem skill `db-migration`. **Luôn hỏi trước khi thay đổi schema đã deploy.**

---

## 4. Quy tắc KPI Engine (`src/server/kpi/`)

Đây là trái tim hệ thống. Sai ở đây làm sai toàn bộ dashboard.

### 4.1 Phân bổ KPI (allocation)

Admin nhập KPI năm một lần → engine sinh xuống Quý → Tháng → Tuần → Ngày. Ba chiến lược:

| Chiến lược | Hành vi |
|---|---|
| `EVEN` | Chia đều theo số ngày thực của kỳ (không chia đều theo số kỳ) |
| `WEIGHTED` | Theo tỷ trọng % do admin nhập; tổng phải = 100% |
| `MANUAL` | Admin cố định một số kỳ; engine cân lại phần còn lại theo tỷ lệ hiện có |

Bất biến bắt buộc (viết test cho từng cái):

1. `SUM(các kỳ con) === giá trị kỳ cha` — sai số làm tròn dồn vào kỳ cuối cùng.
2. Tuần cắt qua ranh giới tháng → phân bổ theo số ngày thuộc mỗi tháng.
3. Năm nhuận: 366 ngày, không hardcode 365.
4. `MANUAL` mà tổng các kỳ khoá > kỳ cha → từ chối, trả lỗi rõ ràng, không tự cắt.
5. Phân bổ lại phải **idempotent**: chạy 2 lần cho cùng input ra cùng kết quả.

### 4.2 Rollup

Kết quả thực tế đi **ngược lên**: Nhân viên → Team → Bộ phận → Marketing → Công ty.

- Metric cộng dồn (Lead, Doanh thu, Chi phí, Video, Content): `SUM`.
- Metric tỷ lệ (CPA, CPC, CTR, ROAS, AOV, ROS): **tính lại từ tử/mẫu đã cộng dồn**, tuyệt đối không lấy trung bình của tỷ lệ.
- Rollup chạy trong 1 transaction, kích hoạt khi report được `APPROVED` hoặc theo cron.

### 4.3 Chấm điểm (weighted scoring)

```
achievement_i = actual_i / target_i          (chặn trên 120% trừ khi metric cấu hình khác)
score         = Σ (achievement_i × weight_i) × 100
```

- Metric **nghịch** (CPA, CPC, chi phí, lỗi thiết kế, trễ deadline): `achievement = target / actual`.
  Cờ này lưu ở `kpi_definitions.direction` (`HIGHER_BETTER | LOWER_BETTER`), không suy đoán từ tên.
- `target_i = 0` → loại metric khỏi công thức và chuẩn hoá lại tổng weight, không chia cho 0.
- Tổng weight trong một nhóm phải = 100%, validate lúc lưu.

Xếp loại: `>=95 A+`, `90–94.99 A`, `80–89.99 B`, `70–79.99 C`, `<70 D`. Ngưỡng để ở constant duy nhất `src/server/kpi/grading.ts`.

### 4.4 Forecast

`forecast_cuối_kỳ = actual_đến_nay / số_ngày_đã_qua × tổng_số_ngày_kỳ`, có điều chỉnh theo trọng số ngày nếu allocation là `WEIGHTED`. Luôn trả kèm `confidence` và số ngày dữ liệu dùng để tính. Không forecast khi < 3 ngày dữ liệu — trả `null` + lý do.

---

## 5. Phân quyền & phạm vi dữ liệu

| Role | Phạm vi |
|---|---|
| `ADMIN` | Toàn hệ thống, cấu hình, KPI, user |
| `MARKETING_MANAGER` | Toàn phòng Marketing: xem, duyệt, xuất báo cáo |
| `LEADER` | Chỉ subtree phòng ban mình quản lý: xem + duyệt |
| `EMPLOYEE` | Chỉ dữ liệu cá nhân: xem KPI, nhập báo cáo |

Bắt buộc:

- Mọi truy vấn dữ liệu đi qua `resolveScope(user)` trong `src/server/auth/scope.ts`, trả về danh sách `department_id` + `user_id` được phép. **Không viết query Prisma bỏ qua scope.**
- Kiểm tra quyền ở **server** (route handler / server action). Ẩn nút ở UI chỉ là trải nghiệm, không phải bảo mật.
- Không ai được tự duyệt báo cáo của chính mình.

---

## 6. Workflow báo cáo

`DRAFT → SUBMITTED → APPROVED | REJECTED`

- Chỉ `DRAFT` và `REJECTED` mới sửa được. `SUBMITTED` khoá với nhân viên. `APPROVED` bất biến — muốn sửa phải mở lại (`reopen`) và ghi audit.
- Chuyển trạng thái tập trung tại `src/server/reports/workflow.ts`. Không set `status` trực tiếp ở nơi khác.
- Mỗi lần chuyển trạng thái: ghi `audit_log` + tạo `notification` cho người liên quan.
- Chỉ report `APPROVED` mới vào rollup và dashboard chính thức.

---

## 7. Audit log

Mọi thay đổi dữ liệu nghiệp vụ (KPI, report, user, campaign, weight, phân quyền) phải ghi: thời điểm, actor, entity, field, `old_value`, `new_value`.

- Ghi qua helper duy nhất `src/server/audit/log.ts`.
- Audit log **chỉ append**, không update/delete — kể cả admin.
- Không ghi mật khẩu, token, hay dữ liệu nhạy cảm vào audit/log/response.

---

## 8. Tích hợp Ads (Facebook / Google / TikTok)

- Mỗi nền tảng là một module trong `src/server/integrations/<platform>/`, expose cùng interface `AdsConnector` (`fetchInsights(dateRange, accountId)` → `NormalizedAdsRow[]`).
- Chuẩn hoá về schema chung **trước** khi lưu; dashboard không bao giờ đọc raw payload của nền tảng.
- Token lưu mã hoá, chỉ đọc từ env/secret store. Không log token, không trả token ra client.
- Sync là job cron, idempotent theo `(platform, account_id, entity_id, date)` — dùng upsert, không insert mù.
- Rate limit + retry backoff. Lỗi sync ghi vào bảng sync log, hiện trạng thái trên UI admin, không nuốt lỗi im lặng.

---

## 9. AI Insight & Forecast

- Toàn bộ prompt ở `src/server/ai/prompts/`, versioned. Không nhúng prompt rải rác trong component.
- AI **chỉ nhận dữ liệu tổng hợp đã tính sẵn**, không tự truy vấn DB, không tự tính số. Số liệu do engine tính, AI chỉ diễn giải.
- Output ép về JSON schema cố định: `{ cause[], recommendation[], priority, confidence }`. Parse fail → hiện fallback "chưa đủ dữ liệu", không hiển thị text thô.
- Luôn gắn nhãn nội dung do AI sinh ra trên UI.
- Cache insight theo `(scope, period, data_hash)` để không gọi lại API khi dữ liệu không đổi.

---

## 10. Quy ước UI

- Mọi màn hình phải có đủ 5 trạng thái: loading (skeleton), empty, error (có hành động retry), success, và no-permission.
- Số liệu định dạng tập trung tại `src/lib/format.ts`: tiền tệ VND, phần trăm 1 chữ số thập phân, số lớn rút gọn (72.000 → 72K) chỉ ở tile tổng quan, bảng luôn hiện số đầy đủ.
- Màu trạng thái KPI không được là tín hiệu duy nhất — luôn kèm nhãn/số (yêu cầu accessibility).
- Drill-down giữ ngữ cảnh trên URL (`?dept=&team=&user=&campaign=&from=&to=`) để chia sẻ link và back/forward hoạt động đúng.
- Biểu đồ dùng wrapper trong `components/charts/`, không gọi Recharts trực tiếp trong màn hình.
- Bảng > 100 dòng phải phân trang phía server.

---

## 11. Kiểm thử & xác minh

Bắt buộc có unit test cho: allocation, rollup, scoring, grading, forecast, scope resolver, workflow transitions. Đây là phần logic không được phép sai.

Trước khi báo hoàn thành:

```bash
npm run typecheck
npm run lint
npm test
npm run build      # khi đụng tới app/ hoặc build config
```

Không kết luận "đã xong" nếu chưa chạy được các lệnh trên — nêu rõ lý do và rủi ro còn lại.

---

## 12. Quy tắc làm việc

- Đọc code hiện có trước khi sửa. Ưu tiên pattern sẵn có hơn pattern mới.
- Thay đổi tối thiểu, phạm vi hẹp, dễ review, dễ revert.
- Hỏi trước khi: đổi schema DB, đổi public API, đổi luồng auth, thêm dependency, xoá file, refactor diện rộng.
- Không refactor/format file ngoài phạm vi yêu cầu.
- Tiếng Việt cho toàn bộ nội dung hiển thị cho người dùng và trao đổi với người dùng; tiếng Anh cho tên biến, hàm, bảng, cột.

## 13. Agents & Skills

Agents chuyên trách: `.claude/agents/` — kpi-engine, dashboard-ui, data-integration, ai-insight, workflow-rbac, db-schema.
Skills quy trình: `.claude/skills/` — new-feature, new-kpi-metric, new-dashboard, db-migration, ads-connector, report-export.
