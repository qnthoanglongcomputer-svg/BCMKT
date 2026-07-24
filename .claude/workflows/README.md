# Workflows — bản đồ chức năng MPMS

Mỗi file mô tả **một chức năng cụ thể**: mục tiêu, vai trò, dữ liệu, luồng, màn hình, edge case, tiêu chí hoàn thành, phụ thuộc.

Đây là tài liệu **thiết kế chức năng**, không phải hướng dẫn quy trình. Quy trình làm việc nằm ở [.claude/skills/](../skills/). Quy tắc kỹ thuật nằm ở [.claude/rules/](../rules/).

## Thứ tự xây dựng

Thứ tự này tôn trọng phụ thuộc — làm ngược sẽ phải quay lại sửa.

### Giai đoạn 1 — Nền tảng ✅ đã xong
KPI Engine (allocation · rollup · scoring · grading · forecast), Prisma schema, seed cơ cấu tổ chức.

### Giai đoạn 2 — Khung ứng dụng
| # | Chức năng | File |
|---|---|---|
| 01 | Xác thực & phân quyền | [01-auth-phan-quyen.md](01-auth-phan-quyen.md) |
| 02 | Quản lý tổ chức & nhân sự | [02-quan-ly-to-chuc.md](02-quan-ly-to-chuc.md) |
| 03 | Dashboard tổng quan | [03-dashboard-tong-quan.md](03-dashboard-tong-quan.md) |

### Giai đoạn 3 — Vòng đời dữ liệu
| # | Chức năng | File |
|---|---|---|
| 04 | Lập kế hoạch KPI năm | [04-kpi-planning.md](04-kpi-planning.md) |
| 05 | Trọng số & chấm điểm KPI | [05-kpi-trong-so-cham-diem.md](05-kpi-trong-so-cham-diem.md) |
| 06 | Nhập báo cáo & workflow duyệt | [06-workflow-bao-cao.md](06-workflow-bao-cao.md) |
| 07 | Nhật ký hệ thống (Audit Log) | [07-audit-log.md](07-audit-log.md) |

### Giai đoạn 4 — Phân tích
| # | Chức năng | File |
|---|---|---|
| 08 | Quản lý Campaign | [08-quan-ly-campaign.md](08-quan-ly-campaign.md) |
| 09 | Tích hợp Ads (FB/Google/TikTok) | [09-tich-hop-ads.md](09-tich-hop-ads.md) |
| 10 | Dashboard theo bộ phận | [10-dashboard-bo-phan.md](10-dashboard-bo-phan.md) |
| 11 | Drill-down nhiều cấp | [11-dashboard-drilldown.md](11-dashboard-drilldown.md) |
| 12 | Ranking & xu hướng | [12-ranking-xu-huong.md](12-ranking-xu-huong.md) |
| 13 | Năng suất & chất lượng | [13-nang-suat-chat-luong.md](13-nang-suat-chat-luong.md) |

### Giai đoạn 5 — Chủ động
| # | Chức năng | File |
|---|---|---|
| 14 | Cảnh báo thông minh | [14-canh-bao.md](14-canh-bao.md) |
| 15 | Thông báo | [15-thong-bao.md](15-thong-bao.md) |
| 16 | AI Insight & Forecast | [16-ai-insight-forecast.md](16-ai-insight-forecast.md) |
| 17 | Xuất báo cáo PDF/Excel | [17-bao-cao-export.md](17-bao-cao-export.md) |

## Quy ước đọc

- **Phụ thuộc** ở đầu mỗi file cho biết phải làm gì trước.
- **Tiêu chí hoàn thành** là danh sách đóng — chưa tick đủ thì chức năng chưa xong.
- Khi tài liệu mâu thuẫn với [motaduan.md](../../motaduan.md), đặc tả gốc thắng; sửa lại tài liệu này.
- Khi tài liệu mâu thuẫn với code đang chạy, **hỏi người dùng**, đừng tự quyết.
