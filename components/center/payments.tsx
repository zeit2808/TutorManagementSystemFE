"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, ClipboardCopy, Inbox, Landmark, RefreshCcw, RotateCcw, ScanSearch, Search, UserCheck } from "lucide-react";
import {
  academicsApi,
  financeApi,
  type BankTransfer,
  type BankTransferFilter,
  type PaymentProvider,
  type PaymentProviderMode,
  type ShadowReport,
  type ShadowVerdict,
  type Student,
} from "@/lib/api";
import { useAction, useResource } from "@/lib/hooks/use-resource";
import { formatDateTime, formatIsoDate, formatMoney } from "@/lib/format";
import type { Tone } from "@/lib/labels";
import { Badge, Button, Dialog, EmptyState, ErrorNotice, Field, Notice, Pagination, Panel, Segmented, SkeletonRows } from "@/components/ui/primitives";
import { ReasonDialog } from "@/components/ui/reason-dialog";
import { useCenter } from "./center-frame";

// ---------------- labels ----------------

export const modeLabels: Record<PaymentProviderMode, string> = { Off: "Tắt", Shadow: "Chạy thử", Auto: "Tự động" };
const modeTone: Record<PaymentProviderMode, Tone> = { Off: "neutral", Shadow: "info", Auto: "success" };
const modeHelp: Record<PaymentProviderMode, string> = {
  Off: "Không nhận giao dịch từ SePay. Nhân viên ghi biên lai như bình thường.",
  Shadow: "Hệ thống nhận giao dịch và ghi nháp “khoản này của ai”, chưa tạo biên lai. Nhân viên vẫn ghi tay. Dùng báo cáo so sánh để kiểm tra trước khi bật Tự động.",
  Auto: "Tiền vào là tự tạo biên lai và trừ nợ cho đúng học sinh. Nhân viên không ghi tay chuyển khoản nữa, chỉ gán những khoản chưa rõ của ai.",
};
const reviewLabels: Record<string, string> = {
  NoCode: "Không có mã", UnknownCode: "Mã sai hoặc không có", AmbiguousCode: "Nhiều mã / nhiều học sinh",
  VoidedReceipt: "Biên lai đã huỷ", TooLarge: "Số tiền quá lớn",
};
const ignoreLabels: Record<string, string> = {
  OtherAccount: "Tài khoản khác", Duplicate: "Bản trùng", NotTuition: "Không phải học phí", BeforeAuto: "Trước khi bật Tự động",
};
const statusLabels: Record<string, { label: string; tone: Tone }> = {
  NeedsReview: { label: "Chưa rõ của ai", tone: "warning" },
  Held: { label: "Nghi trùng", tone: "danger" },
  Failed: { label: "Lỗi xử lý", tone: "danger" },
  Received: { label: "Đang xử lý", tone: "info" },
  Booked: { label: "Đã ghi", tone: "success" },
  Ignored: { label: "Bỏ qua", tone: "neutral" },
};
const verdictLabels: Record<ShadowVerdict, { label: string; tone: Tone }> = {
  Match: { label: "Khớp", tone: "success" },
  DifferentStudent: { label: "Lệch học sinh", tone: "danger" },
  MissingManual: { label: "Máy ghi, người chưa ghi", tone: "warning" },
  ManualOnly: { label: "Người ghi, máy không ghi", tone: "warning" },
  BothSkipped: { label: "Cả hai không ghi", tone: "neutral" },
  NotEvaluated: { label: "Chưa xét", tone: "neutral" },
};

function webhookUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || (typeof window === "undefined" ? "" : window.location.origin);
  return `${base}${path}`;
}

// ---------------- bank feed: connection and Shadow report ----------------

/** Owner connects SePay and chooses the mode; managers see it. Off → Shadow → (compare) → Auto. */
export function AutoPayTab() {
  const { centerId } = useCenter();
  const provider = useResource(() => financeApi.paymentProvider(centerId), [centerId]);
  if (!provider.data) return <Panel><ErrorNotice error={provider.error} onReload={() => void provider.reload()} />{!provider.error && <SkeletonRows rows={4} columns={2} />}</Panel>;
  return (
    <div className="detail-grid detail-grid-wide">
      <ConnectionPanel key={provider.data.version} provider={provider.data} onSaved={(value) => provider.setData(value)} />
      <ShadowReportPanel />
    </div>
  );
}

function ConnectionPanel({ provider, onSaved }: { provider: PaymentProvider; onSaved: (value: PaymentProvider) => void }) {
  const { centerId, isOwner } = useCenter();
  const action = useAction();
  const pull = useAction();
  const [mode, setMode] = useState<PaymentProviderMode>(provider.configured ? provider.mode : "Shadow");
  const [apiToken, setApiToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [password, setPassword] = useState("");
  const [tried, setTried] = useState(false);
  const [copied, setCopied] = useState(false);
  const firstTime = !provider.configured;
  const autoAllowed = provider.configured && (provider.mode === "Shadow" || provider.mode === "Auto");
  const secretsMissing = firstTime && (apiToken.trim().length < 16 || webhookSecret.trim().length < 16);
  const errors = {
    secrets: tried && secretsMissing ? "Lần đầu kết nối cần cả API token và Secret Key (mỗi loại ít nhất 16 ký tự)." : null,
    password: tried && !password ? "Nhập mật khẩu của bạn để lưu." : null,
  };
  async function save() {
    setTried(true);
    if (secretsMissing || !password) return;
    const result = await action.run(() => financeApi.savePaymentProvider(centerId, {
      currentPassword: password, mode, expectedVersion: provider.version,
      ...(apiToken.trim() ? { apiToken: apiToken.trim() } : {}),
      ...(webhookSecret.trim() ? { webhookSecret: webhookSecret.trim() } : {}),
    }));
    setPassword("");
    if (result) onSaved(result);
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setCopied(false); }
  }
  return (
    <Panel title="Kết nối SePay" description="Nhận tiền chuyển khoản và tự ghi biên lai. Chỉ chủ trung tâm thay đổi được; mỗi lần đổi đều email cho mọi chủ.">
      <div className="panel-body">
        <p>
          Chế độ hiện tại: <Badge tone={provider.configured ? modeTone[provider.mode] : "neutral"}>{provider.configured ? modeLabels[provider.mode] : "Chưa kết nối"}</Badge>
        </p>
        {provider.configured && (
          <div className="plain-list">
            <p className="cell-note">Tài khoản nhận: {provider.accountNumber}{!provider.accountMatchesSettings && " — khác tài khoản trong Cài đặt học phí, lưu lại để cập nhật"}</p>
            {provider.webhookPath && (
              <p className="cell-note">
                Địa chỉ webhook (dán vào SePay, xác thực HMAC-SHA256): <code className="code">{webhookUrl(provider.webhookPath)}</code>{" "}
                <Button size="sm" variant="ghost" icon={<ClipboardCopy aria-hidden="true" />} onClick={() => void copy(webhookUrl(provider.webhookPath!))}>{copied ? "Đã chép" : "Chép"}</Button>
              </p>
            )}
            <p className="cell-note">Lần lấy giao dịch gần nhất: {provider.lastPulledAtUtc ? formatDateTime(provider.lastPulledAtUtc) : "chưa có"}</p>
            {provider.invalidSignatureCount > 0 && (
              <p className="cell-note">Webhook bị từ chối vì sai chữ ký: {provider.invalidSignatureCount} lần{provider.lastInvalidSignatureAtUtc ? `, gần nhất ${formatDateTime(provider.lastInvalidSignatureAtUtc)}` : ""} — kiểm tra Secret Key trên SePay.</p>
            )}
          </div>
        )}
        {provider.lastPullError && <Notice tone="warning" title="Lần lấy giao dịch gần nhất bị lỗi">{provider.lastPullError}</Notice>}
        {provider.configured && provider.mode !== "Off" && (
          <Button size="sm" icon={<RefreshCcw aria-hidden="true" />} pending={pull.pending} status={pull.status}
            onClick={() => void pull.run(() => financeApi.pullNow(centerId)).then((value) => value && onSaved(value))}>Lấy giao dịch ngay</Button>
        )}
        <ErrorNotice error={pull.error} onDismiss={pull.clearError} />
      </div>

      {isOwner ? (
        <form className="form-grid panel-body" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <Field label="Chế độ" hint={modeHelp[mode]} className="field-wide">
            {(id, describedBy) => (
              <select id={id} value={mode} aria-describedby={describedBy} onChange={(event) => setMode(event.target.value as PaymentProviderMode)}>
                <option value="Off">{modeLabels.Off}</option>
                <option value="Shadow">{modeLabels.Shadow}</option>
                <option value="Auto" disabled={!autoAllowed}>{modeLabels.Auto}{autoAllowed ? "" : " (cần chạy thử trước)"}</option>
              </select>
            )}
          </Field>
          <Field label="API token SePay" hint={firstTime ? "Tạo ở my.sepay.vn → Cấu hình công ty → API Access." : "Để trống để giữ token đang dùng."} error={errors.secrets}>
            {(id, describedBy) => <input id={id} type="password" autoComplete="off" value={apiToken} aria-describedby={describedBy} onChange={(event) => setApiToken(event.target.value)} />}
          </Field>
          <Field label="Secret Key webhook" hint={firstTime ? "Cùng giá trị nhập ở phần Bảo mật của webhook trên SePay." : "Để trống để giữ Secret Key đang dùng."}>
            {(id, describedBy) => <input id={id} type="password" autoComplete="off" value={webhookSecret} aria-describedby={describedBy} onChange={(event) => setWebhookSecret(event.target.value)} />}
          </Field>
          <Field label="Mật khẩu của bạn" error={errors.password} className="field-wide">
            {(id, describedBy) => <input id={id} type="password" autoComplete="current-password" value={password} aria-describedby={describedBy} onChange={(event) => setPassword(event.target.value)} />}
          </Field>
          <div className="field-wide"><Button type="submit" variant="primary" icon={<Landmark aria-hidden="true" />} pending={action.pending} status={action.status}>{firstTime ? "Kết nối" : "Lưu"}</Button></div>
          <div className="field-wide"><ErrorNotice error={action.error} onDismiss={action.clearError} /></div>
        </form>
      ) : <p className="cell-note panel-body">Chỉ chủ trung tâm kết nối SePay và đổi chế độ.</p>}
    </Panel>
  );
}

function isoDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toLocaleDateString("en-CA");
}

/** K18: what the machine would have booked next to what staff recorded by hand. */
function ShadowReportPanel() {
  const { centerId } = useCenter();
  const [from, setFrom] = useState(isoDaysAgo(13));
  const [to, setTo] = useState(isoDaysAgo(0));
  const [range, setRange] = useState({ from, to });
  const report = useResource(() => financeApi.shadowReport(centerId, range.from, range.to), [centerId, range.from, range.to]);
  const data: ShadowReport | undefined = report.data;
  return (
    <Panel title="So sánh chạy thử" description="Mỗi khoản chuyển khoản: máy định ghi cho ai, và nhân viên đã ghi biên lai cho ai. Chỉ bật Tự động khi mọi dòng đều Khớp hoặc Cả hai không ghi.">
      <form className="toolbar" onSubmit={(event) => { event.preventDefault(); setRange({ from, to }); }}>
        <label className="select-inline"><span>Từ</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label className="select-inline"><span>Đến</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        <Button size="sm" type="submit" icon={<ScanSearch aria-hidden="true" />} pending={report.loading && Boolean(data)}>Xem</Button>
      </form>
      <ErrorNotice error={report.error} onReload={() => void report.reload()} />
      {!data ? <SkeletonRows rows={4} columns={5} /> : (
        <>
          <Notice tone={data.agrees ? "success" : "warning"} title={data.agrees ? "Máy và người ghi khớp nhau" : "Chưa khớp hoàn toàn"}>
            {data.agrees ? "Có thể cân nhắc bật Tự động." : "Xem các dòng Lệch / Máy ghi, người chưa ghi / Người ghi, máy không ghi bên dưới trước khi bật Tự động."}
          </Notice>
          <div className="badge-row">
            {Object.entries(data.counts).map(([key, count]) => <Badge key={key} tone={verdictLabels[key as ShadowVerdict]?.tone ?? "neutral"}>{verdictLabels[key as ShadowVerdict]?.label ?? key}: {count}</Badge>)}
          </div>
          {data.rows.length === 0 ? <EmptyState icon={<Inbox aria-hidden="true" />} title="Chưa có giao dịch trong khoảng này" /> : (
            <div className="table-wrap">
              <table className="table tuition-table">
                <thead><tr><th>Thời gian</th><th className="num">Số tiền</th><th>Nội dung</th><th>Máy định ghi</th><th>Nhân viên đã ghi</th><th>Kết luận</th></tr></thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.transactionId}>
                      <td className="col-muted">{formatDateTime(row.transactedAtUtc)}</td>
                      <td className="num">{formatMoney(row.amount)}</td>
                      <td><p className="cell-note">{row.content}</p></td>
                      <td>{row.expectedStudentName ? `${row.expectedStudentName} (${row.expectedStudentCode})` : <span className="col-muted">Không ghi</span>}</td>
                      <td>{row.manualReceiptNumber ? <>{row.manualStudentName}<p className="cell-note">{row.manualReceiptNumber}</p></> : <span className="col-muted">—</span>}</td>
                      <td><Badge tone={verdictLabels[row.verdict].tone}>{verdictLabels[row.verdict].label}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.manualWithoutTransfer.length > 0 && (
            <>
              <p className="field-label">Biên lai chuyển khoản ghi tay nhưng không thấy giao dịch SePay</p>
              <ul className="plain-list">
                {data.manualWithoutTransfer.map((item) => <li key={item.receiptId} className="cell-note">{item.number} · {formatIsoDate(item.receivedOn)} · {formatMoney(item.amount)} · {item.studentName}</li>)}
              </ul>
            </>
          )}
        </>
      )}
    </Panel>
  );
}

// ---------------- "whose money is it" queue ----------------

const filters: Array<{ value: BankTransferFilter; label: string }> = [
  { value: "Queue", label: "Cần xử lý" },
  { value: "Booked", label: "Đã ghi" },
  { value: "Ignored", label: "Bỏ qua" },
  { value: "All", label: "Tất cả" },
];

/** Staff answer one question per transfer: whose money is it. Owners and managers may also say it is not tuition. */
export function TransfersTab({ onChanged }: { onChanged: () => void }) {
  const { centerId, canManage, isOwner } = useCenter();
  const [status, setStatus] = useState<BankTransferFilter>("Queue");
  const [page, setPage] = useState(1);
  const [assigning, setAssigning] = useState<BankTransfer | null>(null);
  const [ignoring, setIgnoring] = useState<BankTransfer | null>(null);
  const [holding, setHolding] = useState<{ transfer: BankTransfer; duplicate: boolean } | null>(null);
  const retry = useAction();
  const list = useResource(() => financeApi.bankTransfers(centerId, { status, page, pageSize: 25 }), [centerId, status, page]);
  const done = () => { setAssigning(null); setIgnoring(null); setHolding(null); void list.reload(); onChanged(); };
  const data = list.data;
  return (
    <Panel flush>
      <div className="toolbar">
        <Segmented label="Lọc" value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={filters} />
        <Button size="sm" variant="ghost" icon={<RefreshCcw aria-hidden="true" />} onClick={() => void list.reload()} pending={list.loading && Boolean(data)}>Làm mới</Button>
      </div>
      <ErrorNotice error={list.error ?? retry.error} onReload={() => void list.reload()} onDismiss={retry.clearError} />
      {!data ? <SkeletonRows rows={6} columns={5} /> : data.items.length === 0 ? (
        <EmptyState icon={<BadgeCheck aria-hidden="true" />} title={status === "Queue" ? "Không có khoản nào cần xử lý" : "Không có khoản nào"}>
          {status === "Queue" ? "Mọi khoản chuyển khoản đều đã có chủ." : null}
        </EmptyState>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table transfers-table">
              <thead><tr><th>Số tiền</th><th>Nội dung chuyển khoản</th><th>Trạng thái</th><th>Gợi ý / học sinh</th><th className="col-actions"><span className="sr-only">Thao tác</span></th></tr></thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{formatMoney(item.amount)}</strong><p className="cell-note">{formatDateTime(item.transactedAtUtc)}</p><p className="cell-note">{item.bankCode}{item.referenceCode ? ` · ${item.referenceCode}` : ""}</p></td>
                    <td><p className="cell-note">{item.content || "(trống)"}</p></td>
                    <td>
                      <Badge tone={statusLabels[item.status]?.tone ?? "neutral"}>{statusLabels[item.status]?.label ?? item.status}</Badge>
                      {item.reviewReason && <p className="cell-note">{reviewLabels[item.reviewReason] ?? item.reviewReason}</p>}
                      {item.ignoreReason && <p className="cell-note">{ignoreLabels[item.ignoreReason] ?? item.ignoreReason}</p>}
                      {item.lastError && item.status === "Failed" && <p className="cell-note">{item.lastError}</p>}
                    </td>
                    <td>
                      {item.studentName && <p><Link className="row-link" href={`/centers/${centerId}/tuition/students/${item.studentId}`}>{item.studentName}</Link>{item.receiptNumber && <span className="cell-note"> · {item.receiptNumber}</span>}</p>}
                      {item.suggestions.map((s) => <p key={s.studentId} className="cell-note">{s.studentName} ({s.studentCode}) — {s.reason}</p>)}
                    </td>
                    <td className="col-actions">
                      {item.status === "NeedsReview" && <Button size="sm" variant="primary" icon={<UserCheck aria-hidden="true" />} onClick={() => setAssigning(item)}>Gán</Button>}
                      {canManage && (item.status === "NeedsReview" || item.status === "Failed") && <Button size="sm" variant="ghost" onClick={() => setIgnoring(item)}>Bỏ qua</Button>}
                      {isOwner && item.status === "Held" && <>
                        <Button size="sm" onClick={() => setHolding({ transfer: item, duplicate: true })}>Là bản trùng</Button>
                        <Button size="sm" variant="ghost" onClick={() => setHolding({ transfer: item, duplicate: false })}>Là giao dịch riêng</Button>
                      </>}
                      {isOwner && item.status === "Failed" && <Button size="sm" icon={<RotateCcw aria-hidden="true" />} pending={retry.pending}
                        onClick={() => void retry.run(() => financeApi.retryTransfer(centerId, item.id, item.version)).then((value) => value && done())}>Thử lại</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.totalCount} onChange={setPage} />
        </>
      )}
      {assigning && <AssignDialog transfer={assigning} onClose={() => setAssigning(null)} onDone={done} />}
      <ReasonDialog
        open={Boolean(ignoring)}
        title="Không phải học phí?"
        description={ignoring ? `${formatMoney(ignoring.amount)} — “${ignoring.content}”. Khoản này sẽ không được ghi biên lai; lý do được lưu lại.` : undefined}
        confirmLabel="Bỏ qua"
        minLength={3}
        maxLength={300}
        placeholder="Ví dụ: Hoàn tiền cho phụ huynh"
        onClose={() => setIgnoring(null)}
        onConfirm={async (reason) => {
          if (!ignoring) return;
          await financeApi.ignoreTransfer(centerId, ignoring.id, { reason, expectedVersion: ignoring.version });
          done();
        }}
      />
      <ReasonDialog
        open={Boolean(holding)}
        title={holding?.duplicate ? "Đây là bản trùng?" : "Đây là một giao dịch riêng?"}
        description={holding ? (holding.duplicate
          ? "Sao kê ngân hàng chỉ có MỘT khoản tiền này: bản này sẽ được bỏ qua."
          : "Sao kê ngân hàng có HAI khoản tiền thật: bản này sẽ được xử lý như một giao dịch mới.") : undefined}
        confirmLabel="Xác nhận"
        minLength={3}
        maxLength={300}
        placeholder="Ví dụ: Đã đối chiếu sao kê ngày 10/11"
        onClose={() => setHolding(null)}
        onConfirm={async (reason) => {
          if (!holding) return;
          await financeApi.resolveHeldTransfer(centerId, holding.transfer.id, { isDuplicate: holding.duplicate, reason, expectedVersion: holding.transfer.version });
          done();
        }}
      />
    </Panel>
  );
}

function AssignDialog({ transfer, onClose, onDone }: { transfer: BankTransfer; onClose: () => void; onDone: () => void }) {
  const { centerId } = useCenter();
  const action = useAction();
  const [chosen, setChosen] = useState<{ id: string; name: string; code: string } | null>(
    transfer.suggestions.length === 1 ? { id: transfer.suggestions[0].studentId, name: transfer.suggestions[0].studentName, code: transfer.suggestions[0].studentCode } : null);
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const found = useResource(
    () => search ? academicsApi.listStudents(centerId, { search, page: 1, pageSize: 8 }) : Promise.resolve(null),
    [centerId, search],
  );
  async function save() {
    if (!chosen) return;
    if (await action.run(() => financeApi.assignTransfer(centerId, transfer.id, { studentId: chosen.id, expectedVersion: transfer.version }))) onDone();
  }
  const pick = (student: Pick<Student, "id" | "fullName" | "code">) => setChosen({ id: student.id, name: student.fullName, code: student.code });
  return (
    <Dialog
      open
      size="md"
      title={`Khoản ${formatMoney(transfer.amount)} này của ai?`}
      description={<>Nội dung: “{transfer.content || "(trống)"}” · {formatDateTime(transfer.transactedAtUtc)}. Hệ thống tạo biên lai cho học sinh được chọn và trừ vào các khoản còn nợ, cũ nhất trước. Đối chiếu sao kê ngân hàng nếu không chắc.</>}
      onClose={onClose}
      onSubmit={() => void save()}
      footer={<><Button onClick={onClose} disabled={action.pending}>Hủy</Button><Button type="submit" variant="primary" pending={action.pending} status={action.status} disabled={!chosen}>Gán và tạo biên lai</Button></>}
    >
      {transfer.suggestions.length > 0 && (
        <>
          <p className="field-label">Gợi ý</p>
          <ul className="plain-list">
            {transfer.suggestions.map((s) => (
              <li key={s.studentId}>
                <Button size="sm" variant={chosen?.id === s.studentId ? "primary" : "secondary"} onClick={() => setChosen({ id: s.studentId, name: s.studentName, code: s.studentCode })}>{s.studentName} ({s.studentCode})</Button>
                <span className="cell-note"> {s.reason}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <Field label="Tìm học sinh khác" hint="Theo tên hoặc mã học sinh.">
        {(id, describedBy) => (
          <div className="search">
            <Search aria-hidden="true" />
            <input id={id} value={term} aria-describedby={describedBy} maxLength={100} onChange={(event) => setTerm(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); setSearch(term.trim()); } }} />
            <Button size="sm" onClick={() => setSearch(term.trim())}>Tìm</Button>
          </div>
        )}
      </Field>
      {found.data && (
        <ul className="plain-list">
          {found.data.items.length === 0 ? <li className="cell-note">Không tìm thấy.</li> : found.data.items.map((student) => (
            <li key={student.id}><Button size="sm" variant={chosen?.id === student.id ? "primary" : "ghost"} onClick={() => pick(student)}>{student.fullName} ({student.code})</Button></li>
          ))}
        </ul>
      )}
      {chosen && <Notice tone="info">Sẽ gán cho <strong>{chosen.name}</strong> ({chosen.code}).</Notice>}
      <ErrorNotice error={action.error} onDismiss={action.clearError} />
    </Dialog>
  );
}
