---
name: "Quản Lý Dạy Thêm"
description: "Giao diện vận hành trung tâm rõ ràng, gọn và bám sát trạng thái nghiệp vụ thật."
colors:
  sidebar: "#19184f"
  sidebar-active: "#353276"
  brand: "#5b4cf0"
  accent-blue: "#2d6cdf"
  workspace: "#f4f6fa"
  surface: "#ffffff"
  text: "#242842"
  muted: "#747b91"
  line: "#e5e8f0"
  success: "#16835f"
  warning: "#b97708"
  danger: "#c33c4a"
typography:
  headline:
    fontFamily: "Be Vietnam Pro, ui-sans-serif, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Be Vietnam Pro, ui-sans-serif, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.35
  body:
    fontFamily: "Be Vietnam Pro, ui-sans-serif, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Be Vietnam Pro, ui-sans-serif, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
  mono:
    fontFamily: "ui-monospace, Consolas, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  status: "5px"
  control: "7px"
  icon: "8px"
  panel: "10px"
  circle: "50%"
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
  page: "30px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "0 15px"
    height: "38px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "0 15px"
    height: "38px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "36px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "16px"
  status-success:
    backgroundColor: "#e8f6f0"
    textColor: "{colors.success}"
    rounded: "{rounded.status}"
    padding: "4px 7px"
  status-warning:
    backgroundColor: "#fff7e4"
    textColor: "{colors.warning}"
    rounded: "{rounded.status}"
    padding: "4px 7px"
  status-danger:
    backgroundColor: "#fff0f2"
    textColor: "{colors.danger}"
    rounded: "{rounded.status}"
    padding: "4px 7px"
---

# Design System: Quản Lý Dạy Thêm

## Overview

**Creative North Star: "Bàn điều hành trung tâm"**

Đây là sản phẩm ở chế độ **Operate**: người dùng vào hệ thống để xử lý lớp học, lịch dạy, con người và điểm danh. Thiết kế phải quen thuộc ngay từ lần đầu sử dụng, ưu tiên khả năng quét nhanh, trạng thái rõ, thao tác có hậu quả dễ hiểu và dữ liệu thật từ API.

Hệ thống dùng một app shell cố định: sidebar indigo đậm xác lập trung tâm và module đang hoạt động; topbar nhỏ giữ ngữ cảnh; workspace xám rất nhạt chứa bảng, biểu mẫu và danh sách nền trắng. Bản sắc đến từ độ chính xác của spacing, indigo tím có kiểm soát và màn điểm danh rõ luồng, không đến từ trang trí.

Giao diện art-directed trước đây — nền giấy, đường tuyến, doodle, chữ viết tay, headline marketing khổng lồ và các “ga” minh họa — là **anti-reference** và không còn là nguồn chuẩn. `/` là trang chào mừng (chế độ Persuade) dựng trong chính thế giới indigo của sản phẩm; các trang sau đăng nhập là phần mềm vận hành.

### Trang chào mừng `/`

- Hero nền navy với lưới chấm và hai quầng sáng violet/xanh trôi chậm; tiêu đề 800 tối đa `3.5rem`, dòng thứ hai màu `#b9b3ff` (không dùng gradient text).
- **Focal moment — “Một ngày vận hành”**: bản thu nhỏ của chính sản phẩm (`components/home/hero-stage.tsx`) phát vòng lặp ~12 giây: buổi học trượt vào làn phòng, một buổi trùng phòng bị chặn rồi được chuyển phòng, phiếu điểm danh được đánh dấu từng học sinh rồi nộp. Mỗi nhịp phản ánh một quy tắc thật của back-end; ghi rõ “dữ liệu mẫu”. Dừng khi khuất màn hình hoặc tab ẩn; reduced-motion hiện trạng thái cuối, không chạy.
- Các phần dưới: quy trình 4 bước (đường nối vẽ khi cuộn tới), bảng vai trò, ba nguyên tắc, dải kêu gọi hành động. Không có số liệu, khách hàng hay lời chứng thực bịa.

### Chuyển động

- Nút: nhấc 1px + bóng khi hover, nhấn co 0.97; nút chính có lớp màu xanh–tím lan từ đáy và một vệt sáng quét ngang, mũi tên trượt 3px.
- Điều hướng trong khung trung tâm/nền tảng/học sinh: React View Transition rời 130ms và vào 300ms, chỉ chuyển động vùng nội dung để sidebar/topbar giữ nguyên; CSS fade-rise 320ms là fallback cho trình duyệt chưa bật API.
- Notice trượt vào 260ms, hộp thoại 220ms, chip điểm danh “pop” khi chọn.
- `prefers-reduced-motion`: bỏ mọi chuyển dịch và hiệu ứng tràn, chỉ giữ fade 100–120ms cùng phản hồi màu.

**Key Characteristics:**

- Sidebar indigo đậm, workspace sáng, mật độ thông tin vừa phải.
- Điều hướng, bảng và form theo convention ứng dụng quản trị quen thuộc.
- Một màu brand chính; xanh lá, vàng và đỏ chỉ mang nghĩa trạng thái.
- Các trạng thái loading, empty, error, disabled và submitted hiện rõ tại chỗ.
- Không trình bày module chưa có backend như chức năng dùng được.

## Colors

Palette dùng indigo để định vị sản phẩm, neutral lạnh để giữ mật độ dễ đọc và màu semantic để diễn đạt trạng thái nghiệp vụ.

### Primary

- **Sidebar Indigo** (`#19184f`): nền sidebar và nửa thương hiệu của trang đăng nhập.
- **Action Violet** (`#5b4cf0`): CTA chính, focus, icon module và tín hiệu active cục bộ.
- **Sidebar Active** (`#353276`): trạng thái mục điều hướng đang mở; không dùng làm nền nội dung.

### Secondary

- **Operational Blue** (`#2d6cdf`): phối cùng violet trong banner điểm danh hoặc chi tiết nhấn mạnh; không thay thế CTA chính.

### Tertiary

- **Success Green** (`#16835f`): hợp lệ, đã nộp, đang hoạt động.
- **Attention Amber** (`#b97708`): bản nháp, đi muộn, chưa hoàn tất.
- **Exception Red** (`#c33c4a`): lỗi, vắng không phép, thao tác thất bại.

### Neutral

- **Workspace** (`#f4f6fa`): nền ứng dụng.
- **Surface** (`#ffffff`): panel, bảng, toolbar và field.
- **Primary Text** (`#242842`): tiêu đề và dữ liệu chính.
- **Muted Text** (`#747b91`): mô tả, metadata và nhãn phụ.
- **Divider** (`#e5e8f0`): viền panel, hàng bảng và phân nhóm.

### Named Rules

**The Semantic Color Rule.** Xanh lá chỉ xác nhận thành công/hợp lệ, vàng chỉ cảnh báo hoặc bản nháp, đỏ chỉ lỗi/ngoại lệ. Luôn kèm nhãn chữ hoặc icon; màu không đứng một mình.

**The One Primary Action Rule.** Mỗi vùng thao tác chỉ có một CTA violet nổi trội. Hành động phụ dùng nút trắng có viền hoặc text button.

## Typography

**Display Font:** Be Vietnam Pro với fallback `ui-sans-serif, sans-serif`.

**Body Font:** Be Vietnam Pro với cùng fallback.

**Label/Mono Font:** `ui-monospace, Consolas, monospace`, chỉ dùng cho OTP, mã định danh và nội dung kỹ thuật cần canh ký tự.

**Character:** Một giọng chữ duy nhất, gọn, trung tính và hỗ trợ tiếng Việt tốt. Không dùng display serif, chữ viết tay hoặc font trang trí trong sản phẩm vận hành.

### Hierarchy

Thang chữ cố định theo rem (Operate không dùng chữ co giãn theo viewport):

- **Headline** (700, `1.5rem`/24px, 1.2): tiêu đề trang; một tiêu đề chính cho mỗi workspace.
- **Title** (700, `1rem`/16px, 1.35): tiêu đề panel và hộp thoại (`1.125rem`).
- **Body** (400–600, `0.875rem`/14px, 1.55): dữ liệu, form, mô tả. Bảng dùng `0.8125rem`/13px.
- **Label** (600, `0.75rem`/12px, 1.4): field hint, table header, badge, metadata. Không có chữ dưới 12px.
- **Mono** (400, `0.8125rem`/13px, 1.4): OTP, mã và đoạn kỹ thuật ngắn; không dùng cho tiêu đề hoặc nội dung mô tả.

> Thay đổi 22/10/2026: thang cũ 8–11px không đạt ngưỡng đọc (craft floor của impeccable) nên được nâng lên; bản sắc indigo/violet, một font và mật độ vận hành giữ nguyên.

### Named Rules

**The Operational Scale Rule.** Type nhỏ nhưng không mờ: cỡ chữ, weight và độ tương phản phải tăng cùng mức quan trọng. Không dùng chữ hoa tracking rộng như một eyebrow đứng trên mọi tiêu đề.

## Layout

Desktop dùng lưới `248px / minmax(0, 1fr)`. Sidebar cao toàn viewport và sticky; topbar cao `58px`; workspace có chiều rộng tối đa khoảng `1320px`, gutter `30px`. Page header đứng trước nội dung với title/description bên trái và tối đa một nhóm action bên phải.

Panel dùng divider để tổ chức nội dung. Dashboard có metric strip bốn cột và grid nội dung chính/phụ. Module dữ liệu dùng toolbar tìm kiếm, sau đó là bảng có header nền neutral. Màn điểm danh dùng thứ tự cố định: chọn buổi → tóm tắt buổi → giáo viên/ghi chú → hướng dẫn → roster → hành động lưu/nộp.

- **≤980px:** sidebar giảm còn `210px`; dashboard chuyển một cột; quick actions thành hai cột.
- **≤860px:** sidebar trở thành thanh đầu trang; navigation cuộn ngang; topbar ẩn; metric strip còn hai cột; form điểm danh xếp dọc; bảng/roster cuộn ngang thay vì ép chữ.
- **≤520px:** nhãn nav ẩn nhưng icon và active state vẫn còn; page actions full width; toolbar và footer thao tác xếp dọc.

Không thu nhỏ bảng đến mức mất khả năng đọc. Khi cột là nghiệp vụ cần thiết, ưu tiên cuộn ngang và giữ header/hàng có cấu trúc.

## Elevation & Depth

Hệ thống gần phẳng. Panel và metric strip dùng viền `1px` cùng shadow rất nhẹ (`0 3px 13px rgba(38,42,67,.045)`) để tách khỏi workspace. CTA chính có shadow nhỏ mang màu violet; banner điểm danh dùng shadow vừa để thể hiện nó là ngữ cảnh công việc hiện tại.

### Shadow Vocabulary

- **Panel:** `0 3px 13px rgba(38,42,67,.045)` — panel, bảng và metric strip trên workspace.
- **Primary action:** `0 5px 13px rgba(91,76,240,.18)` — nút hành động chính.
- **Attendance context:** `0 9px 22px rgba(61,75,208,.16)` — banner buổi học đang điểm danh.

### Named Rules

**The Border-First Rule.** Viền/divider là cách phân lớp mặc định. Chỉ thêm shadow khi cần phân biệt panel với workspace hoặc nhấn trạng thái tương tác; không dùng đồng thời viền đậm và shadow đậm.

## Shapes

Hình học chặt và nhất quán: status `5px`, controls `6–7px`, icon tile `8px`, panel `9–10px`. Avatar là hình tròn. Pill hoàn toàn chỉ dùng khi hình dạng mang nghĩa rõ như avatar/indicator; không biến mọi badge và nút thành capsule.

Không dùng đường viền màu dày ở một cạnh thẻ, card xoay, đường vẽ tay hoặc hình trang trí không mang chức năng.

## Components

### Buttons

- **Primary:** nền Action Violet, chữ trắng, cao `38–46px`, radius `7px`, icon Lucide `14–16px` khi cần.
- **Secondary:** nền trắng, viền Divider, chữ trung tính; không có shadow ở trạng thái nghỉ.
- **Text button:** không nền, dùng cho thao tác hỗ trợ như “Tất cả có mặt”.
- **States:** hover đổi tone nhẹ; focus ring violet rõ; disabled giảm opacity và bỏ shadow; pending giữ label và spinner.

### Statuses

- Bo `5px`, padding gọn, luôn có nhãn chữ.
- Success: xanh lá nhạt/đậm; warning/draft: vàng nhạt/đậm; error/absence: đỏ nhạt/đậm; neutral/archive: xám.
- Attendance mark là segmented control bốn lựa chọn; trạng thái chọn dùng semantic color tương ứng.

### Cards / Containers

- Panel nền trắng, radius `10px`, viền Divider và shadow Panel.
- Metric strip là một container chia ô bằng divider, không phải bốn floating cards riêng biệt.
- Quick action là row có icon tile, title, mô tả và mũi tên; không phải feature card marketing.

### Inputs / Fields

- Nền trắng hoặc neutral rất nhạt, viền Divider, radius `6–7px`.
- Focus đổi viền violet và có ring `3px` trong suốt.
- Error hiển thị notice đỏ có `role="alert"`; disabled phải nhìn thấy nhưng không tạo cảm giác có thể click.

### Tables / Lists

- Header cao khoảng `38px`, nền neutral, label `8–9px`, không bắt buộc uppercase.
- Row cao khoảng `54–72px` tùy lượng thông tin; divider ngang mảnh.
- Số liệu và trạng thái ở cột riêng; hover chỉ đổi nền rất nhẹ.
- Empty state nằm trong panel, có icon, một title và một câu giải thích có hành động tiếp theo khi tồn tại.

### Navigation

- Sidebar luôn cho thấy tên sản phẩm, trung tâm hiện tại, vai trò, access state và module active.
- Module chưa có API (học phí, chi phí, báo cáo) được hiển thị disabled nếu cần định hướng kiến trúc, kèm tooltip giải thích; không được điều hướng đến màn hình giả.
- Mobile giữ thứ tự module và cuộn ngang, không tạo menu icon tùy biến khó đoán.

### Signature move — State Rail

Mọi vòng đời có chuyển trạng thái (trung tâm, lớp, phiếu điểm danh) được vẽ thành một dải trạng thái ngắn ngay dưới tiêu đề: trạng thái hiện tại là chip có màu semantic, trạng thái đã qua mờ, trạng thái sau là vòng rỗng. Hành động hợp lệ tiếp theo luôn nằm ở nhóm nút cạnh tiêu đề. Đây là cách sản phẩm thực hiện nguyên tắc "State precedes action".

### Concurrency & lỗi

- Lỗi API hiển thị tại chỗ bằng notice: thông điệp tiếng Việt theo `code`, kèm "Mã tra cứu" (`traceId`).
- Lỗi `*_concurrent_change` hiển thị tone cảnh báo "Dữ liệu đã thay đổi" kèm nút Tải lại; không tự thử lại.
- Thao tác có lý do (từ chối, đình chỉ, khôi phục, hiệu chỉnh) dùng chung hộp thoại lý do với bộ đếm độ dài.

### Attendance Workspace

Phiếu điểm danh là signature workflow. Nó hiển thị buổi/lớp/phòng, giáo viên thực tế, trạng thái Draft/Submitted, tóm tắt số lượng và một control trạng thái cho từng học sinh. “Lưu nháp” và “Nộp điểm danh” là hai hành động khác nhau; nộp bị khóa khi còn `Unknown`. Sau khi submitted, control chuyển read-only và UI phải dẫn sang nghiệp vụ hiệu chỉnh/lịch sử khi được triển khai.

## Do's and Don'ts

### Do:

- **Do** giữ center context và role nhìn thấy được trước mọi thao tác center-scoped.
- **Do** đặt trạng thái, prerequisite và phiên bản gần hành động có thể gây xung đột.
- **Do** dùng API thật, loading/error/empty state thật và copy đúng nghiệp vụ backend.
- **Do** dùng archive, status và correction/history thay vì biểu diễn xóa hoặc ghi đè mơ hồ.
- **Do** giữ tài chính, payroll, báo cáo, thi cử và thông báo ở trạng thái unavailable cho tới khi backend có năng lực tương ứng.

### Don't:

- **Don't** đưa trở lại nền giấy, texture, doodle, đường tuyến hay chữ viết tay; trang chào mừng chỉ dùng ngôn ngữ indigo của sản phẩm và không bịa số liệu/khách hàng.
- **Don't** tạo dữ liệu demo trên các route vận hành rồi trình bày như dữ liệu tài khoản thật.
- **Don't** biến CRUD thành lưới card ngang hàng khi bảng, danh sách hoặc form là pattern đúng hơn.
- **Don't** dùng gradient ngoài vùng ngữ cảnh có chủ đích như banner điểm danh hoặc brand auth.
- **Don't** giấu disabled, conflict, loading, 401/403, traceability hoặc optimistic-concurrency state chỉ để màn hình trông sạch.
