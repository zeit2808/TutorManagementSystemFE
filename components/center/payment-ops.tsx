"use client";

import { Fragment, useState } from "react";
import { BellRing, CheckCheck, ChevronDown, ChevronUp, History, Play, RefreshCcw } from "lucide-react";
import { financeApi, type PaymentAlert, type PaymentAlertState, type ReconciliationRun } from "@/lib/api";
import { useAction, useResource } from "@/lib/hooks/use-resource";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { Tone } from "@/lib/labels";
import { Badge, Button, EmptyState, ErrorNotice, Notice, Pagination, Panel, Segmented, SkeletonRows } from "@/components/ui/primitives";
import { useCenter } from "./center-frame";

// ---------------- labels ----------------

const alertState: Record<PaymentAlertState, { label: string; tone: Tone }> = {
  Open: { label: "Đang mở", tone: "danger" },
  Acknowledged: { label: "Đã xem", tone: "warning" },
  Resolved: { label: "Đã hết", tone: "success" },
};
const findingLabels: Record<string, string> = {
  MissedByPull: "Bị bỏ lỡ, đối soát đã bắt lại",
  ChangedAfterStore: "SePay đổi dữ liệu đã ghi",
  DoorbellWithoutTransfer: "Webhook có, API không có",
  BookedWithoutReceipt: "Đã ghi nhưng không có biên lai",
  ReceiptWithoutBookedTransfer: "Biên lai không khớp giao dịch",
  ReceiptAmountMismatch: "Biên lai lệch số tiền",
  OverAllocated: "Trừ nợ quá số tiền",
  TotalsMismatch: "Tổng không khớp",
};
const fetchedByLabels: Record<string, string> = { Doorbell: "Webhook", Periodic: "Kéo 5 phút", Nightly: "Đối soát đêm", Manual: "Đối soát bấm tay" };
const statusLabels: Record<string, string> = {
  Booked: "Đã ghi", NeedsReview: "Chưa rõ của ai", Held: "Nghi trùng", Failed: "Lỗi xử lý", Received: "Đang xử lý", Ignored: "Bỏ qua",
};

function duration(seconds: number | null | undefined) {
  if (seconds == null) return "—";
  if (seconds < 90) return `${Math.round(seconds)} giây`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} phút`;
  if (seconds < 172800) return `${Math.round(seconds / 3600)} giờ`;
  return `${Math.round(seconds / 86400)} ngày`;
}

/** Đợt 5: what the nightly reconciliation and the minute monitor found, for the owner and managers. */
export function ReconciliationTab() {
  return (
    <>
      <AlertsPanel />
      <RunsPanel />
      <MetricsPanel />
    </>
  );
}

// ---------------- alerts ----------------

const alertFilters: Array<{ value: PaymentAlertState | "All"; label: string }> = [
  { value: "Open", label: "Đang mở" },
  { value: "Acknowledged", label: "Đã xem" },
  { value: "Resolved", label: "Đã hết" },
  { value: "All", label: "Tất cả" },
];

function AlertsPanel() {
  const { centerId, isOwner } = useCenter();
  const [state, setState] = useState<PaymentAlertState | "All">("Open");
  const list = useResource(() => financeApi.paymentAlerts(centerId, state), [centerId, state]);
  const ack = useAction();
  async function acknowledge(alert: PaymentAlert) {
    if (await ack.run(() => financeApi.acknowledgeAlert(centerId, alert.id))) void list.reload();
  }
  return (
    <Panel title="Cảnh báo" description="Mỗi cảnh báo được email cho chủ trung tâm một lần khi xuất hiện; còn mở thì nhắc trong email tổng hợp 07:00 mỗi sáng. Bấm “Đã xem” để thôi nhắc.">
      <div className="toolbar">
        <Segmented label="Lọc cảnh báo" value={state} onChange={setState} options={alertFilters} />
        <Button size="sm" variant="ghost" icon={<RefreshCcw aria-hidden="true" />} onClick={() => void list.reload()} pending={list.loading && Boolean(list.data)}>Làm mới</Button>
      </div>
      <ErrorNotice error={list.error ?? ack.error} onReload={() => void list.reload()} onDismiss={ack.clearError} />
      {!list.data ? <SkeletonRows rows={3} columns={3} /> : list.data.length === 0 ? (
        <EmptyState icon={<CheckCheck aria-hidden="true" />} title={state === "Open" ? "Không có cảnh báo nào đang mở" : "Không có cảnh báo"}>
          {state === "Open" ? "Tiền vào, biên lai và sổ đang khớp nhau." : null}
        </EmptyState>
      ) : (
        <ul className="alert-list">
          {list.data.map((alert) => (
            <li key={alert.id} className="alert-item">
              <div className="row-between">
                <p><BellRing aria-hidden="true" className="inline-icon" /> <strong>{alert.title}</strong></p>
                <Badge tone={alertState[alert.state].tone}>{alertState[alert.state].label}</Badge>
              </div>
              <p className="cell-note">{alert.detail}</p>
              <p className="cell-note">
                Từ {formatDateTime(alert.firstSeenAtUtc)} · thấy lần cuối {formatDateTime(alert.lastSeenAtUtc)}
                {alert.resolvedAtUtc && ` · hết lúc ${formatDateTime(alert.resolvedAtUtc)}`}
              </p>
              {isOwner && alert.state === "Open" && (
                <Button size="sm" icon={<CheckCheck aria-hidden="true" />} pending={ack.pending} onClick={() => void acknowledge(alert)}>Đã xem</Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ---------------- reconciliation history ----------------

function RunsPanel() {
  const { centerId, isOwner } = useCenter();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Guid | null>(null);
  const [requested, setRequested] = useState(false);
  const list = useResource(() => financeApi.reconciliations(centerId, { page, pageSize: 10 }), [centerId, page]);
  const start = useAction();
  async function reconcileNow() {
    if (await start.run(() => financeApi.reconcileNow(centerId))) setRequested(true);
  }
  const data = list.data;
  return (
    <Panel
      title="Lịch sử đối soát"
      description="Mỗi đêm 02:00 hệ thống đọc lại 3 ngày gần nhất từ SePay và kiểm tra: tiền vào ↔ giao dịch đã lưu ↔ biên lai ↔ trừ nợ. Chỉ kiểm tra, không tự sửa tiền."
      actions={isOwner ? <Button size="sm" variant="primary" icon={<Play aria-hidden="true" />} pending={start.pending} status={start.status} onClick={() => void reconcileNow()}>Đối soát ngay</Button> : undefined}
      flush
    >
      {requested && (
        <Notice tone="info" title="Đã yêu cầu đối soát" onDismiss={() => setRequested(false)}
          action={<Button size="sm" onClick={() => void list.reload()}>Tải lại</Button>}>
          Hệ thống bắt đầu trong khoảng nửa phút. Tải lại sau ít phút để xem kết quả.
        </Notice>
      )}
      <ErrorNotice error={list.error ?? start.error} onReload={() => void list.reload()} onDismiss={start.clearError} />
      {!data ? <SkeletonRows rows={4} columns={6} /> : data.items.length === 0 ? (
        <EmptyState icon={<History aria-hidden="true" />} title="Chưa có lần đối soát nào">Lần đầu chạy lúc 02:00 đêm nay, hoặc chủ trung tâm bấm “Đối soát ngay”.</EmptyState>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table transfers-table">
              <thead><tr><th>Lúc chạy</th><th>Kết quả</th><th className="num">Tiền vào</th><th>Đã ghi / biên lai</th><th>Phát hiện</th><th className="col-actions"><span className="sr-only">Chi tiết</span></th></tr></thead>
              <tbody>
                {data.items.map((run) => (
                  <Fragment key={run.id}>
                    <tr>
                      <td>{formatDateTime(run.startedAtUtc)}<p className="cell-note">{run.trigger === "Nightly" ? "Tự động ban đêm" : "Bấm tay"}</p></td>
                      <td>
                        {run.status === "ScanFailed"
                          ? <Badge tone="warning">Không đọc được SePay</Badge>
                          : <Badge tone={run.totalsAgree ? "success" : "danger"}>{run.totalsAgree ? "Tổng khớp" : "Tổng lệch"}</Badge>}
                        <p className="cell-note">SePay liệt kê {run.scannedCount} · bỏ lỡ {run.missedCount} · đổi dữ liệu {run.changedCount}</p>
                      </td>
                      <td className="num">{formatMoney(run.incomingTotal)}</td>
                      <td>{formatMoney(run.bookedTotal)} / {formatMoney(run.bookedReceiptTotal)}
                        <p className="cell-note">Chờ {formatMoney(run.pendingTotal)} · lỗi {formatMoney(run.failedTotal)} · bỏ qua {formatMoney(run.ignoredTotal)}</p>
                      </td>
                      <td><Badge tone={run.findingCount === 0 ? "success" : "danger"}>{run.findingCount === 0 ? "Không có" : `${run.findingCount} vấn đề`}</Badge></td>
                      <td className="col-actions">
                        <Button size="sm" variant="ghost" icon={open === run.id ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
                          aria-expanded={open === run.id} onClick={() => setOpen(open === run.id ? null : run.id)}>Chi tiết</Button>
                      </td>
                    </tr>
                    {open === run.id && <tr><td colSpan={6}><RunDetail runId={run.id} /></td></tr>}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.totalCount} onChange={setPage} />
        </>
      )}
    </Panel>
  );
}

type Guid = string;

function RunDetail({ runId }: { runId: Guid }) {
  const { centerId } = useCenter();
  const detail = useResource(() => financeApi.reconciliation(centerId, runId), [centerId, runId]);
  const run: ReconciliationRun | undefined = detail.data;
  if (!run) return <><ErrorNotice error={detail.error} onReload={() => void detail.reload()} />{!detail.error && <SkeletonRows rows={2} columns={2} />}</>;
  return (
    <div className="stack">
      <p className="cell-note">Cửa sổ kiểm tra: {formatDateTime(run.windowFromUtc)} → {formatDateTime(run.windowToUtc)}.</p>
      {run.error && <Notice tone="warning" title="Không đọc được SePay">{run.error} — phần kiểm tra trên dữ liệu đã lưu vẫn chạy.</Notice>}
      {run.findings.length === 0 ? <p className="cell-note">Không phát hiện vấn đề.</p> : (
        <ul className="plain-list">
          {run.findings.map((finding, index) => (
            <li key={`${finding.kind}-${index}`}>
              <Badge tone="danger">{findingLabels[finding.kind] ?? finding.kind}</Badge>
              {finding.amount != null && <strong> {formatMoney(finding.amount)}</strong>}
              <p className="cell-note">{finding.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------- metrics ----------------

const periods: Array<{ value: "1" | "7" | "30"; label: string }> = [
  { value: "1", label: "24 giờ" },
  { value: "7", label: "7 ngày" },
  { value: "30", label: "30 ngày" },
];

function MetricsPanel() {
  const { centerId } = useCenter();
  const [days, setDays] = useState<"1" | "7" | "30">("7");
  const metrics = useResource(() => financeApi.paymentMetrics(centerId, Number(days)), [centerId, days]);
  const m = metrics.data;
  const redelivered = m && m.doorbells > 0 ? Math.round((100 * m.doorbellsRedelivered) / m.doorbells) : 0;
  const peak = m ? Math.max(1, ...m.doorbellsByHour) : 1;
  return (
    <Panel title="Chỉ số vận hành" description="Tính từ dữ liệu đã lưu. Webhook chỉ là chuông báo; tiền luôn được lấy từ API SePay.">
      <div className="toolbar">
        <Segmented label="Khoảng thời gian" value={days} onChange={setDays} options={periods} />
      </div>
      <ErrorNotice error={metrics.error} onReload={() => void metrics.reload()} />
      {!m ? <SkeletonRows rows={3} columns={4} /> : (
        <div className="stack panel-body">
          <dl className="money-strip" aria-label="Chỉ số chính">
            <div><dt>Giao dịch vào</dt><dd>{m.transfers}</dd><span>{formatMoney(m.transferAmount)}</span></div>
            <div className={m.latencyP95Seconds != null && m.latencyP95Seconds > 300 ? "is-danger" : undefined}>
              <dt>Chuyển tiền → biên lai</dt><dd>{duration(m.latencyP50Seconds)}</dd><span>95% trong {duration(m.latencyP95Seconds)}, chậm nhất {duration(m.latencyMaxSeconds)}</span>
            </div>
            <div className={m.oldestReceivedSeconds != null && m.oldestReceivedSeconds > 600 ? "is-danger" : undefined}>
              <dt>Đang chờ ghi lâu nhất</dt><dd>{m.oldestReceivedSeconds == null ? "Không có" : duration(m.oldestReceivedSeconds)}</dd><span>Cảnh báo khi quá 10 phút ở chế độ Tự động</span>
            </div>
            <div className={m.openAlerts > 0 ? "is-danger" : undefined}>
              <dt>Cảnh báo đang mở</dt><dd>{m.openAlerts}</dd>
              <span>{m.lastReconciledAtUtc ? `Đối soát gần nhất ${formatDateTime(m.lastReconciledAtUtc)}: ${m.lastReconciliationFindings ?? 0} vấn đề` : "Chưa đối soát lần nào"}</span>
            </div>
          </dl>

          <div className="detail-grid detail-grid-wide">
            <div>
              <p className="field-label">Webhook (chuông báo)</p>
              <ul className="plain-list">
                <li className="cell-note">{m.doorbells} chuông ký đúng · {redelivered}% SePay gửi lại nhiều lần</li>
                <li className="cell-note">Sai chữ ký từ trước tới nay: {m.invalidSignatureTotal}{m.lastInvalidSignatureAtUtc ? `, gần nhất ${formatDateTime(m.lastInvalidSignatureAtUtc)}` : ""}</li>
              </ul>
              <p className="field-label">Chuông theo giờ (24 giờ qua)</p>
              <div className="hour-bars" role="img" aria-label={`Số chuông theo giờ trong 24 giờ qua: ${m.doorbellsByHour.join(", ")}`}>
                {m.doorbellsByHour.map((count, index) => (
                  <span key={index} style={{ height: `${Math.max(4, (100 * count) / peak)}%` }} className={count === 0 ? "is-empty" : undefined} title={`${count}`} />
                ))}
              </div>
            </div>
            <div>
              <p className="field-label">Giao dịch được tìm thấy nhờ</p>
              <ul className="plain-list">
                {Object.entries(m.byFetchedBy).length === 0 ? <li className="cell-note">Chưa có</li> : Object.entries(m.byFetchedBy).map(([key, count]) => (
                  <li key={key} className="cell-note">{fetchedByLabels[key] ?? key}: {count}</li>
                ))}
              </ul>
              <p className="field-label">Trạng thái</p>
              <ul className="plain-list">
                {Object.entries(m.byStatus).map(([key, count]) => <li key={key} className="cell-note">{statusLabels[key] ?? key}: {count}</li>)}
              </ul>
              <p className="field-label">Việc tay và an toàn</p>
              <ul className="plain-list">
                <li className="cell-note">Gán tay {m.manualAssigned} · bỏ qua {m.manualIgnored} · thử lại {m.manualRetried}</li>
                <li className="cell-note">SePay liệt kê lại giao dịch đã lưu: {m.seenAgain} (khoá chống trùng đã chặn)</li>
                <li className="cell-note">{m.receiptConflicts === 0 ? "Không có lần ghi biên lai trùng nào." : <Badge tone="danger">{m.receiptConflicts} lần ghi biên lai trùng bị chặn — báo kỹ thuật</Badge>}</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
