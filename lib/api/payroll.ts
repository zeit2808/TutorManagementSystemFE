import { apiRequest } from "./http";
import type {
  Guid,
  IsoDate,
  MyEarnings,
  PaymentMethod,
  PayRate,
  PayrollConfig,
  PayrollConfigOverview,
  PayrollMode,
  PayrollMonth,
  PayrollMonthSummary,
  PayrollStatus,
} from "./types";

/** Payroll & revenue sharing (docs/LUONG-VA-CHIA-THU-NHAP.md). */
export const payrollApi = {
  // platform admin (A1/A2): the switch only
  configOverview() {
    return apiRequest<PayrollConfigOverview>("/platform/payroll-configs");
  },
  config(centerId: Guid) {
    return apiRequest<PayrollConfig>(`/platform/centers/${centerId}/payroll-config`);
  },
  setConfig(centerId: Guid, input: { enabled: boolean; mode: PayrollMode; effectiveMonth: string; reason: string; expectedVersion: number }) {
    return apiRequest<PayrollConfig>(`/platform/centers/${centerId}/payroll-config`, { method: "PUT", body: input });
  },
  // center
  status(centerId: Guid) {
    return apiRequest<PayrollStatus>(`/centers/${centerId}/payroll/status`);
  },
  months(centerId: Guid) {
    return apiRequest<PayrollMonthSummary[]>(`/centers/${centerId}/payroll/months`);
  },
  month(centerId: Guid, month: string) {
    return apiRequest<PayrollMonth>(`/centers/${centerId}/payroll/months/${month}`);
  },
  close(centerId: Guid, month: string) {
    return apiRequest<PayrollMonth>(`/centers/${centerId}/payroll/months/${month}/close`, { method: "POST" });
  },
  reopen(centerId: Guid, month: string, reason: string) {
    return apiRequest<PayrollMonth>(`/centers/${centerId}/payroll/months/${month}/reopen`, { method: "POST", body: { reason } });
  },
  addAdjustment(centerId: Guid, month: string, input: { teacherId: Guid; amount: number; reason: string }) {
    return apiRequest<PayrollMonth>(`/centers/${centerId}/payroll/months/${month}/adjustments`, { method: "POST", body: input });
  },
  voidAdjustment(centerId: Guid, id: Guid, reason: string) {
    return apiRequest<PayrollMonth>(`/centers/${centerId}/payroll/adjustments/${id}/void`, { method: "POST", body: { reason } });
  },
  addExpense(centerId: Guid, month: string, input: { amount: number; spentOn: IsoDate; category: string; note: string }) {
    return apiRequest<PayrollMonth>(`/centers/${centerId}/payroll/months/${month}/expenses`, { method: "POST", body: input });
  },
  voidExpense(centerId: Guid, id: Guid, reason: string) {
    return apiRequest<PayrollMonth>(`/centers/${centerId}/payroll/expenses/${id}/void`, { method: "POST", body: { reason } });
  },
  rates(centerId: Guid) {
    return apiRequest<PayRate[]>(`/centers/${centerId}/payroll/rates`);
  },
  addRate(centerId: Guid, input: { teacherId: Guid; classId?: Guid | null; amount: number; effectiveFrom: IsoDate }) {
    return apiRequest<PayRate>(`/centers/${centerId}/payroll/rates`, { method: "POST", body: input });
  },
  voidRate(centerId: Guid, id: Guid, reason: string) {
    return apiRequest<PayRate>(`/centers/${centerId}/payroll/rates/${id}/void`, { method: "POST", body: { reason } });
  },
  addPayout(centerId: Guid, month: string, input: { teacherId: Guid; amount: number; method: PaymentMethod; paidOn?: IsoDate; note?: string; requestId?: Guid }) {
    return apiRequest<PayrollMonth>(`/centers/${centerId}/payroll/months/${month}/payouts`, { method: "POST", body: input });
  },
  voidPayout(centerId: Guid, id: Guid, reason: string) {
    return apiRequest<PayrollMonth>(`/centers/${centerId}/payroll/payouts/${id}/void`, { method: "POST", body: { reason } });
  },
  addDispute(centerId: Guid, month: string, message: string) {
    return apiRequest<PayrollMonth>(`/centers/${centerId}/payroll/months/${month}/disputes`, { method: "POST", body: { message } });
  },
  resolveDispute(centerId: Guid, id: Guid, note: string) {
    return apiRequest<PayrollMonth>(`/centers/${centerId}/payroll/disputes/${id}/resolve`, { method: "POST", body: { note } });
  },
  // C15
  myEarnings(year?: number) {
    return apiRequest<MyEarnings>(`/me/earnings`, { query: { year } });
  },
};
