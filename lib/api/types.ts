export type Guid = string;
export type IsoDate = string;
export type IsoDateTime = string;
export type LocalTime = string;

export interface ApiFieldError {
  code: string;
  message: string;
  field?: string | null;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T | null;
  errors: ApiFieldError[] | null;
  traceId: string;
}

export interface TokenResponse {
  tokenType: "Bearer" | string;
  accessToken: string;
  expiresIn: number;
}

export interface CenterContext {
  centerId: Guid;
  displayName: string;
  role: string;
  status: string;
  canAccess: boolean;
}

export interface Center {
  id: Guid;
  legalName: string;
  displayName: string;
  taxCode: string;
  businessRegistrationNumber: string | null;
  address: string;
  contactEmail: string;
  contactPhone: string;
  status: string;
  createdAtUtc: IsoDateTime;
  reviewedAtUtc: IsoDateTime | null;
  reviewNote: string | null;
  /** D4: the owner opted in to the public directory. */
  listedInDirectory?: boolean;
}

export interface CenterStatusChange {
  fromStatus: string | null;
  toStatus: string;
  actorUserId: Guid | null;
  actorName?: string | null;
  note: string | null;
  changedAtUtc: IsoDateTime;
}

export interface CenterChangeProposal {
  legalName: string;
  displayName: string;
  taxCode: string;
  businessRegistrationNumber: string | null;
  registeredAddress: string;
  contactEmail: string;
  contactPhone: string;
}

export interface CenterChangeRequest {
  id: Guid;
  centerId?: Guid;
  /** Filled on the platform review queue. */
  centerName?: string | null;
  original: CenterChangeProposal;
  proposed: CenterChangeProposal;
  reason: string;
  evidenceReference: string;
  status: string;
  requestedByUserId: Guid;
  requestedByName?: string | null;
  createdAtUtc: IsoDateTime;
  reviewedByUserId: Guid | null;
  reviewedByName?: string | null;
  reviewedAtUtc: IsoDateTime | null;
  reviewNote: string | null;
}

export interface Room {
  id: Guid;
  code: string;
  name: string;
  locationNote: string | null;
  isActive: boolean;
  version: number;
}

export interface Subject {
  id: Guid;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  version: number;
}

export interface TeachingPage<T> {
  page: number;
  pageSize: number;
  totalCount: number;
  items: T[];
}

export interface TeachingClass {
  id: Guid;
  subjectId: Guid;
  code: string;
  name: string;
  maxStudents: number;
  enrolledCount: number;
  registrationOpen: boolean;
  isActive: boolean;
  version: number;
}

export interface Student {
  id: Guid;
  hasAccount: boolean;
  code: string;
  fullName: string;
  /** Required for new records (D5); older records may not have it yet. */
  parentName?: string | null;
  /** Normalized +84 mobile number. */
  parentPhone?: string | null;
  isActive: boolean;
  version: number;
  /** M3: set when this profile was merged into another one (it is archived). */
  mergedIntoStudentId?: Guid | null;
  /** M3: another profile here that is probably the same student; the center decides. */
  duplicateCandidateId?: Guid | null;
  duplicateCandidateCode?: string | null;
  duplicateCandidateName?: string | null;
  /** SameName = only the names match (a hint); SameAccount = proved by an activation link. */
  duplicateReason?: "SameName" | "SameAccount" | null;
  /** The latest activation link of a profile without a login. */
  activation?: ActivationStatus | null;
}

export interface ActivationStatus {
  state: "Active" | "Used" | "Declined" | "Revoked" | "Expired";
  createdAtUtc: IsoDateTime;
  expiresAtUtc: IsoDateTime;
  usedAtUtc?: IsoDateTime | null;
  declinedAtUtc?: IsoDateTime | null;
}

/** Returned once when created; the token cannot be read again. */
export interface ActivationLink {
  studentId: Guid;
  studentCode: string;
  fullName: string;
  token: string;
  expiresAtUtc: IsoDateTime;
}

export interface ActivationPreview {
  centerName: string;
  studentCode: string;
  fullName: string;
  classNames: string[];
  alreadyLinkedToYou: boolean;
}

export interface ActivationResult {
  centerId: Guid;
  studentId: Guid;
  centerName: string;
  studentCode: string;
}

export interface ClassInvite {
  id: Guid;
  classId: Guid;
  token: string;
  code: string;
  expiresAtUtc: IsoDateTime;
  maxUses?: number | null;
  useCount: number;
  createdAtUtc: IsoDateTime;
  revokedAtUtc?: IsoDateTime | null;
  isActive: boolean;
}

export interface ClassInvitePreview {
  centerId: Guid;
  centerName: string;
  classId: Guid;
  className: string;
  subjectName: string;
  teacherNames: string[];
  weeklySchedule: WeeklySlot[];
  startDate: IsoDate | null;
  endDate: IsoDate | null;
  seatsLeft: number;
  expiresAtUtc: IsoDateTime;
  hasProfileHere: boolean;
  alreadyInClass: boolean;
  profileName?: string | null;
  parentName?: string | null;
  parentPhone?: string | null;
}

export interface ClassInviteJoinResult {
  centerId: Guid;
  classId: Guid;
  studentId: Guid;
  studentCode: string;
  createdProfile: boolean;
  otherCenterConflictCount: number;
}

export interface ClassInviteJoin {
  id: Guid;
  classId: Guid;
  studentId: Guid;
  studentCode: string;
  fullName: string;
  createdProfile: boolean;
  hadConflicts: boolean;
  joinedAtUtc: IsoDateTime;
}

export interface MergeResult {
  targetStudentId: Guid;
  sourceStudentId: Guid;
  movedEnrollments: number;
  movedAttendance: number;
}

export interface Teacher {
  id: Guid;
  /** Linked login; that person sees their sessions and takes their own attendance. */
  userId?: Guid | null;
  code: string;
  fullName: string;
  isActive: boolean;
  version: number;
}

export interface Enrollment {
  id: Guid;
  studentId: Guid;
  status: string;
  enrolledAtUtc: IsoDateTime;
  withdrawnAtUtc: IsoDateTime | null;
  withdrawalReason?: string | null;
  /** B5: sessions of the class that clash with another center (count only). */
  otherCenterConflictCount?: number | null;
}

export interface ClassStudent {
  enrollmentId: Guid;
  studentId: Guid;
  studentCode: string;
  fullName: string;
  status: string;
  enrolledAtUtc: IsoDateTime;
  withdrawnAtUtc: IsoDateTime | null;
  withdrawalReason?: string | null;
  withdrawnByName?: string | null;
}

export interface TeachingSession {
  id: Guid;
  classId: Guid;
  teacherId: Guid;
  roomId: Guid;
  startUtc: IsoDateTime;
  endUtc: IsoDateTime;
  seriesId: Guid | null;
  occurrenceDate: IsoDate | null;
  isRescheduled: boolean;
  isActive: boolean;
  version: number;
  /** Scheduled, Cancelled (before it started) or NotHeld (recorded after it started). */
  status?: SessionStatus;
  cancellationReason?: string | null;
  notHeldReason?: string | null;
  rescheduleReason?: string | null;
  statusChangedAtUtc?: IsoDateTime | null;
  /** Set when this session makes up for a cancelled or not-held one. */
  makeupForSessionId?: Guid | null;
  /** B6: the time before the latest reschedule, on read endpoints. */
  previousStartUtc?: IsoDateTime | null;
  previousEndUtc?: IsoDateTime | null;
  /** Display names resolved by the server on read endpoints; absent on write responses. */
  classCode?: string;
  className?: string;
  teacherName?: string;
  roomName?: string;
}

export type SessionStatus = "Scheduled" | "Cancelled" | "NotHeld";

export interface DirectoryCenter {
  id: Guid;
  name: string;
  openClassCount: number;
  subjects: string[];
}

export interface WeeklySlot {
  weekday: string;
  startTime: LocalTime;
  durationMinutes: number;
}

export interface DirectoryClass {
  id: Guid;
  name: string;
  subjectName: string;
  teacherNames: string[];
  weeklySchedule: WeeklySlot[];
  startDate: IsoDate | null;
  endDate: IsoDate | null;
  seatsLeft: number;
}

export interface DirectoryCenterDetail {
  id: Guid;
  name: string;
  classes: DirectoryClass[];
}

export interface ScheduleSeries {
  id: Guid;
  classId: Guid;
  teacherId: Guid;
  roomId: Guid;
  timeZoneId: string;
  startDate: IsoDate;
  endDate: IsoDate;
  localStartTime: LocalTime;
  durationMinutes: number;
  weekdays: string[];
  excludedDates: IsoDate[];
  generatedSessionCount: number;
  stoppedFromDate: IsoDate | null;
  replacesSeriesId: Guid | null;
  version: number;
  /** Display names resolved by the server on read endpoints; absent on write responses. */
  classCode?: string;
  className?: string;
  teacherName?: string;
  roomName?: string;
}

export interface ScheduleConflict {
  resourceType: string;
  existingSessionId: Guid | null;
}

export interface ScheduleOccurrence {
  occurrenceDate: IsoDate;
  startUtc: IsoDateTime;
  endUtc: IsoDateTime;
  conflicts: ScheduleConflict[];
}

export interface SchedulePreview {
  sessionCount: number;
  occurrences: ScheduleOccurrence[];
}

export interface ScheduleSeriesCreated {
  series: ScheduleSeries;
  sessionsCreated: number;
  firstStartUtc: IsoDateTime;
  lastEndUtc: IsoDateTime;
  replayed: boolean;
}

export interface ScheduleSeriesStopped {
  series: ScheduleSeries;
  sessionsCancelled: number;
}

export interface ScheduleSeriesReplaced {
  previousSeries: ScheduleSeries;
  replacement: ScheduleSeriesCreated;
  sessionsCancelled: number;
}

export type AttendanceMark =
  | "Unknown"
  | "Present"
  | "ExcusedAbsent"
  | "UnexcusedAbsent"
  | "Late";

export interface AttendanceStudent {
  studentId: Guid;
  studentCode: string;
  fullName: string;
  mark: AttendanceMark;
  note: string | null;
  /** B8: the center approved this student's absence request. */
  excusedAbsenceApproved?: boolean;
}

export interface AttendanceSheet {
  sessionId: Guid;
  classId: Guid;
  startUtc: IsoDateTime;
  status: string;
  version: number;
  actualTeacherId: Guid | null;
  note: string | null;
  submittedAtUtc: IsoDateTime | null;
  students: AttendanceStudent[];
  classCode?: string;
  className?: string;
  actualTeacherName?: string;
}

export interface AttendanceSnapshotStudent {
  studentId: Guid;
  mark: AttendanceMark;
  note: string | null;
}

export interface AttendanceSnapshot {
  status: string;
  actualTeacherId: Guid | null;
  note: string | null;
  students: AttendanceSnapshotStudent[];
}

export interface AttendanceRevision {
  version: number;
  action: string;
  actorUserId: Guid;
  reason: string | null;
  createdAtUtc: IsoDateTime;
  before: AttendanceSnapshot;
  after: AttendanceSnapshot;
  actorName?: string | null;
}

export interface OpenClass {
  id: Guid;
  subjectId: Guid;
  code: string;
  name: string;
  maxStudents: number;
  enrolledCount: number;
  registrationOpen: boolean;
}

export type ClassApplicationStatus = "Pending" | "Approved" | "Rejected";

export interface ClassApplication {
  id: Guid;
  submissionId: Guid;
  classId: Guid;
  fullName: string;
  status: ClassApplicationStatus | string;
  submittedAtUtc: IsoDateTime;
  reviewedAtUtc: IsoDateTime | null;
  reviewReason: string | null;
  classCode?: string;
  className?: string;
  parentName?: string | null;
  parentPhone?: string | null;
  reviewedByName?: string | null;
  /** After approval: sessions that clash with another center (count only, B5). */
  otherCenterConflictCount?: number | null;
}

export interface StudentSession {
  id: Guid;
  classId: Guid;
  teacherId: Guid;
  roomId: Guid;
  startUtc: IsoDateTime;
  endUtc: IsoDateTime;
  status?: SessionStatus;
  statusReason?: string | null;
  isRescheduled?: boolean;
  rescheduleReason?: string | null;
  isMakeup?: boolean;
  /** Display names resolved by the server on read endpoints; absent on write responses. */
  classCode?: string;
  className?: string;
  teacherName?: string;
  roomName?: string;
}

export interface CenterInvitation {
  invitationId: Guid;
  centerId: Guid;
  email: string;
  role: string;
  expiresAtUtc: IsoDateTime;
}

export interface AcceptedInvitation {
  userId: Guid;
  centerId: Guid;
  email: string;
  role: string;
}

export interface CurrentUser {
  id: Guid;
  username?: string | null;
  email: string;
  emailVerified: boolean;
  roles: string[];
  hasPassword: boolean;
  hasGoogle: boolean;
}

export type CenterMemberRole = "CenterOwner" | "CenterAdmin" | "Teacher" | "Staff";
export type AssignableMemberRole = Exclude<CenterMemberRole, "CenterOwner">;

export interface CenterMember {
  membershipId: Guid;
  userId: Guid;
  username?: string | null;
  email: string;
  role: CenterMemberRole | string;
  isActive: boolean;
  joinedAtUtc: IsoDateTime;
}

export interface MemberInvitation {
  id: Guid;
  email: string;
  role: CenterMemberRole | string;
  createdAtUtc: IsoDateTime;
  expiresAtUtc: IsoDateTime;
  accountExists: boolean;
}

export interface InvitationPreview {
  centerId: Guid;
  centerName: string;
  email: string;
  role: CenterMemberRole | string;
  expiresAtUtc: IsoDateTime;
  accountExists: boolean;
}

export interface AcceptedMembership {
  centerId: Guid;
  centerName: string;
  role: CenterMemberRole | string;
}

export interface MyTeaching {
  teacher?: Teacher | null;
  sessions: TeachingSession[];
}

/* ---- QUY-TAC: personal schedule, conflicts, schedule changes, student requests ---- */

export type ScheduleRole = "Student" | "Teacher";

export interface MyScheduleEntry {
  sessionId: Guid;
  centerId: Guid;
  role: ScheduleRole | string;
  classId: Guid;
  startUtc: IsoDateTime;
  endUtc: IsoDateTime;
  status: SessionStatus | string;
  centerName?: string | null;
  classCode?: string | null;
  className?: string | null;
  teacherName?: string | null;
  roomName?: string | null;
  statusReason?: string | null;
  isRescheduled: boolean;
  rescheduleReason?: string | null;
  previousStartUtc?: IsoDateTime | null;
  previousEndUtc?: IsoDateTime | null;
  isMakeup: boolean;
  /** Other active entries (any center) at the same time. */
  overlapsWith: Guid[];
  absenceRequestStatus?: "Pending" | "Approved" | string | null;
}

export interface MySchedule {
  entries: MyScheduleEntry[];
  centers: Array<{ id: Guid; name: string }>;
}

export interface ConflictItem {
  startUtc: IsoDateTime;
  endUtc: IsoDateTime;
  classId: Guid;
  otherStartUtc: IsoDateTime;
  otherEndUtc: IsoDateTime;
  sameCenter: boolean;
  otherClassCode?: string | null;
  otherClassName?: string | null;
  otherCenterName?: string | null;
  betweenSelected?: boolean;
}

/** B5: what joining a class clashes with; other centers only as a count. */
export interface ScheduleCheck {
  sameCenterConflicts: ConflictItem[];
  otherCenterConflictCount: number;
}

export interface ApplicationCheck {
  classes: Array<{ classId: Guid; conflicts: ConflictItem[] }>;
}

export interface SessionImpactStudent {
  studentId: Guid;
  studentCode: string;
  fullName: string;
  otherClassCode: string;
  otherClassName: string;
  otherStartUtc: IsoDateTime;
  otherEndUtc: IsoDateTime;
}

export interface SessionImpact {
  affectedStudentCount: number;
  isUrgent: boolean;
  sameCenterConflicts: SessionImpactStudent[];
  otherCenterConflictStudentCount: number;
  studentsWithoutAccount: number;
  /** Sessions the same teacher (same login) teaches at other centers in that time. Omitted when 0. */
  teacherSessionsElsewhere?: number;
}

export type ScheduleChangeKind =
  | "SessionAdded"
  | "SessionRescheduled"
  | "SessionCancelled"
  | "SessionNotHeld"
  | "MakeupScheduled"
  | "SeriesStopped"
  | "SeriesReplaced"
  | "StudentEnrolled";

export interface NoticeResponseCounts {
  notified: number;
  withoutAccount: number;
  seen: number;
  acknowledged: number;
  pendingRequests: number;
  requestsByKind: Record<string, number>;
}

export interface ScheduleChange {
  id: Guid;
  kind: ScheduleChangeKind | string;
  classId: Guid;
  sessionId: Guid | null;
  seriesId: Guid | null;
  oldStartUtc: IsoDateTime | null;
  oldEndUtc: IsoDateTime | null;
  newStartUtc: IsoDateTime | null;
  newEndUtc: IsoDateTime | null;
  reason: string | null;
  isUrgent: boolean;
  affectedSessionCount: number;
  firstAffectedStartUtc: IsoDateTime | null;
  createdAtUtc: IsoDateTime;
  classCode?: string | null;
  className?: string | null;
  oldTeacherName?: string | null;
  newTeacherName?: string | null;
  oldRoomName?: string | null;
  newRoomName?: string | null;
  actorName?: string | null;
  responses?: NoticeResponseCounts | null;
}

export interface MyNotice {
  id: Guid;
  centerId: Guid;
  classId: Guid;
  kind: ScheduleChangeKind | string;
  sessionId: Guid | null;
  oldStartUtc: IsoDateTime | null;
  oldEndUtc: IsoDateTime | null;
  newStartUtc: IsoDateTime | null;
  newEndUtc: IsoDateTime | null;
  reason: string | null;
  isUrgent: boolean;
  affectedSessionCount: number;
  firstAffectedStartUtc: IsoDateTime | null;
  conflictCount: number;
  createdAtUtc: IsoDateTime;
  seenAtUtc: IsoDateTime | null;
  response: "None" | "Acknowledged" | "Requested" | string;
  centerName?: string | null;
  classCode?: string | null;
  className?: string | null;
}

export interface MyNoticePage {
  page: number;
  pageSize: number;
  totalCount: number;
  unreadCount: number;
  items: MyNotice[];
}

export type StudentRequestKind = "ExcusedAbsence" | "Makeup" | "Transfer" | "Withdrawal";
export type StudentRequestStatus = "Pending" | "Approved" | "Rejected" | "Cancelled";

export interface StudentRequest {
  id: Guid;
  centerId: Guid;
  kind: StudentRequestKind | string;
  status: StudentRequestStatus | string;
  classId: Guid;
  sessionId: Guid | null;
  targetClassId: Guid | null;
  studentId: Guid;
  reason: string;
  submittedAtUtc: IsoDateTime;
  reviewedAtUtc: IsoDateTime | null;
  reviewNote: string | null;
  version: number;
  centerName?: string | null;
  classCode?: string | null;
  className?: string | null;
  targetClassCode?: string | null;
  targetClassName?: string | null;
  sessionStartUtc?: IsoDateTime | null;
  sessionEndUtc?: IsoDateTime | null;
  studentCode?: string | null;
  studentName?: string | null;
  reviewedByName?: string | null;
  otherCenterConflictCount?: number | null;
}

// ---------------- Tuition (docs/HOC-PHI.md) ----------------

export type ChargeStatus = "Paid" | "Partial" | "Unpaid" | "Overdue";
export type ChargeFilter = "All" | "Open" | "Overdue" | "Paid" | "Missed";
export type PaymentMethod = "Cash" | "BankTransfer";
export type DiscountKind = "Percent" | "Amount";
export type MissedKind = "ExcusedAbsent" | "UnexcusedAbsent" | "Cancelled" | "NotHeld";

export interface TuitionPage<T> {
  page: number;
  pageSize: number;
  totalCount: number;
  items: T[];
}

export interface MissedSession {
  sessionId: Guid;
  startUtc: IsoDateTime;
  kind: MissedKind;
  reason: string | null;
  hasMakeup: boolean;
}

export interface TuitionCharge {
  id: Guid;
  classId: Guid;
  classCode: string;
  className: string;
  studentId: Guid;
  studentCode: string;
  studentName: string;
  cycleNumber: number;
  periodStart: IsoDate;
  periodEnd: IsoDate;
  monthlyFee: number;
  listAmount: number;
  discountAmount: number;
  amount: number;
  paid: number;
  remaining: number;
  dueDate: IsoDate;
  status: ChargeStatus;
  joinSessions: number | null;
  periodSessions: number | null;
  endedOn: IsoDate | null;
  endedSessionsAttended: number | null;
  endedSessionsTotal: number | null;
  endedValue: number | null;
  waivedAmount: number;
  remindedAtUtc: IsoDateTime | null;
  missed: MissedSession[];
  billedSessions: number;
  perSessionAmount: number;
  adjustmentAmount: number;
  adjustmentSessions: number | null;
  adjustmentReason: string | null;
  adjustedAtUtc: IsoDateTime | null;
  adjustedByName: string | null;
}

export interface ReceiptLine {
  chargeId: Guid;
  classCode: string;
  className: string;
  cycleNumber: number;
  periodStart: IsoDate;
  periodEnd: IsoDate;
  amount: number;
}

export interface Receipt {
  id: Guid;
  number: number;
  numberText: string;
  studentId: Guid;
  studentCode: string;
  studentName: string;
  payerName: string | null;
  method: PaymentMethod;
  amount: number;
  allocated: number;
  credit: number;
  receivedOn: IsoDate;
  note: string | null;
  createdAtUtc: IsoDateTime;
  createdByName: string | null;
  voidedAtUtc: IsoDateTime | null;
  voidedByName: string | null;
  voidReason: string | null;
  lines: ReceiptLine[];
}

export interface TuitionDiscount {
  id: Guid;
  studentId: Guid;
  classId: Guid;
  className: string;
  kind: DiscountKind;
  value: number;
  fromDate: IsoDate;
  toDate: IsoDate | null;
  reason: string;
  createdAtUtc: IsoDateTime;
  createdByName: string | null;
  revokedAtUtc: IsoDateTime | null;
}

export interface StudentClassCycle {
  classId: Guid;
  classCode: string;
  className: string;
  active: boolean;
  currentPeriodStart: IsoDate | null;
  currentPeriodEnd: IsoDate | null;
  nextPeriodStart: IsoDate | null;
  monthlyFee: number | null;
}

export interface BankAccount {
  bankBin: string;
  accountNumber: string;
  accountName: string;
}

export interface StudentTuition {
  centerId: Guid;
  centerName: string;
  studentId: Guid;
  studentCode: string;
  studentName: string;
  parentName: string | null;
  parentPhone: string | null;
  hasAccount: boolean;
  owed: number;
  overdue: number;
  credit: number;
  transferContent: string;
  bank: BankAccount | null;
  classes: StudentClassCycle[];
  charges: TuitionCharge[];
  receipts: Receipt[];
  discounts: TuitionDiscount[];
}

export interface ClassFeeHistory {
  monthlyFee: number;
  effectiveFrom: IsoDate;
  createdAtUtc: IsoDateTime;
  createdByName: string | null;
}

export interface ClassFeeRow {
  classId: Guid;
  classCode: string;
  className: string;
  isArchived: boolean;
  currentFee: number | null;
  nextFee: number | null;
  nextFeeFrom: IsoDate | null;
  firstSessionDate: IsoDate | null;
  currentPeriodStart: IsoDate | null;
  currentPeriodEnd: IsoDate | null;
  activeStudents: number;
  currentCycleBilled: number;
  currentCyclePaid: number;
  history: ClassFeeHistory[];
}

export interface TuitionSummary {
  owed: number;
  overdue: number;
  overdueStudents: number;
  unpaidCharges: number;
  collectedThisMonth: number;
  credit: number;
  classesWithoutFee: number;
  today: IsoDate;
}

export interface FinanceSettings {
  bankBin: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  dueDays: number;
  emailReminders: boolean;
  version: number;
}

export interface MyTuition {
  centers: StudentTuition[];
}

// ---------------- Payroll (docs/LUONG-VA-CHIA-THU-NHAP.md) ----------------

/** RevenueShare = M1 (family: collected tuition shared by who taught); PerSession = M2 (sessions × rate). */
export type PayrollMode = "RevenueShare" | "PerSession";
export type PayrollMonthStatus = "Draft" | "Closed";

export interface PayrollConfigChange {
  id: Guid;
  previousEnabled: boolean;
  previousMode: PayrollMode;
  enabled: boolean;
  mode: PayrollMode;
  effectiveMonth: string;
  reason: string;
  actorName?: string | null;
  createdAtUtc: IsoDateTime;
}

export interface PayrollConfig {
  centerId: Guid;
  enabled: boolean;
  mode: PayrollMode;
  effectiveMonth?: string | null;
  enabledThisMonth: boolean;
  modeThisMonth: PayrollMode;
  currentMonth: string;
  latestClosedMonth?: string | null;
  version: number;
  history: PayrollConfigChange[];
}

export interface PayrollStatus {
  enabled: boolean;
  mode: PayrollMode;
  currentMonth: string;
  myTeacherId?: Guid | null;
  canSeeAll: boolean;
  canEdit: boolean;
  canCloseAndPay: boolean;
}

export interface PayrollMonthSummary {
  month: string;
  mode: PayrollMode;
  status: PayrollMonthStatus;
  teachers: number;
  sessions: number;
  net: number;
  paid: number;
  warnings: number;
  openDisputes: number;
}

export interface PayrollClassLine {
  classId: Guid;
  classCode: string;
  className: string;
  sessions: number;
  minutes: number;
  amount: number;
}

export interface PayrollSessionItem {
  sessionId: Guid;
  classId: Guid;
  classCode: string;
  startUtc: IsoDateTime;
  minutes: number;
  amount?: number | null;
  substitute: boolean;
}

export interface PayrollLine {
  teacherId: Guid;
  teacherCode: string;
  teacherName: string;
  sessions: number;
  minutes: number;
  base: number;
  adjustments: number;
  carried: number;
  net: number;
  paid: number;
  remaining: number;
  classes: PayrollClassLine[];
  items: PayrollSessionItem[];
  carriedFrom: Array<{ fromMonth: string; amount: number }>;
}

export interface PayrollPool {
  collected: number;
  prepaid: number;
  unassigned: number;
  expenses: number;
  distributable: number;
  unassignedItems: Array<{ classId: Guid; classCode: string; periodStart: IsoDate; periodEnd: IsoDate; amount: number }>;
}

export interface PayrollAdjustment {
  id: Guid;
  teacherId: Guid;
  teacherName: string;
  amount: number;
  reason: string;
  createdByName?: string | null;
  createdAtUtc: IsoDateTime;
  voidedAtUtc?: IsoDateTime | null;
  voidReason?: string | null;
}

export interface SharedExpense {
  id: Guid;
  spentOn: IsoDate;
  category: string;
  amount: number;
  note: string;
  createdByName?: string | null;
  voidedAtUtc?: IsoDateTime | null;
  voidReason?: string | null;
}

export interface PayrollPayout {
  id: Guid;
  numberText: string;
  month: string;
  teacherId: Guid;
  teacherName: string;
  amount: number;
  method: PaymentMethod;
  paidOn: IsoDate;
  note?: string | null;
  advance: boolean;
  createdByName?: string | null;
  createdAtUtc: IsoDateTime;
  voidedAtUtc?: IsoDateTime | null;
  voidReason?: string | null;
}

export interface PayrollDispute {
  id: Guid;
  teacherId: Guid;
  teacherName: string;
  message: string;
  createdAtUtc: IsoDateTime;
  resolvedAtUtc?: IsoDateTime | null;
  resolvedByName?: string | null;
  resolution?: string | null;
}

export interface PayrollMonth {
  month: string;
  mode: PayrollMode;
  status: PayrollMonthStatus;
  closedAtUtc?: IsoDateTime | null;
  closedByName?: string | null;
  closeBlockers: string[];
  canReopen: boolean;
  pool?: PayrollPool | null;
  lines: PayrollLine[];
  adjustments: PayrollAdjustment[];
  expenses: SharedExpense[];
  payouts: PayrollPayout[];
  disputes: PayrollDispute[];
  unsubmitted: Array<{ sessionId: Guid; classCode: string; startUtc: IsoDateTime; teacherName: string }>;
  missingRates: PayrollSessionItem[];
  events: Array<{ kind: "Closed" | "Reopened"; reason?: string | null; actorName?: string | null; createdAtUtc: IsoDateTime }>;
}

export interface PayRate {
  id: Guid;
  teacherId: Guid;
  teacherName: string;
  classId?: Guid | null;
  classCode?: string | null;
  amount: number;
  effectiveFrom: IsoDate;
  createdByName?: string | null;
  createdAtUtc: IsoDateTime;
  voidedAtUtc?: IsoDateTime | null;
  voidReason?: string | null;
}

export interface MyEarningsMonth {
  month: string;
  status: PayrollMonthStatus;
  sessions: number;
  minutes: number;
  net: number;
  paid: number;
  remaining: number;
}

export interface MyEarningsCenter {
  centerId: Guid;
  centerName: string;
  mode: PayrollMode;
  teacherIds: Guid[];
  yearNet: number;
  yearPaid: number;
  yearSessions: number;
  yearMinutes: number;
  months: MyEarningsMonth[];
}

export interface MyEarnings {
  year: number;
  yearNet: number;
  yearPaid: number;
  yearSessions: number;
  yearMinutes: number;
  months: MyEarningsMonth[];
  centers: MyEarningsCenter[];
}

// ───────── Platform email (outbox status, test send) ─────────

export type OutboxEmailStatus = "Pending" | "Retrying" | "Sent" | "Skipped" | "Failed";

export interface OutboxEmail {
  id: Guid;
  recipient: string;
  subject: string;
  status: OutboxEmailStatus;
  attempts: number;
  lastError?: string | null;
  createdAtUtc: IsoDateTime;
  processedAtUtc?: IsoDateTime | null;
  nextAttemptAtUtc?: IsoDateTime | null;
}

export interface EmailOverview {
  pending: number;
  retrying: number;
  failed: number;
  sentLast24Hours: number;
  maximumAttempts: number;
  recent: OutboxEmail[];
}

export interface PayrollCenterConfigSummary {
  centerId: Guid;
  centerName: string;
  centerStatus: string;
  enabledThisMonth: boolean;
  modeThisMonth: PayrollMode;
  nextMonth?: string | null;
  nextEnabled?: boolean | null;
  nextMode?: PayrollMode | null;
  latestClosedMonth?: string | null;
  lastChangedAtUtc?: IsoDateTime | null;
  lastChangedBy?: string | null;
}

export interface PayrollConfigOverview {
  currentMonth: string;
  centers: PayrollCenterConfigSummary[];
}
