import { apiRequest } from "./http";
import type {
  BankTransfer,
  BankTransferFilter,
  ChargeFilter,
  ClassFeeRow,
  DiscountKind,
  FinanceSettings,
  Guid,
  IsoDate,
  MyTuition,
  PaymentIntent,
  PaymentMethod,
  PaymentAlert,
  PaymentAlertState,
  PaymentMetrics,
  PaymentProvider,
  ReconciliationRun,
  PaymentProviderMode,
  Receipt,
  ShadowReport,
  StudentTuition,
  TuitionCharge,
  TuitionPage,
  TuitionSummary,
} from "./types";

export interface RecordPaymentInput {
  amount: number;
  method: PaymentMethod;
  receivedOn?: IsoDate;
  payerName?: string;
  note?: string;
  chargeIds?: Guid[];
  requestId?: Guid;
}

export interface AddDiscountInput {
  classId: Guid;
  kind: DiscountKind;
  value: number;
  fromDate: IsoDate;
  toDate?: IsoDate | null;
  reason: string;
}

/** Tuition (docs/HOC-PHI.md). Teachers get 403 on every center route. */
export const financeApi = {
  summary(centerId: Guid) {
    return apiRequest<TuitionSummary>(`/centers/${centerId}/tuition/summary`);
  },
  classFees(centerId: Guid) {
    return apiRequest<ClassFeeRow[]>(`/centers/${centerId}/tuition/classes`);
  },
  setClassFee(centerId: Guid, classId: Guid, monthlyFee: number) {
    return apiRequest<ClassFeeRow>(`/centers/${centerId}/classes/${classId}/fee`, { method: "PUT", body: { monthlyFee } });
  },
  charges(centerId: Guid, query: { status?: ChargeFilter; classId?: Guid; studentId?: Guid; search?: string; page?: number; pageSize?: number } = {}) {
    return apiRequest<TuitionPage<TuitionCharge>>(`/centers/${centerId}/tuition/charges`, { query });
  },
  adjustCharge(centerId: Guid, chargeId: Guid, input: { amount: number; sessions?: number | null; reason?: string | null }) {
    return apiRequest<TuitionCharge>(`/centers/${centerId}/tuition/charges/${chargeId}/adjustment`, { method: "PUT", body: input });
  },
  student(centerId: Guid, studentId: Guid) {
    return apiRequest<StudentTuition>(`/centers/${centerId}/students/${studentId}/tuition`);
  },
  createPaymentIntent(centerId: Guid, studentId: Guid, chargeIds: Guid[] = []) {
    return apiRequest<PaymentIntent>(`/centers/${centerId}/students/${studentId}/payment-intents`, { method: "POST", body: { chargeIds } });
  },
  recordPayment(centerId: Guid, studentId: Guid, input: RecordPaymentInput) {
    return apiRequest<Receipt>(`/centers/${centerId}/students/${studentId}/receipts`, { method: "POST", body: input });
  },
  receipts(centerId: Guid, query: { from?: IsoDate; to?: IsoDate; method?: PaymentMethod; search?: string; includeVoided?: boolean; page?: number; pageSize?: number } = {}) {
    return apiRequest<TuitionPage<Receipt>>(`/centers/${centerId}/receipts`, { query });
  },
  receipt(centerId: Guid, receiptId: Guid) {
    return apiRequest<Receipt>(`/centers/${centerId}/receipts/${receiptId}`);
  },
  voidReceipt(centerId: Guid, receiptId: Guid, reason: string) {
    return apiRequest<Receipt>(`/centers/${centerId}/receipts/${receiptId}/void`, { method: "POST", body: { reason } });
  },
  addDiscount(centerId: Guid, studentId: Guid, input: AddDiscountInput) {
    return apiRequest<StudentTuition>(`/centers/${centerId}/students/${studentId}/discounts`, { method: "POST", body: input });
  },
  revokeDiscount(centerId: Guid, discountId: Guid) {
    return apiRequest<StudentTuition>(`/centers/${centerId}/discounts/${discountId}/revoke`, { method: "POST" });
  },
  settings(centerId: Guid) {
    return apiRequest<FinanceSettings>(`/centers/${centerId}/tuition/settings`);
  },
  /** Changing the bank account needs the owner and `currentPassword` (D7); every owner is emailed. */
  updateSettings(centerId: Guid, input: Omit<FinanceSettings, "version"> & { expectedVersion: number; currentPassword?: string }) {
    return apiRequest<FinanceSettings>(`/centers/${centerId}/tuition/settings`, { method: "PUT", body: input });
  },
  // ---------------- bank feed (docs/THANH-TOAN-QR-KE-HOACH.md) ----------------
  paymentProvider(centerId: Guid) {
    return apiRequest<PaymentProvider>(`/centers/${centerId}/tuition/payment-provider`);
  },
  /** Owner only, with the password. Leave secrets empty to keep the stored ones. Auto only from Shadow. */
  savePaymentProvider(centerId: Guid, input: { currentPassword: string; mode: PaymentProviderMode; webhookSecret?: string; apiToken?: string; expectedVersion: number }) {
    return apiRequest<PaymentProvider>(`/centers/${centerId}/tuition/payment-provider`, { method: "PUT", body: input });
  },
  pullNow(centerId: Guid) {
    return apiRequest<PaymentProvider>(`/centers/${centerId}/tuition/payment-provider/pull`, { method: "POST" });
  },
  shadowReport(centerId: Guid, from: IsoDate, to: IsoDate) {
    return apiRequest<ShadowReport>(`/centers/${centerId}/tuition/payment-provider/shadow-report`, { query: { from, to } });
  },
  bankTransfers(centerId: Guid, query: { status?: BankTransferFilter; page?: number; pageSize?: number } = {}) {
    return apiRequest<TuitionPage<BankTransfer>>(`/centers/${centerId}/bank-transactions`, { query });
  },
  assignTransfer(centerId: Guid, transferId: Guid, input: { studentId: Guid; expectedVersion: number; chargeIds?: Guid[] }) {
    return apiRequest<BankTransfer>(`/centers/${centerId}/bank-transactions/${transferId}/assign`, { method: "POST", body: input });
  },
  ignoreTransfer(centerId: Guid, transferId: Guid, input: { reason: string; expectedVersion: number }) {
    return apiRequest<BankTransfer>(`/centers/${centerId}/bank-transactions/${transferId}/ignore`, { method: "POST", body: input });
  },
  resolveHeldTransfer(centerId: Guid, transferId: Guid, input: { isDuplicate: boolean; reason: string; expectedVersion: number }) {
    return apiRequest<BankTransfer>(`/centers/${centerId}/bank-transactions/${transferId}/resolve-held`, { method: "POST", body: input });
  },
  // ---------------- reconciliation and alerts (Đợt 5) ----------------
  reconciliations(centerId: Guid, query: { page?: number; pageSize?: number } = {}) {
    return apiRequest<TuitionPage<ReconciliationRun>>(`/centers/${centerId}/tuition/payment-provider/reconciliations`, { query });
  },
  reconciliation(centerId: Guid, runId: Guid) {
    return apiRequest<ReconciliationRun>(`/centers/${centerId}/tuition/payment-provider/reconciliations/${runId}`);
  },
  /** Owner: reconcile now; the Worker starts within half a minute. */
  reconcileNow(centerId: Guid) {
    return apiRequest<boolean>(`/centers/${centerId}/tuition/payment-provider/reconciliations`, { method: "POST" });
  },
  paymentAlerts(centerId: Guid, state: PaymentAlertState | "All" = "Open") {
    return apiRequest<PaymentAlert[]>(`/centers/${centerId}/tuition/payment-provider/alerts`, { query: { state } });
  },
  /** Owner: seen; no more reminders. */
  acknowledgeAlert(centerId: Guid, alertId: Guid) {
    return apiRequest<PaymentAlert>(`/centers/${centerId}/tuition/payment-provider/alerts/${alertId}/acknowledge`, { method: "POST" });
  },
  paymentMetrics(centerId: Guid, days = 7) {
    return apiRequest<PaymentMetrics>(`/centers/${centerId}/tuition/payment-provider/metrics`, { query: { days } });
  },
  retryTransfer(centerId: Guid, transferId: Guid, expectedVersion: number) {
    return apiRequest<BankTransfer>(`/centers/${centerId}/bank-transactions/${transferId}/retry`, { method: "POST", body: { expectedVersion } });
  },
  myTuition() {
    return apiRequest<MyTuition>(`/me/tuition`);
  },
  createMyPaymentIntent(studentId: Guid, chargeIds: Guid[] = []) {
    return apiRequest<PaymentIntent>(`/me/tuition/students/${studentId}/payment-intents`, { method: "POST", body: { chargeIds } });
  },
};
