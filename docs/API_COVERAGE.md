# Độ phủ nghiệp vụ — back-end v1 ↔ màn hình

Đối chiếu với controller trong `D:\Project\QuanLyDayThem\backend\src` (84 action) ngày 22/10/2026.
Front-end chỉ hiện thực các luồng đã có endpoint; module chưa có API (thành viên, học phí, báo cáo) hiển thị ở trạng thái vô hiệu kèm giải thích.

## Kiến trúc client

| Lớp | Vị trí | Vai trò |
| --- | --- | --- |
| HTTP | `lib/api/http.ts` | Envelope `ApiResponse<T>`, access token trong bộ nhớ, refresh bằng cookie HttpOnly dùng chung một request, thử lại 1 lần khi 401, `Idempotency-Key`, `traceId`, `Retry-After` |
| Hợp đồng | `lib/api/{types,auth,identity,organizations,academics}.ts` | 84/84 action có hàm client tương ứng |
| Lỗi | `lib/api/errors.ts` | Bản dịch tiếng Việt cho mọi `code` ổn định; nhận diện lỗi concurrency |
| Phiên | `lib/auth/session.ts` | Giải mã claim `role` (PlatformAdmin/Student), khôi phục phiên, chọn trang đích sau đăng nhập |
| Ngữ cảnh trung tâm | `components/center/center-frame.tsx` | Layout `/centers/[centerId]` tải context một lần, cấp `canManage`/`isOwner`, chặn trung tâm đình chỉ/không còn thành viên |
| Dữ liệu màn hình | `lib/hooks/use-resource.ts`, `use-lookups.ts` | Tải/làm mới, 401 → đăng nhập lại kèm `next`; danh mục vẫn tải để làm ô chọn và sĩ số, còn tên hiển thị ưu tiên trường do server trả |
| Quy tắc nhập | `lib/validation.ts` | Mã 2–20, tên 2–100, MST, SĐT di động VN, chính sách mật khẩu 12 ký tự |

## Luồng → màn hình

| Luồng nghiệp vụ | Endpoint | Màn hình |
| --- | --- | --- |
| Đăng nhập mật khẩu / Google, liên kết Google | `POST auth/login`, `auth/google`, `auth/google/link` | `/login`, `/account/security` |
| Làm mới, đăng xuất, đăng xuất mọi nơi | `auth/refresh-token`, `auth/logout`, `auth/logout-all` | Tự động, menu tài khoản, `/account/security` |
| Đổi / quên / đặt lại mật khẩu | `auth/password/change|forgot|reset` | `/account/security`, `/forgot-password`, `/reset-password` |
| Xác minh email (tài khoản cũ) | `auth/verify-email`, `auth/resend-verification-email` | `/verify-email` |
| Nhận lời mời (mọi vai trò): xem trước, tạo tài khoản, hoặc đăng nhập rồi chấp nhận | `auth/invitations/preview`, `auth/invitations/accept`, `me/invitations/accept` | `/accept-invitation?token=` |
| Thành viên: mời, gửi lại, thu hồi, đổi vai trò, ngừng/khôi phục quyền | `centers/{id}/members`, `centers/{id}/member-invitations` (+ resend/revoke) | `/centers/[id]/members` |
| Gắn hồ sơ giáo viên với tài khoản; lịch dạy của tôi | `teachers/{id}/account`, `my/teaching` | `/centers/[id]/teachers`, `/centers/[id]/attendance` |
| Tài khoản hiện tại | `me` (`identityApi.me`) | sẵn sàng cho màn tài khoản |
| Chọn trung tâm theo membership | `me/centers`, `centers/{id}/context` | `/select-center`, layout trung tâm |
| Nền tảng: tạo, duyệt, từ chối, sửa & gửi duyệt lại, đình chỉ, khôi phục, lịch sử trạng thái | `platform/centers?status&search&page`, `platform/center-counts`, `platform/centers/{id}` (+ approve/reject/resubmit/suspend/reinstate/history) | `/platform`, `/platform/centers/[id]` |
| Nền tảng: mời chủ trung tâm, xem lời mời đang mở, gửi lại/thu hồi lời mời chủ | `platform/centers/{id}/invitations` (+ resend/revoke) | `/platform/centers/[id]` |
| Nền tảng: xét yêu cầu đổi hồ sơ; hàng đợi mọi trung tâm | `platform/centers/{id}/change-requests` (+ approve/reject), `platform/change-requests` | `/platform/centers/[id]`, `/platform/changes` |
| Hồ sơ trung tâm, gửi/xem/rút yêu cầu thay đổi, bật danh bạ, lịch sử trạng thái | `centers/{id}/profile`, `centers/{id}/change-requests` (+ withdraw), `centers/{id}/directory`, `centers/{id}/status-history` | `/centers/[id]/profile` |
| Môn học, phòng học (CRUD + lưu trữ/khôi phục, phân trang + tìm phía server) | `subjects`, `rooms` | `/centers/[id]/subjects`, `/rooms` |
| Giáo viên, học sinh (CRUD + lưu trữ/khôi phục) | `teachers`, `students` | `/centers/[id]/teachers`, `/students` |
| Lớp học, sĩ số, mở/đóng đăng ký (gửi `expectedVersion`, nhận lại lớp với version mới) | `classes`, `classes/{id}/registration` | `/centers/[id]/classes`, `/classes/[classId]` |
| Ghi danh / rút học (rút bắt buộc lý do) | `classes/{id}/enrollments`, `.../enrollments/{studentId}/withdraw` | `/centers/[id]/classes/[classId]` |
| Buổi lẻ: tạo, dời (có lý do), hủy (có lý do), ghi nhận không diễn ra, xếp buổi bù | `sessions` (+ cancel/not-held, `makeupForSessionId`) | `/centers/[id]/schedule` |
| Lịch lặp: xem trước, tạo, dừng, thay phần tương lai | `schedule-series` (+ preview/stop/replace-future) | `/centers/[id]/schedule/series` |
| Duyệt đơn đăng ký lớp | `class-applications` (+ approve/reject) | `/centers/[id]/applications` |
| Điểm danh: nháp, nộp, hiệu chỉnh, lịch sử | `sessions/{id}/attendance` (+ draft/submit/correction/history) | `/centers/[id]/attendance?session=` |
| Học sinh: tìm trung tâm (danh bạ), lớp đang tuyển, nộp đơn, đơn của tôi, lớp, lịch | `directory/*`, `open-classes`, `class-applications`, `my/*` | `/student`, `/student/centers/[id]` |

## Phân quyền trên giao diện

- `CenterOwner`, `CenterAdmin`: toàn bộ thao tác vận hành.
- `Teacher`, `Staff`: chỉ xem; Đơn đăng ký và Thành viên vô hiệu kèm lý do. Điểm danh chỉ hiện buổi của hồ sơ giáo viên gắn với tài khoản, tự lưu/nộp được đến hết ngày diễn ra; không hiệu chỉnh, không xem lịch sử.
- Chỉ `CenterOwner` mời/đổi vai trò/ngừng quyền thành viên và gắn tài khoản cho hồ sơ giáo viên.
- Chỉ `CenterOwner` gửi/xem yêu cầu đổi hồ sơ.
- `401/403` từ API luôn là quyết định cuối cùng; giao diện chỉ định hướng.

## Giới hạn đến từ back-end (xem `backend/docs/REVIEW-NGHIEP-VU-BACKEND.md`)

- ~~DTO lịch/đơn chỉ có ID~~ → đã sửa ở đợt 1: buổi học, lịch lặp, đơn đăng ký, phiếu điểm danh và lịch học sinh trả `classCode`, `className`, `teacherName`, `roomName` (phản hồi sau khi ghi chưa có, giao diện dùng danh mục làm dự phòng). Học sinh đã thấy giáo viên và phòng.
- Tìm kiếm phía server cho học sinh (mã, tên, SĐT phụ huynh), giáo viên và lớp (đợt 3); môn học và phòng phân trang + tìm phía server (đợt 4).
- ~~Học sinh không tìm được trung tâm~~ → đợt 4: danh bạ công khai (`directory/*`) cho trung tâm đã bật hiển thị; đường dẫn `/student/centers/{centerId}` vẫn dùng được.
- Ngày giờ luôn hiển thị và nhập theo giờ Việt Nam (D12); không còn chọn múi giờ khi tạo lịch lặp.
- Lịch học của học sinh (`my/sessions`) chưa có trạng thái/lý do buổi — làm ở đợt lịch cá nhân.
- Không có API học phí, báo cáo → hiển thị "Chưa có API".
