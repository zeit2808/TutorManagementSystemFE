import { apiRequest } from "./http";
import type {
  ChargeFilter,
  ClassFeeRow,
  DiscountKind,
  FinanceSettings,
  Guid,
  IsoDate,
  MyTuition,
  PaymentIntent,
  PaymentMethod,
  Receipt,
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
  updateSettings(centerId: Guid, input: Omit<FinanceSettings, "version"> & { expectedVersion: number }) {
    return apiRequest<FinanceSettings>(`/centers/${centerId}/tuition/settings`, { method: "PUT", body: input });
  },
  myTuition() {
    return apiRequest<MyTuition>(`/me/tuition`);
  },
  createMyPaymentIntent(studentId: Guid, chargeIds: Guid[] = []) {
    return apiRequest<PaymentIntent>(`/me/tuition/students/${studentId}/payment-intents`, { method: "POST", body: { chargeIds } });
  },
};
