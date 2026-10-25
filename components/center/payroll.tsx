"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { Ban, ChevronDown, ChevronRight, Coins, HandCoins, Lock, LockOpen, Plus, ReceiptText, Tags } from "lucide-react";
import {
  payrollApi,
  type PaymentMethod,
  type PayRate,
  type PayrollLine,
  type PayrollMonth,
  type PayrollMonthSummary,
} from "@/lib/api";
import { useAction, useResource } from "@/lib/hooks/use-resource";
import { useCenterLookups } from "@/lib/hooks/use-lookups";
import { formatDateTime, formatHours, formatIsoDate, formatMoney, formatMonth, formatStartLabel, newUuid, todayIso } from "@/lib/format";
import { payrollBlockerLabels, payrollModeLabels, paymentMethodLabels } from "@/lib/labels";
import { Badge, Button, Dialog, EmptyState, ErrorNotice, Field, Notice, PageHeader, Panel, Segmented, SkeletonRows } from "@/components/ui/primitives";
import { ReasonDialog } from "@/components/ui/reason-dialog";
import { useCenter } from "./center-frame";

type Tab = "month" | "rates";

/** Payroll or family revenue sharing of the center (docs/LUONG-VA-CHIA-THU-NHAP.md). Owners and managers. */
export function PayrollWorkspace() {
  const { payroll } = useCenter();
  if (!payroll) return <Panel><SkeletonRows rows={4} columns={4} /></Panel>;
  if (!payroll.enabled) {
    return (
      <Panel>
        <EmptyState icon={<Coins aria-hidden="true" />} title="Chưa bật lương / chia thu nhập">
          Quản trị nền tảng bật chức năng này cho từng trung tâm và chọn phương thức tính.
        </EmptyState>
      </Panel>
    );
  }
  if (!payroll.canSeeAll) {
    return (
      <Panel>
        <EmptyState icon={<HandCoins aria-hidden="true" />} title="Bạn chỉ xem được phần của mình">
          Mở mục “Thu nhập của tôi” để xem buổi dạy, tiền và phiếu chi của bạn.
        </EmptyState>
      </Panel>
    );
  }
  return <Inner />;
}

function Inner() {
  const { centerId, payroll } = useCenter();
  const months = useResource(() => payrollApi.months(centerId), [centerId]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("month");
  const list = months.data ?? [];
  const month = selected ?? list[0]?.month ?? null;
  const current = list.find((x) => x.month === month);
  const mode = current?.mode ?? payroll!.mode;
  const copy = payrollModeLabels[mode] ?? payrollModeLabels.RevenueShare;
  const showRates = list.some((x) => x.mode === "PerSession") || payroll!.mode === "PerSession";

  return (
    <>
      <PageHeader
        title={copy.title}
        description={copy.description}
        meta={showRates ? (
          <Segmented label="Mục" value={tab} onChange={setTab} options={[
            { value: "month", label: "Bảng tháng" },
            { value: "rates", label: "Đơn giá" },
          ]} />
        ) : undefined}
        actions={tab === "month" && list.length > 0 && (
          <label className="select-inline"><span>Tháng</span>
            <select value={month ?? ""} onChange={(event) => setSelected(event.target.value)}>
              {list.map((item) => (
                <option key={item.month} value={item.month}>
                  {formatMonth(item.month)} · {item.status === "Closed" ? "đã chốt" : "nháp"}
                </option>
              ))}
            </select>
          </label>
        )}
      />
      <ErrorNotice error={months.error} onReload={() => void months.reload()} />
      {tab === "rates" ? <RatesTab /> : !months.data ? (
        <Panel><SkeletonRows rows={5} columns={5} /></Panel>
      ) : !month ? (
        <Panel><EmptyState icon={<Coins aria-hidden="true" />} title="Chưa có tháng nào">Phương thức có hiệu lực từ tháng sau.</EmptyState></Panel>
      ) : (
        <>
          {list.length > 1 && <MonthStrip months={list} />}
          <MonthView key={month} month={month} onChanged={() => void months.reload()} />
        </>
      )}
    </>
  );
}

function MonthStrip({ months }: { months: PayrollMonthSummary[] }) {
  const recent = months.slice(0, 4);
  return (
    <dl className="money-strip" aria-label="Các tháng gần đây">
      {recent.map((item) => (
        <div key={item.month} className={item.status === "Draft" && (item.warnings > 0 || item.openDisputes > 0) ? "is-warning" : undefined}>
          <dt>{formatMonth(item.month)}</dt>
          <dd>{formatMoney(item.net)}</dd>
          <span>
            {item.status === "Closed" ? "Đã chốt" : "Nháp"} · {item.sessions} buổi · đã chi {formatMoney(item.paid)}
            {item.openDisputes > 0 ? ` · ${item.openDisputes} báo sai` : ""}
          </span>
        </div>
      ))}
    </dl>
  );
}

// ---------------- one month ----------------

type Dialogs =
  | { kind: "adjust"; teacherId?: string }
  | { kind: "expense" }
  | { kind: "payout"; line: PayrollLine }
  | { kind: "voidAdjustment"; id: string }
  | { kind: "voidExpense"; id: string }
  | { kind: "voidPayout"; id: string; label: string }
  | { kind: "resolve"; id: string; message: string }
  | { kind: "reopen" }
  | null;

function MonthView({ month, onChanged }: { month: string; onChanged: () => void }) {
  const { centerId, payroll } = useCenter();
  const data = useResource(() => payrollApi.month(centerId, month), [centerId, month]);
  const [dialog, setDialog] = useState<Dialogs>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const close = useAction();
  const view = data.data;
  const canEdit = Boolean(payroll?.canEdit);
  const owner = Boolean(payroll?.canCloseAndPay);
  const draft = view?.status === "Draft";

  function done(next: PayrollMonth, message: string) {
    data.setData(next);
    setNotice(message);
    setDialog(null);
    onChanged();
  }

  if (!view) return data.error ? <ErrorNotice error={data.error} onReload={() => void data.reload()} /> : <Panel><SkeletonRows rows={5} columns={6} /></Panel>;
  const share = view.mode === "RevenueShare";

  return (
    <>
      {notice && <Notice tone="success" onDismiss={() => setNotice(null)}>{notice}</Notice>}
      <ErrorNotice error={close.error} onDismiss={() => close.clearError()} />

      <Panel
        title={<>{formatMonth(view.month)} {draft ? <Badge tone="info">Nháp</Badge> : <Badge tone="success" icon={<Lock aria-hidden="true" />}>Đã chốt</Badge>}</>}
        description={draft
          ? "Số liệu tự cập nhật theo phiếu điểm danh và biên lai. Chốt để khoá; thay đổi sau khi chốt sẽ vào tháng sau thành “Điều chỉnh tháng trước”."
          : `Chốt lúc ${formatDateTime(view.closedAtUtc ?? null)}${view.closedByName ? ` · ${view.closedByName}` : ""}. Thay đổi về sau được tính vào tháng kế tiếp.`}
        actions={
          <>
            {draft && canEdit && <Button size="sm" icon={<Tags aria-hidden="true" />} onClick={() => setDialog({ kind: "adjust" })}>Khoản cộng / trừ</Button>}
            {draft && canEdit && share && <Button size="sm" icon={<ReceiptText aria-hidden="true" />} onClick={() => setDialog({ kind: "expense" })}>Chi phí chung</Button>}
            {draft && owner && (
              <Button size="sm" variant="primary" icon={<Lock aria-hidden="true" />} disabled={view.closeBlockers.length > 0} pending={close.pending}
                onClick={async () => { const next = await close.run(() => payrollApi.close(centerId, month)); if (next) done(next, `Đã chốt ${formatMonth(month).toLowerCase()}.`); }}>
                Chốt tháng
              </Button>
            )}
            {!draft && owner && view.canReopen && <Button size="sm" icon={<LockOpen aria-hidden="true" />} onClick={() => setDialog({ kind: "reopen" })}>Mở lại</Button>}
          </>
        }
      >
        {draft && view.closeBlockers.length > 0 && (
          <div className="panel-body">
            <Notice tone="warning" title="Chưa chốt được tháng này">
              <ul className="plain-list">{view.closeBlockers.map((code) => <li key={code}>{payrollBlockerLabels[code] ?? code}</li>)}</ul>
            </Notice>
          </div>
        )}
        {draft && !owner && <p className="panel-body cell-note">Quản lý lập nháp; chỉ chủ trung tâm chốt tháng và chi tiền.</p>}
      </Panel>

      {share && view.pool && (
        <dl className="money-strip money-strip-5" aria-label="Tiền của tháng">
          <div><dt>Thu trong tháng</dt><dd>{formatMoney(view.pool.collected)}</dd><span>Biên lai theo ngày thu</span></div>
          <div><dt>Đóng trước, chưa chia</dt><dd>{formatMoney(view.pool.prepaid)}</dd><span>Chia khi trừ vào kỳ học phí</span></div>
          <div className={view.pool.unassigned > 0 ? "is-warning" : undefined}><dt>Chưa phân bổ</dt><dd>{formatMoney(view.pool.unassigned)}</dd><span>Kỳ chưa có buổi dạy nào tính được</span></div>
          <div><dt>Chi phí chung</dt><dd>{formatMoney(view.pool.expenses)}</dd><span>Trừ trước khi chia</span></div>
          <div className={view.pool.distributable < 0 ? "is-danger" : undefined}><dt>Còn lại để chia</dt><dd>{formatMoney(view.pool.distributable)}</dd><span>Theo lớp, theo giờ dạy</span></div>
        </dl>
      )}

      <Warnings view={view} />

      <Panel title={share ? "Chia cho từng người" : "Lương từng giáo viên"} description="Bấm vào một dòng để xem từng lớp, từng buổi." flush>
        {view.lines.length === 0 ? (
          <EmptyState icon={<Coins aria-hidden="true" />} title="Chưa có ai trong tháng này">Khi phiếu điểm danh được nộp, người dạy sẽ hiện ở đây.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table payroll-table">
              <thead>
                <tr>
                  <th>Người dạy</th>
                  <th className="num">Buổi · giờ</th>
                  <th className="num">{share ? "Được chia" : "Lương buổi"}</th>
                  <th className="num">Cộng / trừ</th>
                  <th className="num">Điều chỉnh tháng trước</th>
                  <th className="num">Thực nhận</th>
                  <th className="num">Đã chi</th>
                  <th className="num">Còn lại</th>
                  <th className="col-actions"><span className="sr-only">Thao tác</span></th>
                </tr>
              </thead>
              <tbody>
                {view.lines.map((line) => {
                  const expanded = open === line.teacherId;
                  return (
                    <Fragment key={line.teacherId}>
                      <tr className="payroll-row" onClick={() => setOpen(expanded ? null : line.teacherId)}>
                        <td>
                          <button type="button" className="row-toggle" aria-expanded={expanded} onClick={(event) => { event.stopPropagation(); setOpen(expanded ? null : line.teacherId); }}>
                            {expanded ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
                            <strong>{line.teacherName}</strong>
                          </button>
                          <p className="cell-note">{line.teacherCode}</p>
                        </td>
                        <td className="num">{line.sessions} buổi<p className="cell-note">{formatHours(line.minutes)}</p></td>
                        <td className="num">{formatMoney(line.base)}</td>
                        <td className="num">{line.adjustments === 0 ? "—" : signed(line.adjustments)}</td>
                        <td className="num">{line.carried === 0 ? "—" : signed(line.carried)}</td>
                        <td className="num"><strong className={line.net < 0 ? "text-danger" : undefined}>{formatMoney(line.net)}</strong></td>
                        <td className="num">{formatMoney(line.paid)}</td>
                        <td className="num">{formatMoney(line.remaining)}</td>
                        <td className="col-actions" onClick={(event) => event.stopPropagation()}>
                          {owner && line.remaining > 0 && <Button size="sm" variant={draft ? "secondary" : "primary"} onClick={() => setDialog({ kind: "payout", line })}>{draft ? "Tạm ứng" : "Chi tiền"}</Button>}
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="payroll-detail"><td colSpan={9}><LineDetail line={line} share={share} closed={!draft} /></td></tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th>Tổng</th>
                  <th className="num">{view.lines.reduce((s, x) => s + x.sessions, 0)} buổi</th>
                  <th className="num">{formatMoney(view.lines.reduce((s, x) => s + x.base, 0))}</th>
                  <th className="num">{signed(view.lines.reduce((s, x) => s + x.adjustments, 0))}</th>
                  <th className="num">{signed(view.lines.reduce((s, x) => s + x.carried, 0))}</th>
                  <th className="num">{formatMoney(view.lines.reduce((s, x) => s + x.net, 0))}</th>
                  <th className="num">{formatMoney(view.lines.reduce((s, x) => s + x.paid, 0))}</th>
                  <th className="num">{formatMoney(view.lines.reduce((s, x) => s + x.remaining, 0))}</th>
                  <th />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Panel>

      {view.disputes.length > 0 && (
        <Panel title="Báo sai của giáo viên" description="Phải xử lý hết mới chốt được tháng." flush>
          <ul className="history-list payroll-list">
            {view.disputes.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.teacherName}</strong> {item.resolvedAtUtc ? <Badge tone="success">Đã xử lý</Badge> : <Badge tone="warning">Chờ xử lý</Badge>}
                  <p>{item.message}</p>
                  <p className="cell-note">{formatDateTime(item.createdAtUtc)}{item.resolution ? ` · Trả lời: ${item.resolution}${item.resolvedByName ? ` (${item.resolvedByName})` : ""}` : ""}</p>
                </div>
                {!item.resolvedAtUtc && canEdit && <Button size="sm" onClick={() => setDialog({ kind: "resolve", id: item.id, message: item.message })}>Xử lý</Button>}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="detail-grid">
        <Panel title="Khoản cộng / trừ" description="Thưởng, phạt, phụ cấp, chia tay phần chưa phân bổ. Luôn có lý do." flush
          actions={draft && canEdit && <Button size="sm" icon={<Plus aria-hidden="true" />} onClick={() => setDialog({ kind: "adjust" })}>Thêm</Button>}>
          {view.adjustments.length === 0 ? <p className="panel-empty">Chưa có khoản nào.</p> : (
            <ul className="history-list payroll-list">
              {view.adjustments.map((item) => (
                <li key={item.id} className={item.voidedAtUtc ? "is-voided" : undefined}>
                  <div>
                    <strong>{item.teacherName} · {signed(item.amount)}</strong>
                    <p>{item.reason}</p>
                    <p className="cell-note">{item.createdByName ?? ""} {formatDateTime(item.createdAtUtc)}{item.voidedAtUtc ? ` · Đã huỷ: ${item.voidReason}` : ""}</p>
                  </div>
                  {draft && canEdit && !item.voidedAtUtc && <Button size="sm" variant="ghost" icon={<Ban aria-hidden="true" />} onClick={() => setDialog({ kind: "voidAdjustment", id: item.id })}>Huỷ</Button>}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {share && (
          <Panel title="Chi phí chung" description="Tuỳ chọn. Tháng có nhập thì trừ trước khi chia, theo cùng tỉ lệ." flush
            actions={draft && canEdit && <Button size="sm" icon={<Plus aria-hidden="true" />} onClick={() => setDialog({ kind: "expense" })}>Thêm</Button>}>
            {view.expenses.length === 0 ? <p className="panel-empty">Không nhập chi phí — chia toàn bộ tiền thu.</p> : (
              <ul className="history-list payroll-list">
                {view.expenses.map((item) => (
                  <li key={item.id} className={item.voidedAtUtc ? "is-voided" : undefined}>
                    <div>
                      <strong>{item.category} · {formatMoney(item.amount)}</strong>
                      <p>{item.note}</p>
                      <p className="cell-note">{formatIsoDate(item.spentOn)}{item.voidedAtUtc ? ` · Đã huỷ: ${item.voidReason}` : ""}</p>
                    </div>
                    {draft && canEdit && !item.voidedAtUtc && <Button size="sm" variant="ghost" icon={<Ban aria-hidden="true" />} onClick={() => setDialog({ kind: "voidExpense", id: item.id })}>Huỷ</Button>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}

        <Panel title="Phiếu chi" description="Tiền đã đưa cho từng người. Chi trước khi chốt là tạm ứng." flush>
          {view.payouts.length === 0 ? <p className="panel-empty">Chưa chi khoản nào.</p> : (
            <ul className="history-list payroll-list">
              {view.payouts.map((item) => (
                <li key={item.id} className={item.voidedAtUtc ? "is-voided" : undefined}>
                  <div>
                    <strong>{item.numberText} · {item.teacherName} · {formatMoney(item.amount)}</strong> {item.advance && <Badge tone="info">Tạm ứng</Badge>}
                    <p className="cell-note">{formatIsoDate(item.paidOn)} · {paymentMethodLabels[item.method] ?? item.method}{item.note ? ` · ${item.note}` : ""}{item.voidedAtUtc ? ` · Đã huỷ: ${item.voidReason}` : ""}</p>
                  </div>
                  {owner && !item.voidedAtUtc && <Button size="sm" variant="ghost" icon={<Ban aria-hidden="true" />} onClick={() => setDialog({ kind: "voidPayout", id: item.id, label: `${item.numberText} · ${item.teacherName}` })}>Huỷ</Button>}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {view.events.length > 0 && (
          <Panel title="Lịch sử chốt" flush>
            <ul className="history-list payroll-list">
              {view.events.map((item) => (
                <li key={item.createdAtUtc}>
                  <div>
                    <strong>{item.kind === "Closed" ? "Chốt tháng" : "Mở lại"}</strong>
                    {item.reason && <p>{item.reason}</p>}
                    <p className="cell-note">{formatDateTime(item.createdAtUtc)}{item.actorName ? ` · ${item.actorName}` : ""}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>

      {dialog?.kind === "adjust" && (
        <AdjustmentDialog month={month} lines={view.lines} teacherId={dialog.teacherId} onClose={() => setDialog(null)}
          onSaved={(next) => done(next, "Đã ghi khoản cộng / trừ.")} />
      )}
      {dialog?.kind === "expense" && (
        <ExpenseDialog month={month} onClose={() => setDialog(null)} onSaved={(next) => done(next, "Đã ghi chi phí chung.")} />
      )}
      {dialog?.kind === "payout" && (
        <PayoutDialog month={month} line={dialog.line} advance={draft} onClose={() => setDialog(null)}
          onSaved={(next) => done(next, `Đã ghi phiếu chi cho ${dialog.line.teacherName}.`)} />
      )}
      <ReasonDialog open={dialog?.kind === "voidAdjustment"} title="Huỷ khoản cộng / trừ?" confirmLabel="Huỷ khoản" variant="danger" minLength={3} maxLength={300}
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => { if (dialog?.kind === "voidAdjustment") done(await payrollApi.voidAdjustment(centerId, dialog.id, reason), "Đã huỷ khoản cộng / trừ."); }} />
      <ReasonDialog open={dialog?.kind === "voidExpense"} title="Huỷ chi phí chung?" confirmLabel="Huỷ chi phí" variant="danger" minLength={3} maxLength={300}
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => { if (dialog?.kind === "voidExpense") done(await payrollApi.voidExpense(centerId, dialog.id, reason), "Đã huỷ chi phí."); }} />
      <ReasonDialog open={dialog?.kind === "voidPayout"} title="Huỷ phiếu chi?" confirmLabel="Huỷ phiếu chi" variant="danger" minLength={3} maxLength={300}
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => { if (dialog?.kind === "voidPayout") done(await payrollApi.voidPayout(centerId, dialog.id, reason), "Đã huỷ phiếu chi; số phiếu không dùng lại."); }}>
        {dialog?.kind === "voidPayout" && <p>{dialog.label}. Phiếu không bị xoá; phần tiền quay lại thành còn phải chi.</p>}
      </ReasonDialog>
      <ReasonDialog open={dialog?.kind === "resolve"} title="Xử lý báo sai" label="Trả lời giáo viên" confirmLabel="Đã xử lý" minLength={3} maxLength={300}
        onClose={() => setDialog(null)}
        onConfirm={async (note) => { if (dialog?.kind === "resolve") done(await payrollApi.resolveDispute(centerId, dialog.id, note), "Đã xử lý báo sai."); }}>
        {dialog?.kind === "resolve" && <p>“{dialog.message}”. Sửa số liệu (điểm danh, khoản cộng/trừ) trước, rồi ghi câu trả lời.</p>}
      </ReasonDialog>
      <ReasonDialog open={dialog?.kind === "reopen"} title={`Mở lại ${formatMonth(month).toLowerCase()}?`} confirmLabel="Mở lại tháng" variant="danger" minLength={3} maxLength={300}
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => done(await payrollApi.reopen(centerId, month, reason), "Đã mở lại tháng; số liệu tính lại theo dữ liệu hiện tại.")}>
        <p>Số liệu đã khoá sẽ bỏ, tháng thành nháp và tính lại. Phiếu chi giữ nguyên. Chỉ mở lại được tháng chốt gần nhất.</p>
      </ReasonDialog>
    </>
  );
}

function signed(value: number) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatMoney(Math.abs(value))}`;
}

function Warnings({ view }: { view: PayrollMonth }) {
  const { centerId } = useCenter();
  if (view.status === "Closed") return null;
  return (
    <>
      {view.unsubmitted.length > 0 && (
        <Notice tone="warning" title={`${view.unsubmitted.length} buổi đã diễn ra nhưng chưa nộp phiếu điểm danh — chưa tính`}
          action={<Link className="btn btn-secondary btn-sm" href={`/centers/${centerId}/attendance`}>Mở điểm danh</Link>}>
          <ul className="plain-list">
            {view.unsubmitted.slice(0, 6).map((item) => <li key={item.sessionId}>{item.classCode} · {formatStartLabel(item.startUtc)} · {item.teacherName}</li>)}
            {view.unsubmitted.length > 6 && <li>và {view.unsubmitted.length - 6} buổi khác.</li>}
          </ul>
          Chủ hoặc quản lý nộp muộn được bất cứ lúc nào; buổi tính vào tháng diễn ra.
        </Notice>
      )}
      {view.missingRates.length > 0 && (
        <Notice tone="danger" title={`${view.missingRates.length} buổi chưa có đơn giá`}>
          Thêm đơn giá ở mục “Đơn giá” (mặc định của giáo viên, hoặc riêng cho lớp). Chưa đủ đơn giá thì chưa chốt được.
        </Notice>
      )}
      {view.pool && view.pool.unassignedItems.length > 0 && (
        <Notice tone="info" title={`${formatMoney(view.pool.unassigned)} chưa phân bổ được cho ai`}>
          <ul className="plain-list">
            {view.pool.unassignedItems.map((item) => <li key={`${item.classId}${item.periodStart}`}>{item.classCode} · kỳ {formatIsoDate(item.periodStart)} – {formatIsoDate(item.periodEnd)}: {formatMoney(item.amount)}</li>)}
          </ul>
          Kỳ học phí này chưa có buổi dạy nào tính được. Khi phiếu điểm danh được nộp, tiền tự chia; hoặc chia tay bằng khoản cộng.
        </Notice>
      )}
    </>
  );
}

export function LineDetail({ line, share, closed }: { line: PayrollLine; share: boolean; closed: boolean }) {
  return (
    <div className="payroll-line-detail">
      {closed && <p className="cell-note">Số tiền đã khoá lúc chốt; chi tiết dưới đây tính theo dữ liệu hiện tại.</p>}
      {line.classes.length > 0 && (
        <table className="table table-compact">
          <thead><tr><th>Lớp</th><th className="num">Buổi dạy trong tháng</th><th className="num">Giờ</th><th className="num">{share ? "Tiền chia từ lớp" : "Lương"}</th></tr></thead>
          <tbody>
            {line.classes.map((item) => (
              <tr key={item.classId}><td>{item.classCode} · {item.className}</td><td className="num">{item.sessions}</td><td className="num">{formatHours(item.minutes)}</td><td className="num">{share ? `≈ ${formatMoney(Math.round(item.amount / 1000) * 1000)}` : formatMoney(item.amount)}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      {line.items.length > 0 && (
        <ul className="session-chips" aria-label="Các buổi đã dạy">
          {line.items.map((item) => (
            <li key={item.sessionId} className={item.amount == null && !share ? "is-missing" : undefined}>
              {item.classCode} · {formatStartLabel(item.startUtc)} · {item.minutes}′{item.substitute ? " · dạy thay" : ""}
              {!share && <> · {item.amount != null ? formatMoney(item.amount) : "chưa có đơn giá"}</>}
            </li>
          ))}
        </ul>
      )}
      {line.carriedFrom.length > 0 && (
        <p className="cell-note">Điều chỉnh tháng trước: {line.carriedFrom.map((x) => `${formatMonth(x.fromMonth)} ${signed(x.amount)}`).join(", ")}.</p>
      )}
      {share && <p className="cell-note">Tiền chia = tiền thu trong tháng đã trừ vào từng kỳ học phí của lớp × phần giờ bạn dạy trong kỳ đó (buổi chưa tới tính cho người được phân công).</p>}
    </div>
  );
}

// ---------------- dialogs ----------------

function AdjustmentDialog({ month, lines, teacherId, onClose, onSaved }: { month: string; lines: PayrollLine[]; teacherId?: string; onClose: () => void; onSaved: (next: PayrollMonth) => void }) {
  const { centerId } = useCenter();
  const lookups = useCenterLookups(centerId);
  const teachers = (lookups.data?.teachers ?? []).filter((x) => x.isActive || lines.some((l) => l.teacherId === x.id));
  const [picked, setTeacher] = useState(teacherId ?? lines[0]?.teacherId ?? "");
  const teacher = picked || teachers[0]?.id || "";
  const [sign, setSign] = useState<"plus" | "minus">("plus");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const action = useAction();
  const value = Number(amount.replace(/\D/g, ""));
  const errors = {
    teacher: teacher ? null : "Chọn người nhận.",
    amount: value > 0 && value % 1000 === 0 && value <= 100_000_000 ? null : "Nhập số tiền là bội của 1.000đ.",
    reason: reason.trim().length >= 3 ? null : "Ghi lý do (ít nhất 3 ký tự).",
  };
  async function submit() {
    setTouched(true);
    if (Object.values(errors).some(Boolean)) return;
    const next = await action.run(() => payrollApi.addAdjustment(centerId, month, { teacherId: teacher, amount: sign === "plus" ? value : -value, reason: reason.trim() }));
    if (next) onSaved(next);
  }
  return (
    <Dialog open title="Khoản cộng / trừ" description={`Gắn vào ${formatMonth(month).toLowerCase()}. Thưởng, phụ cấp, phạt, hoặc chia tay phần chưa phân bổ.`} onClose={onClose} onSubmit={submit}
      footer={<><Button onClick={onClose} disabled={action.pending}>Đóng</Button><Button type="submit" variant="primary" pending={action.pending}>Ghi khoản</Button></>}>
      <div className="form-grid">
        <Field label="Người nhận" required error={touched ? errors.teacher : null}>
          {(id) => (
            <select id={id} value={teacher} onChange={(event) => setTeacher(event.target.value)}>
              {teachers.map((x) => <option key={x.id} value={x.id}>{x.fullName} · {x.code}</option>)}
            </select>
          )}
        </Field>
        <Field label="Loại" required>
          {(id) => (
            <select id={id} value={sign} onChange={(event) => setSign(event.target.value as "plus" | "minus")}>
              <option value="plus">Cộng (+)</option>
              <option value="minus">Trừ (−)</option>
            </select>
          )}
        </Field>
        <Field label="Số tiền (đ)" required error={touched ? errors.amount : null}>
          {(id) => <input id={id} inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="200000" />}
        </Field>
        <Field label="Lý do" required error={touched ? errors.reason : null} className="span-2">
          {(id) => <textarea id={id} rows={2} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: Thưởng dạy thêm buổi tối" />}
        </Field>
      </div>
      <ErrorNotice error={action.error} />
    </Dialog>
  );
}

function ExpenseDialog({ month, onClose, onSaved }: { month: string; onClose: () => void; onSaved: (next: PayrollMonth) => void }) {
  const { centerId } = useCenter();
  const today = todayIso();
  const end = monthEnd(month);
  const [spentOn, setSpentOn] = useState(today.startsWith(month) ? today : end);
  const [category, setCategory] = useState("Thuê phòng");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const action = useAction();
  const value = Number(amount.replace(/\D/g, ""));
  const errors = {
    spentOn: spentOn.startsWith(month) ? null : `Chọn ngày trong ${formatMonth(month).toLowerCase()}.`,
    category: category.trim().length >= 2 ? null : "Nhập loại chi phí.",
    amount: value > 0 ? null : "Nhập số tiền.",
    note: note.trim().length >= 3 ? null : "Ghi nội dung (ít nhất 3 ký tự).",
  };
  async function submit() {
    setTouched(true);
    if (Object.values(errors).some(Boolean)) return;
    const next = await action.run(() => payrollApi.addExpense(centerId, month, { spentOn, category: category.trim(), amount: value, note: note.trim() }));
    if (next) onSaved(next);
  }
  return (
    <Dialog open title="Chi phí chung" description="Trừ vào tiền của tháng trước khi chia, theo cùng tỉ lệ của mỗi người." onClose={onClose} onSubmit={submit}
      footer={<><Button onClick={onClose} disabled={action.pending}>Đóng</Button><Button type="submit" variant="primary" pending={action.pending}>Ghi chi phí</Button></>}>
      <div className="form-grid">
        <Field label="Ngày chi" required error={touched ? errors.spentOn : null}>
          {(id) => <input id={id} type="date" value={spentOn} min={`${month}-01`} max={end} onChange={(event) => setSpentOn(event.target.value)} />}
        </Field>
        <Field label="Loại" required error={touched ? errors.category : null}>
          {(id) => (
            <>
              <input id={id} list={`${id}-options`} value={category} maxLength={60} onChange={(event) => setCategory(event.target.value)} />
              <datalist id={`${id}-options`}>{["Thuê phòng", "Điện nước", "Tài liệu, in ấn", "Văn phòng phẩm", "Khác"].map((x) => <option key={x} value={x} />)}</datalist>
            </>
          )}
        </Field>
        <Field label="Số tiền (đ)" required error={touched ? errors.amount : null}>
          {(id) => <input id={id} inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="300000" />}
        </Field>
        <Field label="Nội dung" required error={touched ? errors.note : null} className="span-2">
          {(id) => <textarea id={id} rows={2} maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ví dụ: Tiền phòng tháng này" />}
        </Field>
      </div>
      <ErrorNotice error={action.error} />
    </Dialog>
  );
}

function PayoutDialog({ month, line, advance, onClose, onSaved }: { month: string; line: PayrollLine; advance: boolean; onClose: () => void; onSaved: (next: PayrollMonth) => void }) {
  const { centerId } = useCenter();
  const [amount, setAmount] = useState(String(Math.max(0, line.remaining)));
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [paidOn, setPaidOn] = useState(todayIso());
  const [note, setNote] = useState(advance ? "Tạm ứng" : "");
  const [requestId] = useState(newUuid);
  const [touched, setTouched] = useState(false);
  const action = useAction();
  const value = Number(amount.replace(/\D/g, ""));
  const error = value > 0 && (advance || value <= line.remaining) ? null
    : advance ? "Nhập số tiền." : `Tối đa ${formatMoney(line.remaining)} (phần còn phải chi).`;
  async function submit() {
    setTouched(true);
    if (error || paidOn > todayIso()) return;
    const next = await action.run(() => payrollApi.addPayout(centerId, month, { teacherId: line.teacherId, amount: value, method, paidOn, note: note.trim() || undefined, requestId }));
    if (next) onSaved(next);
  }
  return (
    <Dialog open title={advance ? `Tạm ứng cho ${line.teacherName}` : `Chi tiền cho ${line.teacherName}`}
      description={advance ? "Tháng chưa chốt: khoản này là tạm ứng, cuối tháng tự trừ vào thực nhận." : `Thực nhận ${formatMoney(line.net)} · đã chi ${formatMoney(line.paid)} · còn ${formatMoney(line.remaining)}.`}
      onClose={onClose} onSubmit={submit}
      footer={<><Button onClick={onClose} disabled={action.pending}>Đóng</Button><Button type="submit" variant="primary" pending={action.pending}>Ghi phiếu chi</Button></>}>
      <div className="form-grid">
        <Field label="Số tiền (đ)" required error={touched ? error : null}>
          {(id) => <input id={id} inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} />}
        </Field>
        <Field label="Hình thức" required>
          {(id) => (
            <select id={id} value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>
              <option value="Cash">{paymentMethodLabels.Cash}</option>
              <option value="BankTransfer">{paymentMethodLabels.BankTransfer}</option>
            </select>
          )}
        </Field>
        <Field label="Ngày chi" required error={touched && paidOn > todayIso() ? "Không chọn ngày tương lai." : null}>
          {(id) => <input id={id} type="date" value={paidOn} max={todayIso()} onChange={(event) => setPaidOn(event.target.value)} />}
        </Field>
        <Field label="Ghi chú">
          {(id) => <input id={id} value={note} maxLength={300} onChange={(event) => setNote(event.target.value)} />}
        </Field>
      </div>
      <ErrorNotice error={action.error} />
    </Dialog>
  );
}

function monthEnd(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(last).padStart(2, "0")}`;
}

// ---------------- rates (M2) ----------------

function RatesTab() {
  const { centerId, payroll } = useCenter();
  const rates = useResource(() => payrollApi.rates(centerId), [centerId]);
  const lookups = useCenterLookups(centerId);
  const [adding, setAdding] = useState(false);
  const [voiding, setVoiding] = useState<PayRate | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const items = rates.data ?? [];
  return (
    <>
      {notice && <Notice tone="success" onDismiss={() => setNotice(null)}>{notice}</Notice>}
      <Panel title="Đơn giá mỗi buổi" description="Mỗi giáo viên một đơn giá mặc định; lớp nào khác thì thêm đơn giá riêng cho lớp đó. Buổi dùng giá có hiệu lực vào ngày diễn ra. Đổi giá = thêm dòng mới có ngày hiệu lực." flush
        actions={payroll?.canEdit && <Button size="sm" variant="primary" icon={<Plus aria-hidden="true" />} onClick={() => setAdding(true)} disabled={!lookups.data}>Thêm đơn giá</Button>}>
        <ErrorNotice error={rates.error} onReload={() => void rates.reload()} />
        {!rates.data ? <SkeletonRows rows={4} columns={5} /> : items.length === 0 ? (
          <EmptyState icon={<Tags aria-hidden="true" />} title="Chưa có đơn giá">Thêm đơn giá cho từng giáo viên trước khi chốt tháng.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Giáo viên</th><th>Áp dụng cho</th><th className="num">Đơn giá / buổi</th><th>Từ ngày</th><th>Người nhập</th><th className="col-actions"><span className="sr-only">Thao tác</span></th></tr></thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className={item.voidedAtUtc ? "row-voided" : undefined}>
                    <td><strong>{item.teacherName}</strong></td>
                    <td>{item.classCode ? `Lớp ${item.classCode}` : "Mặc định (mọi lớp)"}</td>
                    <td className="num">{formatMoney(item.amount)}</td>
                    <td>{formatIsoDate(item.effectiveFrom)}</td>
                    <td className="col-muted">{item.createdByName ?? "—"}{item.voidedAtUtc ? <p className="cell-note">Đã huỷ: {item.voidReason}</p> : null}</td>
                    <td className="col-actions">{payroll?.canEdit && !item.voidedAtUtc && <Button size="sm" variant="ghost" icon={<Ban aria-hidden="true" />} onClick={() => setVoiding(item)}>Huỷ</Button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {adding && lookups.data && (
        <RateDialog onClose={() => setAdding(false)} onSaved={() => { setAdding(false); setNotice("Đã thêm đơn giá."); void rates.reload(); }} />
      )}
      <ReasonDialog open={Boolean(voiding)} title="Huỷ đơn giá?" confirmLabel="Huỷ đơn giá" variant="danger" minLength={3} maxLength={300}
        onClose={() => setVoiding(null)}
        onConfirm={async (reason) => { if (voiding) { await payrollApi.voidRate(centerId, voiding.id, reason); setNotice("Đã huỷ đơn giá; các tháng đã chốt sẽ có điều chỉnh ở tháng sau nếu bị ảnh hưởng."); await rates.reload(); } }}>
        {voiding && <p>{voiding.teacherName} · {voiding.classCode ? `lớp ${voiding.classCode}` : "mặc định"} · {formatMoney(voiding.amount)} từ {formatIsoDate(voiding.effectiveFrom)}.</p>}
      </ReasonDialog>
    </>
  );
}

function RateDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { centerId } = useCenter();
  const lookups = useCenterLookups(centerId);
  const teachers = (lookups.data?.teachers ?? []).filter((x) => x.isActive);
  const classes = (lookups.data?.classes ?? []).filter((x) => x.isActive);
  const [pickedTeacher, setTeacherId] = useState("");
  const teacherId = pickedTeacher || teachers[0]?.id || "";
  const [classId, setClassId] = useState("");
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState(`${todayIso().slice(0, 7)}-01`);
  const [touched, setTouched] = useState(false);
  const action = useAction();
  const value = Number(amount.replace(/\D/g, ""));
  const error = amount !== "" && value % 1000 === 0 && value <= 50_000_000 ? null : "Đơn giá là bội của 1.000đ (0 nếu không trả).";
  async function submit() {
    setTouched(true);
    if (error || !teacherId || !from) return;

    const saved = await action.run(() => payrollApi.addRate(centerId, { teacherId, classId: classId || null, amount: value, effectiveFrom: from }));
    if (saved) onSaved();
  }
  return (
    <Dialog open title="Thêm đơn giá" description="Dạy thay thì người dạy thực tế nhận theo đơn giá của chính họ." onClose={onClose} onSubmit={submit}
      footer={<><Button onClick={onClose} disabled={action.pending}>Đóng</Button><Button type="submit" variant="primary" pending={action.pending}>Lưu đơn giá</Button></>}>
      <div className="form-grid">
        <Field label="Giáo viên" required>
          {(id) => <select id={id} value={teacherId} onChange={(event) => setTeacherId(event.target.value)}>{teachers.map((x) => <option key={x.id} value={x.id}>{x.fullName} · {x.code}</option>)}</select>}
        </Field>
        <Field label="Áp dụng cho">
          {(id) => (
            <select id={id} value={classId} onChange={(event) => setClassId(event.target.value)}>
              <option value="">Mặc định (mọi lớp)</option>
              {classes.map((x) => <option key={x.id} value={x.id}>Riêng lớp {x.code} · {x.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="Đơn giá / buổi (đ)" required error={touched ? error : null}>
          {(id) => <input id={id} inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="200000" />}
        </Field>
        <Field label="Có hiệu lực từ" required hint="Có thể lùi ngày; tháng đã chốt sẽ được điều chỉnh ở tháng sau.">
          {(id, describedBy) => <input id={id} aria-describedby={describedBy} type="date" value={from} onChange={(event) => setFrom(event.target.value)} />}
        </Field>
      </div>
      <ErrorNotice error={action.error} />
    </Dialog>
  );
}
