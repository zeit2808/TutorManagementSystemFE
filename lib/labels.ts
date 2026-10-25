import type { AttendanceMark } from "@/lib/api";

export type Tone = "success" | "warning" | "danger" | "neutral" | "info" | "brand";

export const roleLabels: Record<string, string> = {
  CenterOwner: "Chủ trung tâm",
  CenterAdmin: "Quản lý trung tâm",
  Teacher: "Giáo viên",
  Staff: "Nhân viên",
  PlatformAdmin: "Quản trị nền tảng",
  Student: "Học sinh",
};

export function roleLabel(role: string) {
  return roleLabels[role] ?? role;
}

export const centerStatus: Record<string, { label: string; tone: Tone }> = {
  PendingApproval: { label: "Chờ duyệt", tone: "warning" },
  Approved: { label: "Đã duyệt", tone: "success" },
  Rejected: { label: "Bị từ chối", tone: "danger" },
  Suspended: { label: "Đình chỉ", tone: "danger" },
};

export const changeRequestStatus: Record<string, { label: string; tone: Tone }> = {
  Pending: { label: "Chờ duyệt", tone: "warning" },
  Approved: { label: "Đã áp dụng", tone: "success" },
  Rejected: { label: "Bị từ chối", tone: "danger" },
  Withdrawn: { label: "Đã rút", tone: "neutral" },
};

export const applicationStatus: Record<string, { label: string; tone: Tone }> = {
  Pending: { label: "Chờ duyệt", tone: "warning" },
  Approved: { label: "Đã nhận vào lớp", tone: "success" },
  Rejected: { label: "Bị từ chối", tone: "danger" },
};

export const attendanceStatus: Record<string, { label: string; tone: Tone }> = {
  NotStarted: { label: "Chưa điểm danh", tone: "neutral" },
  Cancelled: { label: "Buổi đã hủy", tone: "danger" },
  Draft: { label: "Bản nháp", tone: "warning" },
  Submitted: { label: "Đã nộp", tone: "success" },
};

export const markOptions: Array<{ value: AttendanceMark; label: string; short: string; tone: Tone }> = [
  { value: "Present", label: "Có mặt", short: "Có mặt", tone: "success" },
  { value: "Late", label: "Đi muộn", short: "Muộn", tone: "warning" },
  { value: "ExcusedAbsent", label: "Vắng có phép", short: "Có phép", tone: "info" },
  { value: "UnexcusedAbsent", label: "Vắng không phép", short: "Không phép", tone: "danger" },
];

export const markLabels: Record<string, string> = {
  Unknown: "Chưa chọn",
  Present: "Có mặt",
  Late: "Đi muộn",
  ExcusedAbsent: "Vắng có phép",
  UnexcusedAbsent: "Vắng không phép",
};

export const revisionActions: Record<string, string> = {
  DraftSaved: "Lưu nháp",
  Submitted: "Nộp phiếu",
  Corrected: "Hiệu chỉnh",
};

export const weekdays: Array<{ value: string; short: string; label: string }> = [
  { value: "Monday", short: "T2", label: "Thứ Hai" },
  { value: "Tuesday", short: "T3", label: "Thứ Ba" },
  { value: "Wednesday", short: "T4", label: "Thứ Tư" },
  { value: "Thursday", short: "T5", label: "Thứ Năm" },
  { value: "Friday", short: "T6", label: "Thứ Sáu" },
  { value: "Saturday", short: "T7", label: "Thứ Bảy" },
  { value: "Sunday", short: "CN", label: "Chủ Nhật" },
];

export const conflictLabels: Record<string, string> = {
  Class: "Lớp đã có buổi",
  Teacher: "Giáo viên bận",
  Room: "Phòng đã dùng",
  SameSeries: "Trùng buổi trong chuỗi",
};

export const MANAGEMENT_ROLES = new Set(["CenterOwner", "CenterAdmin"]);

export const changeKindLabels: Record<string, string> = {
  SessionAdded: "Thêm buổi",
  SessionRescheduled: "Dời buổi",
  SessionCancelled: "Hủy buổi",
  SessionNotHeld: "Không diễn ra",
  MakeupScheduled: "Xếp buổi bù",
  SeriesStopped: "Dừng lịch lặp",
  SeriesReplaced: "Đổi lịch lặp",
  StudentEnrolled: "Bạn được thêm vào lớp",
};

export const requestKindLabels: Record<string, string> = {
  ExcusedAbsence: "Xin vắng có phép",
  Makeup: "Xin học bù",
  Transfer: "Xin chuyển lớp",
  Withdrawal: "Xin rút khỏi lớp",
};

export const requestStatus: Record<string, { label: string; tone: Tone }> = {
  Pending: { label: "Chờ duyệt", tone: "warning" },
  Approved: { label: "Đã duyệt", tone: "success" },
  Rejected: { label: "Bị từ chối", tone: "danger" },
  Cancelled: { label: "Đã rút lại", tone: "neutral" },
};

/** Up to six centers get their own hue in personal schedules; the label always names the center too. */
export const centerHues = ["#5b4cf0", "#0f7b8a", "#b4540a", "#2d6cdf", "#a2368f", "#3d7a1f"];

export const chargeStatus: Record<string, { label: string; tone: Tone }> = {
  Paid: { label: "Đã đóng", tone: "success" },
  Partial: { label: "Đóng một phần", tone: "info" },
  Unpaid: { label: "Chưa đóng", tone: "neutral" },
  Overdue: { label: "Quá hạn", tone: "danger" },
};

export const missedKindLabels: Record<string, string> = {
  ExcusedAbsent: "Vắng có phép",
  UnexcusedAbsent: "Vắng không phép",
  Cancelled: "Trung tâm huỷ",
  NotHeld: "Không diễn ra",
};

export const paymentMethodLabels: Record<string, string> = {
  Cash: "Tiền mặt",
  BankTransfer: "Chuyển khoản",
};

/** Roles that see tuition (H13): everyone but teachers. */
export const FINANCE_ROLES = new Set(["CenterOwner", "CenterAdmin", "Staff"]);

/** docs/LUONG-VA-CHIA-THU-NHAP.md */
export const payrollModeLabels: Record<string, { title: string; short: string; description: string }> = {
  RevenueShare: {
    title: "Chia thu nhập",
    short: "Chia thu nhập (hộ gia đình)",
    description: "Học phí thực thu trong tháng, trừ chi phí chung nếu có, chia cho người dạy theo lớp và theo giờ dạy trong kỳ học phí.",
  },
  PerSession: {
    title: "Lương giáo viên",
    short: "Trả lương theo buổi",
    description: "Mỗi buổi đã nộp phiếu điểm danh × đơn giá của người dạy thực tế (ghi đè theo lớp nếu có).",
  },
};

export const payrollBlockerLabels: Record<string, string> = {
  already_closed: "Tháng đã chốt.",
  future_month: "Chưa tới tháng này.",
  disabled: "Tháng này không bật lương / chia thu nhập.",
  earlier_month_open: "Còn tháng trước chưa chốt — chốt theo thứ tự.",
  open_disputes: "Còn báo sai của giáo viên chưa xử lý.",
  missing_rates: "Có buổi chưa có đơn giá.",
  expenses_exceed_income: "Chi phí chung lớn hơn tiền đem chia.",
  negative_net: "Có người thực nhận âm — sửa khoản cộng/trừ.",
  overpaid: "Đã chi (tạm ứng) nhiều hơn thực nhận.",
};

export const outboxStatusLabels: Record<string, { label: string; tone: Tone }> = {
  Pending: { label: "Chờ gửi", tone: "info" },
  Retrying: { label: "Lỗi, sẽ thử lại", tone: "warning" },
  Sent: { label: "Đã gửi", tone: "success" },
  Skipped: { label: "Bỏ qua", tone: "neutral" },
  Failed: { label: "Gửi thất bại", tone: "danger" },
};
