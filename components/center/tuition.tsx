"use client";

import { useState } from "react";
import Link from "next/link";
import { Ban, CalendarX2, Coins, Printer, ReceiptText, RefreshCcw, Search, Settings2, Tags, WalletCards } from "lucide-react";
import {
  financeApi,
  type ChargeFilter,
  type ClassFeeRow,
  type FinanceSettings,
  type PaymentMethod,
  type Receipt,
  type TuitionCharge,
  type TuitionSummary,
} from "@/lib/api";
import { useAction, useResource } from "@/lib/hooks/use-resource";
import { useCenterLookups } from "@/lib/hooks/use-lookups";
import { formatDateTime, formatIsoDate, formatMoney, formatPeriod, formatStartLabel } from "@/lib/format";
import { chargeStatus, missedKindLabels, paymentMethodLabels } from "@/lib/labels";
import { BANKS, bankName, vietQrUrl } from "@/lib/banks";
import { Badge, Button, Dialog, EmptyState, ErrorNotice, Field, Notice, PageHeader, Pagination, Panel, Segmented, SkeletonRows, Toggle } from "@/components/ui/primitives";
import { ReasonDialog } from "@/components/ui/reason-dialog";
import { RoleGate, useCenter } from "./center-frame";

type Tab = "charges" | "receipts" | "fees" | "settings";

/** Tuition for the center (docs/HOC-PHI.md): who owes what, receipts, class fees and settings. */
export function TuitionWorkspace() {
  return (
    <RoleGate need="finance">
      <Inner />
    </RoleGate>
  );
}

function Inner() {
  const { centerId } = useCenter();
  const [tab, setTab] = useState<Tab>("charges");
  const summary = useResource(() => financeApi.summary(centerId), [centerId]);
  const refresh = () => void summary.reload();
  return (
    <>
      <PageHeader
        title="Học phí"
        description="Thu theo tháng, mỗi kỳ tính từ buổi học đầu tiên của lớp. Học sinh vào giữa kỳ đóng theo số buổi; nghỉ giữa kỳ thì đã đóng bao nhiêu giữ bấy nhiêu. Buổi nghỉ không tự trừ tiền — trung tâm tự quyết."
        meta={
          <Segmented label="Mục" value={tab} onChange={setTab} options={[
            { value: "charges", label: "Công nợ" },
            { value: "receipts", label: "Biên lai" },
            { value: "fees", label: "Học phí lớp" },
            { value: "settings", label: "Cài đặt" },
          ]} />
        }
      />
      <SummaryStrip summary={summary.data} />
      {summary.data && summary.data.classesWithoutFee > 0 && tab !== "fees" && (
        <Notice tone="warning" title={`${summary.data.classesWithoutFee} lớp đang có học sinh nhưng chưa đặt học phí`} action={<Button size="sm" onClick={() => setTab("fees")}>Đặt học phí</Button>}>
          Lớp chưa có học phí thì chưa lập khoản thu nào.
        </Notice>
      )}
      {tab === "charges" && <ChargesTab onChanged={refresh} />}
      {tab === "receipts" && <ReceiptsTab onChanged={refresh} />}
      {tab === "fees" && <FeesTab onChanged={refresh} />}
      {tab === "settings" && <SettingsTab />}
    </>
  );
}

export function SummaryStrip({ summary }: { summary: TuitionSummary | undefined }) {
  return (
    <dl className="money-strip" aria-label="Tổng quan học phí">
      <div><dt>Còn phải thu</dt><dd>{summary ? formatMoney(summary.owed) : "…"}</dd><span>{summary ? `${summary.unpaidCharges} khoản chưa đủ` : ""}</span></div>
      <div className={summary && summary.overdue > 0 ? "is-danger" : undefined}><dt>Quá hạn</dt><dd>{summary ? formatMoney(summary.overdue) : "…"}</dd><span>{summary ? `${summary.overdueStudents} học sinh` : ""}</span></div>
      <div><dt>Đã thu tháng này</dt><dd>{summary ? formatMoney(summary.collectedThisMonth) : "…"}</dd><span>Theo ngày thu trên biên lai</span></div>
      <div><dt>Số dư của học sinh</dt><dd>{summary ? formatMoney(summary.credit) : "…"}</dd><span>Tiền đóng trước, tự trừ kỳ sau</span></div>
    </dl>
  );
}

// ---------------- charges ----------------

/** Status of a charge; a cycle closed by leaving with nothing paid reads "không thu", not "đã đóng". */
export function ChargeBadge({ charge }: { charge: TuitionCharge }) {
  if (charge.endedOn && charge.amount === 0) return <Badge tone="neutral">Đã nghỉ · không thu</Badge>;
  const state = chargeStatus[charge.status] ?? { label: charge.status, tone: "neutral" as const };
  return <Badge tone={state.tone}>{state.label}</Badge>;
}

/** Small notes under an amount: mid-cycle join, discounts, the center's reduction, early leave. */
export function ChargeNotes({ charge }: { charge: TuitionCharge }) {
  return (
    <>
      {charge.joinSessions != null && charge.periodSessions != null && (
        <p className="cell-note">Vào giữa kỳ: {charge.joinSessions}/{charge.periodSessions} buổi × {formatMoney(charge.monthlyFee)}</p>
      )}
      {charge.discountAmount > 0 && <p className="cell-note">Miễn giảm −{formatMoney(charge.discountAmount)}</p>}
      {charge.adjustmentAmount > 0 && (
        <p className="cell-note" title={charge.adjustmentReason ?? undefined}>Giảm buổi nghỉ −{formatMoney(charge.adjustmentAmount)}</p>
      )}
      {charge.endedOn && (
        <p className="cell-note">
          Nghỉ học {formatIsoDate(charge.endedOn)}: đã học {charge.endedSessionsAttended}/{charge.endedSessionsTotal} buổi ≈ {formatMoney(charge.endedValue)} —{" "}
          {charge.amount > 0 ? `đã thu ${formatMoney(charge.amount)}` : "không thu"}
        </p>
      )}
    </>
  );
}

function ChargesTab({ onChanged }: { onChanged: () => void }) {
  const { centerId, canManage } = useCenter();
  const lookups = useCenterLookups(centerId);
  const [status, setStatus] = useState<ChargeFilter>("Open");
  const [classId, setClassId] = useState("");
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [missed, setMissed] = useState<TuitionCharge | null>(null);
  const list = useResource(
    () => financeApi.charges(centerId, { status, classId: classId || undefined, search: search || undefined, page, pageSize: 25 }),
    [centerId, status, classId, search, page],
  );
  const data = list.data;
  return (
    <Panel flush>
      <div className="toolbar">
        <Segmented label="Lọc" value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={[
          { value: "Open", label: "Còn nợ" },
          { value: "Overdue", label: "Quá hạn" },
          { value: "Missed", label: "Có buổi nghỉ" },
          { value: "Paid", label: "Đã đóng" },
          { value: "All", label: "Tất cả" },
        ]} />
        <label className="select-inline"><span>Lớp</span>
          <select value={classId} onChange={(event) => { setClassId(event.target.value); setPage(1); }}>
            <option value="">Mọi lớp</option>
            {(lookups.data?.classes ?? []).map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
          </select>
        </label>
        <form className="search" role="search" onSubmit={(event) => { event.preventDefault(); setSearch(term.trim()); setPage(1); }}>
          <Search aria-hidden="true" />
          <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Tên, mã học sinh hoặc lớp" aria-label="Tìm học sinh" maxLength={100} />
        </form>
        <Button size="sm" variant="ghost" icon={<RefreshCcw aria-hidden="true" />} onClick={() => void list.reload()} pending={list.loading && Boolean(data)}>Làm mới</Button>
      </div>
      <ErrorNotice error={list.error} onReload={() => void list.reload()} />
      {!data ? <SkeletonRows rows={6} columns={6} /> : data.items.length === 0 ? (
        <EmptyState icon={<WalletCards aria-hidden="true" />} title={status === "Open" ? "Không còn khoản nào chưa đóng" : "Không có khoản thu phù hợp"}>
          Khoản thu được lập khi một kỳ bắt đầu, cho lớp đã đặt học phí.
        </EmptyState>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table tuition-table">
              <thead><tr><th>Học sinh</th><th>Lớp · kỳ</th><th className="num">Phải đóng</th><th className="num">Đã đóng</th><th className="num">Còn</th><th>Hạn</th><th>Buổi nghỉ</th><th>Trạng thái</th><th className="col-actions"><span className="sr-only">Thao tác</span></th></tr></thead>
              <tbody>
                {data.items.map((item) => {
                  return (
                    <tr key={item.id}>
                      <td><Link className="text-link" href={`/centers/${centerId}/tuition/students/${item.studentId}`}><strong>{item.studentName}</strong></Link><p className="cell-note"><code className="code">{item.studentCode}</code></p></td>
                      <td><strong>{item.className}</strong><p className="cell-note">Kỳ {item.cycleNumber} · {formatPeriod(item.periodStart, item.periodEnd)}</p></td>
                      <td className="num"><strong>{formatMoney(item.amount)}</strong><ChargeNotes charge={item} /></td>
                      <td className="num">{formatMoney(item.paid)}</td>
                      <td className="num">{item.remaining > 0 ? <strong>{formatMoney(item.remaining)}</strong> : "—"}</td>
                      <td className="col-muted">{formatIsoDate(item.dueDate)}</td>
                      <td>
                        {item.missed.length > 0 ? (
                          <Button size="sm" variant="ghost" icon={<CalendarX2 aria-hidden="true" />} onClick={() => setMissed(item)}>{item.missed.length} buổi</Button>
                        ) : <span className="col-muted">—</span>}
                      </td>
                      <td><ChargeBadge charge={item} /></td>
                      <td className="col-actions">
                        {item.remaining > 0 && (
                          <Link className="btn btn-secondary btn-sm" href={`/centers/${centerId}/tuition/students/${item.studentId}?pay=${item.id}`}><Coins aria-hidden="true" />Thu tiền</Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.totalCount} onChange={setPage} />
        </>
      )}
      {missed && (
        <MissedSessionsDialog
          charge={missed}
          canManage={canManage}
          onClose={() => setMissed(null)}
          onSaved={() => { setMissed(null); void list.reload(); onChanged(); }}
        />
      )}
    </Panel>
  );
}

/**
 * H18: the sessions of a cycle the student missed or the center did not hold, and the center's own choice to
 * reduce the cycle (never automatic).
 */
export function MissedSessionsDialog({ charge, canManage, onClose, onSaved }: { charge: TuitionCharge; canManage: boolean; onClose: () => void; onSaved: () => void }) {
  const { centerId } = useCenter();
  const action = useAction();
  const centerMissed = charge.missed.filter((item) => (item.kind === "Cancelled" || item.kind === "NotHeld") && !item.hasMakeup).length;
  const [sessions, setSessions] = useState<number>(charge.adjustmentSessions ?? (centerMissed || charge.missed.length));
  const [amount, setAmount] = useState<number>(charge.adjustmentAmount || sessions * charge.perSessionAmount);
  const [reason, setReason] = useState(charge.adjustmentReason ?? "");
  const [touched, setTouched] = useState(false);
  const max = charge.listAmount - charge.discountAmount;
  const ended = Boolean(charge.endedOn);
  const amountError = amount < 0 || amount % 1000 !== 0 ? "Số tiền phải là bội của 1.000đ." : amount > max ? `Tối đa ${formatMoney(max)}.` : null;
  const reasonError = amount > 0 && reason.trim().length < 3 ? "Ghi lý do (ít nhất 3 ký tự)." : null;

  async function save(value: number) {
    setTouched(true);
    if (value > 0 && (amountError || reasonError)) return;
    const result = await action.run(() => financeApi.adjustCharge(centerId, charge.id, {
      amount: value, sessions: value > 0 ? sessions : null, reason: value > 0 ? reason.trim() : null,
    }));
    if (result) onSaved();
  }

  return (
    <Dialog
      open
      size="md"
      title={`Buổi nghỉ · ${charge.studentName}`}
      description={`${charge.className}, kỳ ${charge.cycleNumber} (${formatPeriod(charge.periodStart, charge.periodEnd)}). Học phí không tự trừ khi có buổi nghỉ; trung tâm quyết định có giảm hay không.`}
      onClose={onClose}
      onSubmit={() => void save(amount)}
      footer={canManage && !ended ? (
        <>
          {charge.adjustmentAmount > 0 && <Button onClick={() => void save(0)} disabled={action.pending}>Bỏ giảm</Button>}
          <Button onClick={onClose} disabled={action.pending}>Đóng</Button>
          <Button type="submit" variant="primary" pending={action.pending}>Lưu giảm học phí</Button>
        </>
      ) : <Button onClick={onClose}>Đóng</Button>}
    >
      <ul className="missed-list">
        {charge.missed.map((item) => (
          <li key={`${item.sessionId}-${item.kind}`}>
            <Badge tone={item.kind === "Cancelled" || item.kind === "NotHeld" ? "warning" : "neutral"}>{missedKindLabels[item.kind] ?? item.kind}</Badge>
            <span>{formatStartLabel(item.startUtc)}</span>
            {item.reason && <span className="col-muted">· {item.reason}</span>}
            {item.hasMakeup && <Badge tone="success">Đã có buổi bù</Badge>}
          </li>
        ))}
      </ul>
      <p className="cell-note">Kỳ này tính {charge.billedSessions} buổi · mỗi buổi ≈ {formatMoney(charge.perSessionAmount)}. Phải đóng hiện tại: <strong>{formatMoney(charge.amount)}</strong>{charge.paid > 0 ? ` (đã đóng ${formatMoney(charge.paid)})` : ""}.</p>
      {ended ? (
        <Notice tone="info">Học sinh đã nghỉ trong kỳ này nên số tiền của kỳ đã được chốt.</Notice>
      ) : canManage ? (
        <div className="form-grid">
          <Field label="Số buổi được giảm">
            {(id) => <input id={id} type="number" min={0} max={100} value={sessions} onChange={(event) => {
              const next = Math.max(0, Math.min(100, Number(event.target.value) || 0));
              setSessions(next);
              setAmount(Math.min(max, next * charge.perSessionAmount));
            }} />}
          </Field>
          <Field label="Số tiền giảm" hint="Gợi ý = số buổi × tiền một buổi. Sửa được." error={touched ? amountError : null}>
            {(id, describedBy) => <input id={id} type="number" min={0} step={1000} max={max} value={amount} aria-describedby={describedBy} onChange={(event) => setAmount(Math.max(0, Number(event.target.value) || 0))} />}
          </Field>
          <Field label="Lý do" required error={touched ? reasonError : null} className="field-wide">
            {(id, describedBy) => <input id={id} value={reason} maxLength={300} aria-describedby={describedBy} placeholder="Ví dụ: Trung tâm huỷ buổi 01/03, chưa xếp bù" onChange={(event) => setReason(event.target.value)} />}
          </Field>
          {charge.paid > charge.amount - amount && amount > 0 && (
            <p className="cell-note field-wide">Kỳ này đã đóng {formatMoney(charge.paid)}: phần giảm sẽ thành số dư và tự trừ vào kỳ sau.</p>
          )}
        </div>
      ) : (
        <p className="cell-note">Chỉ chủ hoặc quản lý trung tâm quyết định giảm học phí.</p>
      )}
      {charge.adjustedAtUtc && charge.adjustmentAmount > 0 && (
        <p className="cell-note">Đã giảm {formatMoney(charge.adjustmentAmount)} lúc {formatDateTime(charge.adjustedAtUtc)}{charge.adjustedByName ? ` · ${charge.adjustedByName}` : ""}.</p>
      )}
      <ErrorNotice error={action.error} onDismiss={action.clearError} />
    </Dialog>
  );
}

// ---------------- receipts ----------------

function ReceiptsTab({ onChanged }: { onChanged: () => void }) {
  const { centerId, canManage } = useCenter();
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [voiding, setVoiding] = useState<Receipt | null>(null);
  const list = useResource(
    () => financeApi.receipts(centerId, { method: method || undefined, search: search || undefined, page, pageSize: 25 }),
    [centerId, method, search, page],
  );
  const data = list.data;
  return (
    <Panel flush>
      <div className="toolbar">
        <label className="select-inline"><span>Hình thức</span>
          <select value={method} onChange={(event) => { setMethod(event.target.value as PaymentMethod | ""); setPage(1); }}>
            <option value="">Tất cả</option>
            <option value="Cash">Tiền mặt</option>
            <option value="BankTransfer">Chuyển khoản</option>
          </select>
        </label>
        <form className="search" role="search" onSubmit={(event) => { event.preventDefault(); setSearch(term.trim()); setPage(1); }}>
          <Search aria-hidden="true" />
          <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Số biên lai, học sinh, người nộp" aria-label="Tìm biên lai" maxLength={100} />
        </form>
        <Button size="sm" variant="ghost" icon={<RefreshCcw aria-hidden="true" />} onClick={() => void list.reload()} pending={list.loading && Boolean(data)}>Làm mới</Button>
      </div>
      <ErrorNotice error={list.error} onReload={() => void list.reload()} />
      {!data ? <SkeletonRows rows={6} columns={6} /> : data.items.length === 0 ? (
        <EmptyState icon={<ReceiptText aria-hidden="true" />} title="Chưa có biên lai">Thu tiền từ trang học phí của từng học sinh (nút “Thu tiền” ở tab Công nợ).</EmptyState>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table tuition-table">
              <thead><tr><th>Số</th><th>Ngày thu</th><th>Học sinh</th><th>Hình thức</th><th className="num">Số tiền</th><th>Trả cho</th><th>Người thu</th><th className="col-actions"><span className="sr-only">Thao tác</span></th></tr></thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id} className={item.voidedAtUtc ? "row-voided" : undefined}>
                    <td><code className="code">{item.numberText}</code>{item.voidedAtUtc && <p><Badge tone="danger">Đã huỷ</Badge></p>}</td>
                    <td className="col-muted">{formatIsoDate(item.receivedOn)}</td>
                    <td><Link className="text-link" href={`/centers/${centerId}/tuition/students/${item.studentId}`}>{item.studentName}</Link><p className="cell-note">{item.studentCode}{item.payerName ? ` · ${item.payerName} nộp` : ""}</p></td>
                    <td>{paymentMethodLabels[item.method] ?? item.method}</td>
                    <td className="num"><strong>{formatMoney(item.amount)}</strong></td>
                    <td>
                      {item.lines.map((line) => <p className="cell-note" key={line.chargeId}>{line.className} kỳ {line.cycleNumber}: {formatMoney(line.amount)}</p>)}
                      {item.credit > 0 && <p className="cell-note">Số dư: {formatMoney(item.credit)}</p>}
                      {item.voidReason && <p className="cell-note">Lý do huỷ: {item.voidReason}</p>}
                    </td>
                    <td className="col-muted">{item.createdByName ?? "—"}<p className="cell-note">{formatDateTime(item.createdAtUtc)}</p></td>
                    <td className="col-actions">
                      <Link className="btn btn-ghost btn-sm" href={`/centers/${centerId}/tuition/receipts/${item.id}`}><Printer aria-hidden="true" />In</Link>
                      {canManage && !item.voidedAtUtc && <Button size="sm" variant="ghost" icon={<Ban aria-hidden="true" />} onClick={() => setVoiding(item)}>Huỷ</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.totalCount} onChange={setPage} />
        </>
      )}
      <VoidReceiptDialog receipt={voiding} onClose={() => setVoiding(null)} onDone={() => { setVoiding(null); void list.reload(); onChanged(); }} />
    </Panel>
  );
}

export function VoidReceiptDialog({ receipt, onClose, onDone }: { receipt: Receipt | null; onClose: () => void; onDone: () => void }) {
  const { centerId } = useCenter();
  return (
    <ReasonDialog
      open={Boolean(receipt)}
      title={`Huỷ biên lai ${receipt?.numberText ?? ""}?`}
      description={receipt ? `${formatMoney(receipt.amount)} của ${receipt.studentName}. Biên lai vẫn được giữ kèm lý do; số tiền không còn được tính, các khoản đã trả bằng biên lai này quay lại thành nợ.` : undefined}
      confirmLabel="Huỷ biên lai"
      variant="danger"
      minLength={3}
      maxLength={300}
      placeholder="Ví dụ: Ghi nhầm số tiền"
      onClose={onClose}
      onConfirm={async (reason) => {
        if (!receipt) return;
        await financeApi.voidReceipt(centerId, receipt.id, reason);
        onDone();
      }}
    />
  );
}

// ---------------- class fees ----------------

function FeesTab({ onChanged }: { onChanged: () => void }) {
  const { centerId, canManage } = useCenter();
  const list = useResource(() => financeApi.classFees(centerId), [centerId]);
  const [editing, setEditing] = useState<ClassFeeRow | null>(null);
  const rows = list.data;
  return (
    <Panel flush>
      <ErrorNotice error={list.error} onReload={() => void list.reload()} />
      {!rows ? <SkeletonRows rows={5} columns={6} /> : rows.length === 0 ? (
        <EmptyState icon={<Tags aria-hidden="true" />} title="Chưa có lớp">Tạo lớp ở mục Lớp học rồi đặt học phí tại đây.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table tuition-table">
            <thead><tr><th>Lớp</th><th>Kỳ đang chạy</th><th className="num">Học phí / tháng</th><th>Kỳ sau</th><th className="num">Đang học</th><th className="num">Kỳ này đã thu</th><th className="col-actions"><span className="sr-only">Thao tác</span></th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.classId}>
                  <td><strong>{row.className}</strong><p className="cell-note"><code className="code">{row.classCode}</code>{row.isArchived ? " · đã lưu trữ" : ""}</p></td>
                  <td>
                    {row.currentPeriodStart && row.currentPeriodEnd ? formatPeriod(row.currentPeriodStart, row.currentPeriodEnd) : <span className="col-muted">Chưa học buổi nào</span>}
                    {row.firstSessionDate && <p className="cell-note">Buổi đầu: {formatIsoDate(row.firstSessionDate)}</p>}
                  </td>
                  <td className="num">{row.currentFee != null ? <strong>{formatMoney(row.currentFee)}</strong> : <Badge tone="warning">Chưa đặt</Badge>}</td>
                  <td>{row.nextFee != null ? <>{formatMoney(row.nextFee)}<p className="cell-note">từ {formatIsoDate(row.nextFeeFrom)}</p></> : <span className="col-muted">—</span>}</td>
                  <td className="num">{row.activeStudents}</td>
                  <td className="num">{row.currentCycleBilled > 0 ? `${formatMoney(row.currentCyclePaid)} / ${formatMoney(row.currentCycleBilled)}` : "—"}</td>
                  <td className="col-actions">
                    {canManage && !row.isArchived && (
                      <Button size="sm" variant={row.currentFee == null ? "primary" : "ghost"} icon={<Tags aria-hidden="true" />} onClick={() => setEditing(row)}>
                        {row.currentFee == null && row.nextFee == null ? "Đặt học phí" : "Đổi học phí"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <FeeDialog row={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); void list.reload(); onChanged(); }} />
      )}
    </Panel>
  );
}

function FeeDialog({ row, onClose, onDone }: { row: ClassFeeRow; onClose: () => void; onDone: () => void }) {
  const { centerId } = useCenter();
  const action = useAction();
  const first = row.history.length === 0;
  const [fee, setFee] = useState<number>(row.nextFee ?? row.currentFee ?? 0);
  const [touched, setTouched] = useState(false);
  const error = fee < 0 || fee > 100_000_000 || fee % 1000 !== 0 ? "Nhập số tiền 0–100.000.000đ, bội của 1.000đ." : null;
  async function save() {
    setTouched(true);
    if (error) return;
    if (await action.run(() => financeApi.setClassFee(centerId, row.classId, fee))) onDone();
  }
  return (
    <Dialog
      open
      size="md"
      title={`${first ? "Đặt" : "Đổi"} học phí · ${row.className}`}
      description={first
        ? "Lần đặt đầu tiên áp dụng luôn cho kỳ đang chạy (các kỳ trước không truy thu). Khoản thu được lập ngay cho học sinh đang học."
        : `Mức mới áp dụng từ kỳ sau${row.currentPeriodEnd ? ` (từ ngày sau ${formatIsoDate(row.currentPeriodEnd)})` : ""}. Các kỳ đã lập giữ nguyên số tiền.`}
      onClose={onClose}
      onSubmit={() => void save()}
      footer={<><Button onClick={onClose} disabled={action.pending}>Hủy</Button><Button type="submit" variant="primary" pending={action.pending}>Lưu</Button></>}
    >
      <Field label="Học phí mỗi tháng (đ)" required hint={fee > 0 ? formatMoney(fee) : "Nhập 0 nếu lớp miễn phí."} error={touched ? error : null}>
        {(id, describedBy) => <input id={id} type="number" min={0} step={1000} value={fee} aria-describedby={describedBy} onChange={(event) => setFee(Math.max(0, Number(event.target.value) || 0))} />}
      </Field>
      {row.history.length > 0 && (
        <>
          <p className="field-label">Lịch sử giá</p>
          <ul className="plain-list">
            {row.history.map((item) => (
              <li key={item.createdAtUtc} className="cell-note">{formatMoney(item.monthlyFee)} · từ {formatIsoDate(item.effectiveFrom)} · {formatDateTime(item.createdAtUtc)}{item.createdByName ? ` · ${item.createdByName}` : ""}</li>
            ))}
          </ul>
        </>
      )}
      <ErrorNotice error={action.error} onDismiss={action.clearError} />
    </Dialog>
  );
}

// ---------------- settings ----------------

function SettingsTab() {
  const { centerId } = useCenter();
  const settings = useResource(() => financeApi.settings(centerId), [centerId]);
  const [saved, setSaved] = useState(false);
  if (!settings.data) return <Panel><ErrorNotice error={settings.error} onReload={() => void settings.reload()} />{!settings.error && <SkeletonRows rows={3} columns={2} />}</Panel>;
  return (
    <>
      {saved && <Notice tone="success" onDismiss={() => setSaved(false)}>Đã lưu cài đặt học phí.</Notice>}
      <SettingsForm key={settings.data.version} initial={settings.data} onSaved={(value) => { settings.setData(value); setSaved(true); }} />
    </>
  );
}

function SettingsForm({ initial, onSaved }: { initial: FinanceSettings; onSaved: (value: FinanceSettings) => void }) {
  const { centerId, canManage } = useCenter();
  const action = useAction();
  const [bankBin, setBankBin] = useState(initial.bankBin ?? "");
  const [account, setAccount] = useState(initial.bankAccountNumber ?? "");
  const [name, setName] = useState(initial.bankAccountName ?? "");
  const [dueDays, setDueDays] = useState(initial.dueDays);
  const [emailReminders, setEmailReminders] = useState(initial.emailReminders);
  const anyBank = Boolean(bankBin || account.trim() || name.trim());
  const bankError = anyBank && (!bankBin || !/^[A-Za-z0-9]{4,20}$/.test(account.trim()) || name.trim().length < 2)
    ? "Chọn ngân hàng, nhập số tài khoản (4–20 chữ/số) và tên chủ tài khoản — hoặc để trống cả ba." : null;

  async function save() {
    if (bankError) return;
    const result = await action.run(() => financeApi.updateSettings(centerId, {
      bankBin: bankBin || null, bankAccountNumber: account.trim() || null, bankAccountName: name.trim() || null,
      dueDays, emailReminders, expectedVersion: initial.version,
    }));
    if (result) onSaved(result);
  }

  return (
    <div className="detail-grid detail-grid-wide">
      <Panel title="Tài khoản nhận tiền & hạn đóng" description="Tài khoản này hiện thành mã VietQR ở trang học phí của học sinh và trong cổng học sinh.">
        <form className="form-grid panel-body" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <Field label="Ngân hàng">
            {(id) => (
              <select id={id} value={bankBin} disabled={!canManage} onChange={(event) => setBankBin(event.target.value)}>
                <option value="">— Không dùng chuyển khoản —</option>
                {BANKS.map((bank) => <option key={bank.bin} value={bank.bin}>{bank.name}</option>)}
              </select>
            )}
          </Field>
          <Field label="Số tài khoản">
            {(id) => <input id={id} value={account} disabled={!canManage} maxLength={20} inputMode="numeric" onChange={(event) => setAccount(event.target.value)} />}
          </Field>
          <Field label="Tên chủ tài khoản" hint="Viết hoa không dấu, đúng như ngân hàng ghi." error={bankError} className="field-wide">
            {(id, describedBy) => <input id={id} value={name} disabled={!canManage} maxLength={100} aria-describedby={describedBy} onChange={(event) => setName(event.target.value.toUpperCase())} />}
          </Field>
          <Field label="Hạn đóng (số ngày từ đầu kỳ)" hint="Quá hạn thì học sinh được nhắc trong app và một email.">
            {(id, describedBy) => <input id={id} type="number" min={0} max={60} value={dueDays} disabled={!canManage} aria-describedby={describedBy} onChange={(event) => setDueDays(Math.max(0, Math.min(60, Number(event.target.value) || 0)))} />}
          </Field>
          <div className="field">
            <Toggle checked={emailReminders} onChange={setEmailReminders} label="Gửi email nhắc khi quá hạn" disabled={!canManage} />
          </div>
          {canManage && <div className="field-wide"><Button type="submit" variant="primary" icon={<Settings2 aria-hidden="true" />} pending={action.pending}>Lưu cài đặt</Button></div>}
        </form>
        {!canManage && <p className="cell-note">Chỉ chủ hoặc quản lý trung tâm sửa được cài đặt này.</p>}
        <ErrorNotice error={action.error} onDismiss={action.clearError} />
      </Panel>
      <Panel title="Xem trước mã QR">
        {bankBin && account.trim() && name.trim() && !bankError ? (
          <div className="qr-box">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={vietQrUrl({ bankBin, accountNumber: account.trim(), accountName: name.trim(), amount: 800000, content: "HS000001 HOC PHI" })} alt="Mã VietQR mẫu" width={220} height={220} />
            <p className="cell-note">{bankName(bankBin)} · {account.trim()} · {name.trim()}</p>
            <p className="cell-note">Mẫu: 800.000đ, nội dung “HS000001 HOC PHI”.</p>
          </div>
        ) : <p className="cell-note">Nhập tài khoản để xem mã.</p>}
      </Panel>
    </div>
  );
}
