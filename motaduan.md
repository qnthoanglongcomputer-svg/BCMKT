ĐẶC TẢ HỆ THỐNG WEB QUẢN TRỊ KPI & BÁO CÁO PHÒNG MARKETING (Marketing Performance Management System - MPMS)
1. Mục tiêu hệ thống

Xây dựng một hệ thống web giúp quản trị toàn bộ hoạt động của phòng Marketing, thay thế việc quản lý bằng nhiều file Excel rời rạc.

Hệ thống không chỉ phục vụ việc nhập báo cáo mà còn là nền tảng quản trị hiệu suất (Performance Management), giúp Ban Giám đốc và Trưởng phòng Marketing theo dõi KPI, đánh giá hiệu quả, phân tích nguyên nhân, dự báo kết quả và hỗ trợ ra quyết định.

2. Cơ cấu tổ chức
Trưởng phòng Marketing
│
├── Performance / Digital
│   ├── Lead Ads
│   ├── Ads Performance
│   ├── Content Video Ads
│   ├── Designer
│   └── Editor
│
├── Content & Social
│   ├── Content Social
│   ├── TikTok Creator
│   ├── Designer
│   ├── Editor
│   └── SEO Content
│
├── Trade Marketing
│   ├── Trade Leader
│   ├── Trade Executive
│
└── Branding
    └── Branding Executive

Hệ thống phải cho phép mở rộng phòng ban, vị trí và nhân sự mà không cần lập trình lại.

3. Mục tiêu quản trị

Hệ thống phải quản lý được:

KPI Công ty
KPI Phòng Marketing
KPI từng Bộ phận
KPI từng Team
KPI từng Nhân viên

Đồng thời liên kết toàn bộ KPI theo dạng cây.

Công ty
      │
Marketing
      │
Performance
      │
Facebook Ads
      │
Lead Ads
      │
Nhân viên

Mọi KPI của cấp dưới sẽ tự động tổng hợp lên cấp trên.

4. KPI năm (KPI Planning)

Đây là chức năng quan trọng nhất.

Admin chỉ cần nhập KPI một lần cho cả năm.

Ví dụ

Lead

72.000

Doanh thu

1.000 tỷ

Chi phí

120 tỷ

Video

5.000

Content

3.600

Sau khi lưu

Hệ thống tự động sinh

Năm

↓

Quý

↓

Tháng

↓

Tuần

↓

Ngày

Ví dụ

72.000 Lead

↓

12 tháng

↓

6.000/tháng

↓

52 tuần

↓

1.384/tuần

↓

365 ngày

↓

197/ngày
Phân bổ KPI

Cho phép 3 phương án

Chia đều

Ví dụ

100%

↓

12 tháng bằng nhau
Theo tỷ trọng

Ví dụ

Tháng 1

5%

Tháng 2

6%

...

Tháng 11

14%

Tháng 12

16%
Điều chỉnh thủ công

Ví dụ

Admin nhập

Tháng 12

8.000 Lead

Hệ thống tự cân các tháng còn lại.

5. KPI có trọng số (Weighted KPI)

Mỗi KPI phải có Weight.

Ví dụ

Performance

KPI	Weight
Lead	40%
CPA	20%
ROAS	20%
Doanh thu	20%

Editor

KPI	Weight
Video Ads	40%
TikTok	20%
Deadline	20%
Chất lượng	20%

Designer

KPI	Weight
Deadline	30%
Lỗi thiết kế	30%
Feedback	20%
Số lượng	20%

Hệ thống tự tính

Điểm KPI

92.6/100
6. Dashboard tổng quan

Sau khi đăng nhập

Hiển thị

KPI toàn phòng
KPI từng bộ phận
KPI từng nhân viên
Tiến độ tháng
Tiến độ năm

Ví dụ

Marketing

████████░░

84%

Performance

91%

Content

82%

Trade

71%

Branding

65%

Có

Biểu đồ
Xu hướng
Heatmap
Gauge KPI
Top nhân viên
7. Dashboard theo bộ phận
Performance

Lấy từ Facebook Ads

Google Ads

TikTok Ads

Hiển thị

Chi phí
Doanh thu
ROS
CPA
CPC
CTR
AOV
Lead
Đơn hàng

So sánh

KPI
Kỳ trước
Hôm qua
Tháng trước
Cùng kỳ
Content Social

Hiển thị

Bài Fanpage
Website
Engagement
SEO
Reach
Organic Reach
Fanpage từng chi nhánh
Content Creator

Hiển thị

Video
View
Follower
Saves
Share
Leads
Tim/View
Designer

Hiển thị

Deadline
Feedback
Lỗi
Thời gian thiết kế
Thiết kế phát sinh
Editor

Hiển thị

Video Ads
Video TikTok
Video Review
Cấu hình chụp
Trade Marketing

Hiển thị

CTKM
Audit
POSM
Doanh thu CTKM
Khách mới
Đối thủ
8. Dashboard Drill-down

Có thể click từ

Marketing

↓

Performance

↓

Facebook

↓

Campaign

↓

Ads Set

↓

Ads

↓

Nhân viên

Hoặc

Marketing

↓

Content

↓

Nhân viên

↓

Bài viết
9. Quản lý Campaign

Toàn bộ dữ liệu phải gắn với Campaign.

Ví dụ

Back To School

↓

Facebook

↓

Content

↓

Trade

↓

Designer

↓

Editor

↓

Doanh thu

↓

ROI

Hệ thống sẽ biết

Campaign nào hiệu quả nhất
Bộ phận nào đóng góp nhiều nhất
ROI từng Campaign
Chi phí từng Campaign
10. Workflow công việc

Thay vì chỉ nhập báo cáo.

Hệ thống có Workflow.

Nhân viên

↓

Nhập báo cáo

↓

Leader duyệt

↓

Marketing Manager duyệt

↓

Hoàn thành

Có trạng thái

Draft
Submitted
Approved
Rejected
11. Dashboard KPI

Hiển thị

KPI

Hiện tại

Đạt

Còn thiếu

Dự báo cuối tháng

Ví dụ

Lead

6.000

4.850

81%

Forecast

5.900
12. AI Insight

Đây là phần Excel không có.

Ví dụ

Facebook

Lead giảm

↓

AI đọc

CTR

Frequency

Creative

Audience

Landing Page

↓

AI kết luận

Nguyên nhân

↓

Đề xuất

↓

Mức độ ưu tiên

Ví dụ

CPA tăng

18%

Nguyên nhân

CTR giảm

Creative cũ

Audience bão hòa

Đề xuất

✔ Thay Creative

✔ Test Audience mới

✔ Tăng ngân sách nhóm A

✔ Tắt nhóm B
13. AI Forecast

AI dự báo

Ví dụ

Ngày

20

Lead

đạt

55%

AI sẽ dự báo

Nếu giữ tốc độ hiện tại

Cuối tháng

đạt

82%

Không đạt KPI
14. Cảnh báo thông minh

Dashboard phải có cảnh báo.

Ví dụ

🔴 CPA vượt KPI

🔴 Lead giảm liên tục

🔴 Content không đạt

🔴 Trade chưa Audit

🔴 Video thiếu

🔴 Campaign vượt ngân sách

15. Đánh giá hiệu suất

Không chỉ %

Mà phải có

Điểm KPI

A

B

C

D

Ví dụ

Điểm	Xếp loại
95-100	A+
90-95	A
80-89	B
70-79	C
<70	D
16. Ranking

Top nhân viên

Top Team

Top Bộ phận

Top Campaign

Có

Tuần
Tháng
Quý
Năm
17. Theo dõi xu hướng

Không chỉ so với kỳ trước.

Mà có

7 ngày
30 ngày
90 ngày
12 tháng

Ví dụ

CPA

Trend

Lead

Trend

ROS

Trend

18. Quản lý năng suất

Ví dụ

Designer

42 banner

↓

18 giờ

↓

2.3 banner/giờ

Editor

5 video

↓

12 giờ

↓

0.42 video/giờ

Content

64 bài

↓

35 giờ

↓

1.82 bài/giờ

19. Theo dõi chất lượng

Không chỉ Output.

Mà còn Outcome.

Ví dụ

Content

64 bài

↓

Lead

↓

Đơn hàng

↓

Doanh thu

Editor

5 video

↓

Ads sử dụng

↓

Doanh thu

Designer

40 Banner

↓

CTR

↓

ROAS

↓

Lead

20. Phân quyền
Admin

Toàn quyền

KPI
User
Dashboard
AI
Workflow
Báo cáo
Cấu hình
Marketing Manager

Xem toàn bộ

Duyệt KPI

Xuất báo cáo

Theo dõi AI

Leader

Chỉ xem Team

Duyệt Team

Theo dõi Team

Nhân viên

Chỉ xem KPI cá nhân

Nhập báo cáo

Theo dõi tiến độ

21. Nhật ký hệ thống (Audit Log)

Lưu mọi thay đổi

Ví dụ

09:20

Nguyễn Văn A

Sửa

Lead

120

↓

150

Không ai có thể sửa dữ liệu mà không có lịch sử.

22. Thông báo

Hệ thống gửi Notification

Chưa nhập báo cáo
KPI dưới 80%
Leader chưa duyệt
KPI sắp không đạt
Campaign vượt ngân sách
KPI hoàn thành
23. Báo cáo

Xuất

PDF
Excel

Theo

Ngày
Tuần
Tháng
Quý
Năm

Có bộ lọc

Chi nhánh
Bộ phận
Team
Nhân viên
Campaign
24. Cơ sở dữ liệu
Users
Roles
Departments
Positions
Campaigns
KPI_Year
KPI_Month
KPI_Week
KPI_Day
KPI_Weight
Reports
Report_Details
Performance_Summary
KPI_Summary
Notifications
Audit_Log
Attachments
25. Giao diện người dùng
Thanh menu
🏠 Dashboard

🎯 KPI

📈 Performance

📱 Content Social

🎥 Content Creator

🎨 Designer

🎬 Editor

🏪 Trade Marketing

🏷 Branding

📊 Campaign

👥 Nhân sự

🤖 AI Insight

📄 Báo cáo

🔔 Thông báo

⚙ Quản trị
Dashboard chính
┌──────────────────────────────────────────────────────────────────────────────┐
│ Marketing KPI                         Tháng 7/2026             Đạt: 84%      │
├──────────────────────────────────────────────────────────────────────────────┤
│ KPI Tổng quan │ Doanh thu │ Lead │ CPA │ ROAS │ Chi phí │ Campaign đang chạy │
├──────────────────────────────────────────────────────────────────────────────┤
│ Biểu đồ KPI theo thời gian                                         (Line)   │
├──────────────────────────────────────────────────────────────────────────────┤
│ Hiệu suất phòng ban (Performance | Content | Trade | Branding)              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Top nhân viên │ Top Campaign │ AI Insight │ Cảnh báo │ Forecast             │
├──────────────────────────────────────────────────────────────────────────────┤
│ Danh sách công việc chờ duyệt │ KPI sắp đến hạn │ Thông báo hệ thống        │
└──────────────────────────────────────────────────────────────────────────────┘
26. Giá trị cốt lõi của hệ thống

Hệ thống được thiết kế để trả lời đầy đủ các câu hỏi mà một Trưởng phòng Marketing hoặc Ban Giám đốc cần mỗi ngày:

Chúng ta đang đạt bao nhiêu % KPI?
Bộ phận nào đang kéo hiệu suất toàn phòng xuống?
Nhân viên nào vượt hoặc không đạt KPI?
Chiến dịch nào mang lại doanh thu và ROI tốt nhất?
Xu hướng KPI đang cải thiện hay suy giảm?
Nếu giữ tốc độ hiện tại thì cuối tháng/quý/năm có đạt mục tiêu không?
Nguyên nhân của các chỉ số bất thường là gì và cần ưu tiên hành động nào?
Toàn bộ dữ liệu có minh bạch, truy vết được lịch sử thay đổi và quy trình phê duyệt hay không?

Với kiến trúc này, hệ thống không chỉ là một web báo cáo, mà trở thành một nền tảng quản trị hiệu suất Marketing (Marketing Performance Management System), đủ khả năng phục vụ cả quản lý vận hành hằng ngày lẫn hoạch định chiến lược dài hạn.