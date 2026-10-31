"use client";

import { useState } from "react";
import { Ban, CalendarX2, Coins, Percent, Printer, ReceiptText } from "lucide-react";
import { financeApi, type DiscountKind, type PaymentMethod, type Receipt, type StudentTuition, type TuitionCharge } from "@/lib/api";
import { useAction, useResource } from "@/lib/hooks/use-resource";
import { formatDateTime, formatIsoDate, formatMoney, formatPeriod, formatPhone, newUuid, todayIso } from "@/lib/format";
import { paymentMethodLabels } from "@/lib/labels";
import { PaymentQr } from "./payment-qr";
import { Badge, Button, Dialog, EmptyState, ErrorNotice, Field, Notice, PageHeader, Panel, Segmented, SkeletonRows, BackButton, ButtonLink } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/reason-dialog";
import { RoleGate, useCenter } from "./center-frame";
import { ChargeBadge, ChargeNotes, MissedSessionsDialog, VoidReceiptDialog } from "./tuition";

/** One student's tuition at the center: cycles, payments with VietQR, receipts and discounts. */
export function StudentTuitionPage({ studentId, payChargeId }: { studentId: string; payChargeId?: string }) {
  return (
    <RoleGate need="finance">
      <Inner studentId={studentId} payChargeId={payChargeId} />
    </RoleGate>
  );
}

function Inner({ studentId, payChargeId }: { studentId: string; payChargeId?: string }) {
  const { centerId, canManage } = useCenter();
  const account = useResource(() => financeApi.student(centerId, studentId), [centerId, studentId]);
  const [missed, setMissed] = useState<TuitionCharge | null>(null);
  const [voiding, setVoiding] = useState<Receipt | null>(null);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const data = account.data;
  const reload = () => void account.reload();

  return (
    <>
      <BackButton href={`/centers/${centerId}/tuition`}>Học phí</BackButton>
      <PageHeader
        title={data ? `Học phí · ${data.studentName}` : "Học phí học sinh"}
        description={data ? [data.parentName && `Phụ huynh ${data.parentName}`, data.parentPhone && formatPhone(data.parentPhone), data.hasAccount && "đã kích hoạt tài khoản"].filter(Boolean).join(" · ") || undefined : undefined}
        actions={canManage && data && data.classes.length > 0 ? <Button icon={<Percent aria-hidden="true" />} onClick={() => setDiscountOpen(true)}>Thêm miễn giảm</Button> : undefined}
      />
      <ErrorNotice error={account.error} onReload={reload} />
      {notice && <Notice tone="success" onDismiss={() => setNotice(null)}>{notice}</Notice>}
      {!data ? <Panel><SkeletonRows rows={5} columns={5} /></Panel> : (
        <>
          <dl className="money-strip money-strip-3">
            <div className={data.owed > 0 ? "is-warning" : undefined}><dt>Còn phải đóng</dt><dd>{formatMoney(data.owed)}</dd></div>
            <div className={data.overdue > 0 ? "is-danger" : undefined}><dt>Trong đó quá hạn</dt><dd>{formatMoney(data.overdue)}</dd></div>
            <div><dt>Số dư (đóng trước)</dt><dd>{formatMoney(data.credit)}</dd></div>
          </dl>
          <div className="detail-grid detail-grid-wide">
            <div className="stack">
              <Panel title="Các kỳ học phí" description="Mỗi kỳ một tháng tính từ buổi đầu của lớp. Vắng vẫn tính tiền; buổi nghỉ chỉ giảm khi trung tâm quyết định." flush>
                {data.charges.length === 0 ? (
                  <EmptyState icon={<Coins aria-hidden="true" />} title="Chưa có khoản thu">Khoản thu được lập khi kỳ bắt đầu, cho lớp đã đặt học phí.</EmptyState>
                ) : (
                  <div className="table-wrap">
                    <table className="table tuition-table">
                      <thead><tr><th>Lớp · kỳ</th><th className="num">Phải đóng</th><th className="num">Đã đóng</th><th>Hạn</th><th>Trạng thái</th><th className="col-actions"><span className="sr-only">Thao tác</span></th></tr></thead>
                      <tbody>
                        {data.charges.map((item) => {
                          return (
                            <tr key={item.id}>
                              <td><strong>{item.className}</strong><p className="cell-note">Kỳ {item.cycleNumber} · {formatPeriod(item.periodStart, item.periodEnd)}</p></td>
                              <td className="num"><strong>{formatMoney(item.amount)}</strong><ChargeNotes charge={item} /></td>
                              <td className="num">{formatMoney(item.paid)}{item.remaining > 0 && <p className="cell-note">còn {formatMoney(item.remaining)}</p>}</td>
                              <td className="col-muted">{formatIsoDate(item.dueDate)}</td>
                              <td><ChargeBadge charge={item} /></td>
                              <td className="col-actions">
                                {item.missed.length > 0 && (
                                  <Button size="sm" variant="ghost" icon={<CalendarX2 aria-hidden="true" />} onClick={() => setMissed(item)}>{item.missed.length} buổi nghỉ</Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>

              <Panel title="Biên lai" flush>
                {data.receipts.length === 0 ? (
                  <EmptyState icon={<ReceiptText aria-hidden="true" />} title="Chưa thu lần nào" />
                ) : (
                  <div className="table-wrap">
                    <table className="table tuition-table">
                      <thead><tr><th>Số</th><th>Ngày</th><th className="num">Số tiền</th><th>Trả cho</th><th className="col-actions"><span className="sr-only">Thao tác</span></th></tr></thead>
                      <tbody>
                        {data.receipts.map((item) => (
                          <tr key={item.id} className={item.voidedAtUtc ? "row-voided" : undefined}>
                            <td><code className="code">{item.numberText}</code>{item.voidedAtUtc && <p><Badge tone="danger">Đã huỷ</Badge></p>}</td>
                            <td className="col-muted">{formatIsoDate(item.receivedOn)}<p className="cell-note">{paymentMethodLabels[item.method]}</p></td>
                            <td className="num"><strong>{formatMoney(item.amount)}</strong></td>
                            <td>
                              {item.lines.map((line) => <p className="cell-note" key={line.chargeId}>{line.className} kỳ {line.cycleNumber}: {formatMoney(line.amount)}</p>)}
                              {item.credit > 0 && <p className="cell-note">Số dư: {formatMoney(item.credit)}</p>}
                              {item.voidReason && <p className="cell-note">Lý do huỷ: {item.voidReason}</p>}
                            </td>
                            <td className="col-actions">
                              <ButtonLink size="sm" variant="ghost" icon={<Printer aria-hidden="true" />} href={`/centers/${centerId}/tuition/receipts/${item.id}`}>In</ButtonLink>
                              {canManage && !item.voidedAtUtc && <Button size="sm" variant="ghost" icon={<Ban aria-hidden="true" />} onClick={() => setVoiding(item)}>Huỷ</Button>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>

              {data.discounts.length > 0 && (
                <Panel title="Miễn giảm">
                  <ul className="plain-list">
                    {data.discounts.map((item) => (
                      <li key={item.id} className="discount-row">
                        <span>
                          <strong>{item.kind === "Percent" ? `${item.value}%` : formatMoney(item.value)}</strong> · {item.className} · từ kỳ bắt đầu {formatIsoDate(item.fromDate)}{item.toDate ? ` đến ${formatIsoDate(item.toDate)}` : ""}
                          <span className="cell-note"> — {item.reason}{item.createdByName ? ` · ${item.createdByName}` : ""}</span>
                        </span>
                        {item.revokedAtUtc ? <Badge tone="neutral">Đã dừng {formatDateTime(item.revokedAtUtc)}</Badge>
                          : canManage && <Button size="sm" variant="ghost" onClick={() => setRevoking(item.id)}>Dừng</Button>}
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}
            </div>

            <PaymentPanel key={`${data.owed}-${data.credit}-${data.receipts.length}`} account={data} payChargeId={payChargeId} onDone={(receipt) => {
              setNotice(`Đã ghi biên lai ${receipt.numberText}: ${formatMoney(receipt.amount)}${receipt.credit > 0 ? `, trong đó ${formatMoney(receipt.credit)} thành số dư` : ""}.`);
              reload();
            }} />
          </div>
        </>
      )}
      {missed && <MissedSessionsDialog charge={missed} canManage={canManage} onClose={() => setMissed(null)} onSaved={() => { setMissed(null); reload(); }} />}
      <VoidReceiptDialog receipt={voiding} onClose={() => setVoiding(null)} onDone={() => { setVoiding(null); reload(); }} />
      {discountOpen && data && (
        <DiscountDialog account={data} onClose={() => setDiscountOpen(false)} onDone={(next) => { setDiscountOpen(false); account.setData(next); setNotice("Đã thêm miễn giảm và tính lại các kỳ liên quan."); }} />
      )}
      <ConfirmDialog
        open={Boolean(revoking)}
        title="Dừng miễn giảm này?"
        confirmLabel="Dừng miễn giảm"
        variant="danger"
        onClose={() => setRevoking(null)}
        onConfirm={async () => {
          if (!revoking) return;
          account.setData(await financeApi.revokeDiscount(centerId, revoking));
          setRevoking(null);
        }}
      >
        Các kỳ lập từ bây giờ không còn được giảm. Các kỳ đã lập giữ nguyên số tiền.
      </ConfirmDialog>
    </>
  );
}

function PaymentPanel({ account, payChargeId, onDone }: { account: StudentTuition; payChargeId?: string; onDone: (receipt: Receipt) => void }) {
  const { centerId } = useCenter();
  const action = useAction();
  const open = account.charges.filter((item) => item.remaining > 0).sort((a, b) => a.periodStart.localeCompare(b.periodStart));
  const [selected, setSelected] = useState<string[]>(payChargeId && open.some((x) => x.id === payChargeId) ? [payChargeId] : []);
  const suggested = selected.length > 0 ? open.filter((x) => selected.includes(x.id)).reduce((sum, x) => sum + x.remaining, 0) : account.owed;
  const [amount, setAmount] = useState<number>(suggested);
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [receivedOn, setReceivedOn] = useState(todayIso());
  const [payer, setPayer] = useState(account.parentName ?? "");
  const [note, setNote] = useState("");
  const [requestId, setRequestId] = useState(newUuid());
  const [touched, setTouched] = useState(false);
  const amountError = amount <= 0 ? "Nhập số tiền đã nhận." : null;

  function toggle(id: string) {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    setSelected(next);
    setAmount(next.length > 0 ? open.filter((x) => next.includes(x.id)).reduce((sum, x) => sum + x.remaining, 0) : account.owed);
  }

  async function submit() {
    setTouched(true);
    if (amountError) return;
    const receipt = await action.run(() => financeApi.recordPayment(centerId, account.studentId, {
      amount, method, receivedOn, payerName: payer.trim() || undefined, note: note.trim() || undefined,
      chargeIds: selected, requestId,
    }));
    if (receipt) {
      setRequestId(newUuid());
      setSelected([]);
      setTouched(false);
      setNote("");
      onDone(receipt);
    }
  }

  return (
    <Panel title="Thu tiền" description="Tiền được trả cho các kỳ đã chọn trước, rồi các kỳ cũ nhất; phần thừa thành số dư và tự trừ vào kỳ sau." className="payment-panel">
      <form className="stack panel-body" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        {open.length > 0 && (
          <fieldset className="stack-tight">
            <legend className="field-label">Trả cho kỳ (không chọn = cũ nhất trước)</legend>
            {open.map((item) => (
              <label key={item.id} className="choice-inline">
                <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} />
                {item.className} kỳ {item.cycleNumber} · còn {formatMoney(item.remaining)}
              </label>
            ))}
          </fieldset>
        )}
        <Field label="Số tiền nhận (đ)" required error={touched ? amountError : null} hint={amount > 0 ? formatMoney(amount) : undefined}>
          {(id, describedBy) => <input id={id} type="number" min={0} step={1000} value={amount} aria-describedby={describedBy} onChange={(event) => setAmount(Math.max(0, Number(event.target.value) || 0))} />}
        </Field>
        <Segmented label="Hình thức" value={method} onChange={setMethod} options={[{ value: "Cash", label: "Tiền mặt" }, { value: "BankTransfer", label: "Chuyển khoản" }]} />
        {method === "BankTransfer" && (!account.bank ? (
          <Notice tone="info">Chưa có tài khoản ngân hàng: chủ hoặc quản lý thêm ở Học phí → Cài đặt để hiện mã QR.</Notice>
        ) : open.length === 0 ? (
          <Notice tone="info">Học sinh không còn khoản nào cần đóng nên không có mã QR.</Notice>
        ) : (
          <PaymentQr load={() => financeApi.createPaymentIntent(centerId, account.studentId, selected)}
            deps={[centerId, account.studentId, selected, account.owed]}
            note="Số tiền trên mã tính theo các kỳ đã chọn, không theo ô Số tiền nhận." />
        ))}
        <div className="form-grid">
          <Field label="Ngày nhận">
            {(id) => <input id={id} type="date" value={receivedOn} max={todayIso()} onChange={(event) => setReceivedOn(event.target.value)} />}
          </Field>
          <Field label="Người nộp">
            {(id) => <input id={id} value={payer} maxLength={150} onChange={(event) => setPayer(event.target.value)} />}
          </Field>
          <Field label="Ghi chú" className="field-wide">
            {(id) => <input id={id} value={note} maxLength={300} onChange={(event) => setNote(event.target.value)} />}
          </Field>
        </div>
        <Button type="submit" variant="primary" icon={<Coins aria-hidden="true" />} pending={action.pending} status={action.status}>Ghi biên lai {amount > 0 ? formatMoney(amount) : ""}</Button>
        <ErrorNotice error={action.error} onDismiss={action.clearError} />
      </form>
    </Panel>
  );
}

function DiscountDialog({ account, onClose, onDone }: { account: StudentTuition; onClose: () => void; onDone: (next: StudentTuition) => void }) {
  const { centerId } = useCenter();
  const action = useAction();
  const [classId, setClassId] = useState(account.classes.find((x) => x.active)?.classId ?? account.classes[0]?.classId ?? "");
  const cls = account.classes.find((x) => x.classId === classId);
  const [kind, setKind] = useState<DiscountKind>("Percent");
  const [value, setValue] = useState<number>(10);
  const [from, setFrom] = useState<"current" | "next" | "custom">("current");
  const [customFrom, setCustomFrom] = useState(todayIso());
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const fromDate = from === "current" ? cls?.currentPeriodStart ?? todayIso() : from === "next" ? cls?.nextPeriodStart ?? todayIso() : customFrom;
  const valueError = kind === "Percent" ? (value < 1 || value > 100 ? "Từ 1 đến 100%." : null)
    : value <= 0 || value % 1000 !== 0 ? "Số tiền dương, bội của 1.000đ." : null;
  const reasonError = reason.trim().length < 3 ? "Ghi lý do (ít nhất 3 ký tự)." : null;

  async function save() {
    setTouched(true);
    if (valueError || reasonError || !classId) return;
    const next = await action.run(() => financeApi.addDiscount(centerId, account.studentId, {
      classId, kind, value, fromDate, toDate: toDate || null, reason: reason.trim(),
    }));
    if (next) onDone(next);
  }

  return (
    <Dialog
      open
      size="md"
      title={`Miễn giảm · ${account.studentName}`}
      description="Áp dụng cho các kỳ bắt đầu trong khoảng đã chọn; kỳ đã lập trong khoảng đó được tính lại (phần đã đóng dư thành số dư)."
      onClose={onClose}
      onSubmit={() => void save()}
      footer={<><Button onClick={onClose} disabled={action.pending}>Hủy</Button><Button type="submit" variant="primary" pending={action.pending} status={action.status}>Lưu miễn giảm</Button></>}
    >
      <div className="form-grid">
        <Field label="Lớp" className="field-wide">
          {(id) => (
            <select id={id} value={classId} onChange={(event) => setClassId(event.target.value)}>
              {account.classes.map((item) => <option key={item.classId} value={item.classId}>{item.className}{item.active ? "" : " (đã rời)"}</option>)}
            </select>
          )}
        </Field>
        <div className="field">
          <span className="field-label">Kiểu</span>
          <Segmented label="Kiểu miễn giảm" value={kind} onChange={(next) => { setKind(next); setValue(next === "Percent" ? 10 : 100000); }} options={[{ value: "Percent", label: "Theo %" }, { value: "Amount", label: "Số tiền" }]} />
        </div>
        <Field label={kind === "Percent" ? "Phần trăm" : "Số tiền mỗi kỳ (đ)"} required error={touched ? valueError : null}>
          {(id, describedBy) => <input id={id} type="number" min={kind === "Percent" ? 1 : 1000} max={kind === "Percent" ? 100 : undefined} step={kind === "Percent" ? 1 : 1000} value={value} aria-describedby={describedBy} onChange={(event) => setValue(Number(event.target.value) || 0)} />}
        </Field>
        <Field label="Áp dụng từ" className="field-wide">
          {(id) => (
            <select id={id} value={from} onChange={(event) => setFrom(event.target.value as typeof from)}>
              <option value="current">Kỳ đang chạy{cls?.currentPeriodStart ? ` (${formatIsoDate(cls.currentPeriodStart)})` : ""}</option>
              <option value="next">Kỳ sau{cls?.nextPeriodStart ? ` (${formatIsoDate(cls.nextPeriodStart)})` : ""}</option>
              <option value="custom">Chọn ngày…</option>
            </select>
          )}
        </Field>
        {from === "custom" && (
          <Field label="Kỳ bắt đầu từ ngày">
            {(id) => <input id={id} type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} />}
          </Field>
        )}
        <Field label="Đến ngày (không bắt buộc)">
          {(id) => <input id={id} type="date" value={toDate} min={fromDate} onChange={(event) => setToDate(event.target.value)} />}
        </Field>
        <Field label="Lý do" required error={touched ? reasonError : null} className="field-wide">
          {(id, describedBy) => <input id={id} value={reason} maxLength={300} aria-describedby={describedBy} placeholder="Ví dụ: Anh chị em cùng học" onChange={(event) => setReason(event.target.value)} />}
        </Field>
      </div>
      <ErrorNotice error={action.error} onDismiss={action.clearError} />
    </Dialog>
  );
}

/** Printable receipt (H12): open the browser's print dialog to print or save as PDF. */
export function ReceiptPrintPage({ receiptId }: { receiptId: string }) {
  return (
    <RoleGate need="finance">
      <ReceiptPrint receiptId={receiptId} />
    </RoleGate>
  );
}

function ReceiptPrint({ receiptId }: { receiptId: string }) {
  const { centerId, context } = useCenter();
  const receipt = useResource(() => financeApi.receipt(centerId, receiptId), [centerId, receiptId]);
  const data = receipt.data;
  return (
    <>
      <div className="print-hide inline-action">
        <BackButton href={data ? `/centers/${centerId}/tuition/students/${data.studentId}` : `/centers/${centerId}/tuition`}>{data ? "Học phí của học sinh" : "Học phí"}</BackButton>
        <Button variant="primary" icon={<Printer aria-hidden="true" />} onClick={() => window.print()} disabled={!data}>In / lưu PDF</Button>
      </div>
      <ErrorNotice error={receipt.error} onReload={() => void receipt.reload()} />
      {!data ? <Panel><SkeletonRows rows={4} columns={2} /></Panel> : (
        <article className={`receipt-sheet${data.voidedAtUtc ? " is-voided" : ""}`}>
          <header>
            <p className="receipt-center">{context.displayName}</p>
            <h1>Biên lai thu học phí</h1>
            <p>Số <strong>{data.numberText}</strong> · Ngày {formatIsoDate(data.receivedOn)}</p>
          </header>
          {data.voidedAtUtc && <p className="receipt-void">ĐÃ HUỶ — {data.voidReason}</p>}
          <dl className="receipt-meta">
            <div><dt>Học sinh</dt><dd>{data.studentName}</dd></div>
            {data.payerName && <div><dt>Người nộp</dt><dd>{data.payerName}</dd></div>}
            <div><dt>Hình thức</dt><dd>{paymentMethodLabels[data.method]}</dd></div>
            {data.note && <div><dt>Ghi chú</dt><dd>{data.note}</dd></div>}
          </dl>
          <table className="table receipt-lines">
            <thead><tr><th>Nội dung</th><th className="num">Số tiền</th></tr></thead>
            <tbody>
              {data.lines.map((line) => (
                <tr key={line.chargeId}><td>Học phí {line.className} · kỳ {line.cycleNumber} ({formatPeriod(line.periodStart, line.periodEnd)})</td><td className="num">{formatMoney(line.amount)}</td></tr>
              ))}
              {data.credit > 0 && <tr><td>Đóng trước (số dư cho kỳ sau)</td><td className="num">{formatMoney(data.credit)}</td></tr>}
            </tbody>
            <tfoot><tr><th>Tổng cộng</th><th className="num">{formatMoney(data.amount)}</th></tr></tfoot>
          </table>
          <div className="receipt-sign">
            <div><p>Người nộp tiền</p><span>(Ký, ghi rõ họ tên)</span></div>
            <div><p>Người thu tiền</p><span>{data.createdByName ?? ""}</span></div>
          </div>
          <p className="cell-note">Lập lúc {formatDateTime(data.createdAtUtc)}.</p>
        </article>
      )}
    </>
  );
}
