"use client";

import { useState } from "react";
import { Coins, Settings2 } from "lucide-react";
import { payrollApi, type PayrollConfig, type PayrollMode } from "@/lib/api";
import { useAction, useResource } from "@/lib/hooks/use-resource";
import { formatDateTime, formatMonth } from "@/lib/format";
import { payrollModeLabels } from "@/lib/labels";
import { Badge, Button, Dialog, ErrorNotice, Field, KeyValue, Notice, Panel, SkeletonRows, Toggle } from "@/components/ui/primitives";

function nextMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/** "Đang bật · Chia thu nhập" / "Đang tắt" — the one-line state used in the overview, the detail page and the dialog. */
export function PayrollStateBadge({ enabled, mode }: { enabled: boolean; mode: string }) {
  return enabled
    ? <Badge tone="success">{payrollModeLabels[mode]?.title ?? mode}</Badge>
    : <Badge tone="neutral">Chưa bật</Badge>;
}

/**
 * Compact block on the center detail page: what applies now, what is scheduled, and one button that opens the
 * configuration. The full form lives in a dialog so it reads the same here and on the payroll overview page.
 */
export function PayrollConfigPanel({ centerId, centerName }: { centerId: string; centerName: string }) {
  const config = useResource(() => payrollApi.config(centerId), [centerId]);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const data = config.data;
  const scheduled = data?.effectiveMonth && data.effectiveMonth > data.currentMonth ? data : null;
  return (
    <Panel title={<><Coins aria-hidden="true" className="inline-icon" /> Lương & chia thu nhập</>}
      description="Admin bật/tắt và chọn cách tính; không xem tiền."
      actions={<Button size="sm" variant="primary" icon={<Settings2 aria-hidden="true" />} disabled={!data} onClick={() => setEditing(true)}>Cấu hình</Button>}>
      <ErrorNotice error={config.error} onReload={() => void config.reload()} />
      {saved && <div className="panel-body"><Notice tone="success" onDismiss={() => setSaved(null)}>{saved}</Notice></div>}
      {!data ? <SkeletonRows rows={2} columns={2} /> : (
        <div className="panel-body">
          <KeyValue items={[
            { label: formatMonth(data.currentMonth), value: <PayrollStateBadge enabled={data.enabledThisMonth} mode={data.modeThisMonth} /> },
            { label: "Thay đổi đã hẹn", value: scheduled
              ? <>Từ {formatMonth(scheduled.effectiveMonth!).toLowerCase()}: <PayrollStateBadge enabled={scheduled.enabled} mode={scheduled.mode} /></>
              : <span className="col-muted">Không có</span> },
            { label: "Tháng chốt gần nhất", value: data.latestClosedMonth ? formatMonth(data.latestClosedMonth) : <span className="col-muted">Chưa chốt tháng nào</span> },
            { label: "Đổi lần cuối", value: data.history[0]
              ? `${formatDateTime(data.history[0].createdAtUtc)}${data.history[0].actorName ? ` · ${data.history[0].actorName}` : ""}`
              : <span className="col-muted">Chưa cấu hình</span> },
          ]} />
        </div>
      )}
      {editing && data && (
        <PayrollConfigDialog config={data} centerName={centerName} onClose={() => setEditing(false)}
          onSaved={(next, message) => { config.setData(next); setEditing(false); setSaved(message); }} />
      )}
    </Panel>
  );
}

/** Loads the configuration of one center, then opens the dialog (used from the overview table). */
export function PayrollConfigDialogLoader({ centerId, centerName, onClose, onSaved }: { centerId: string; centerName: string; onClose: () => void; onSaved: (message: string) => void }) {
  const config = useResource(() => payrollApi.config(centerId), [centerId]);
  if (!config.data) {
    return (
      <Dialog open title={`Lương & chia thu nhập — ${centerName}`} onClose={onClose} footer={<Button onClick={onClose}>Đóng</Button>}>
        {config.error ? <ErrorNotice error={config.error} onReload={() => void config.reload()} /> : <SkeletonRows rows={4} columns={2} />}
      </Dialog>
    );
  }
  return <PayrollConfigDialog config={config.data} centerName={centerName} onClose={onClose} onSaved={(_, message) => onSaved(message)} />;
}

/**
 * A1/A2 (docs/LUONG-VA-CHIA-THU-NHAP.md): turn payroll on or off for one center and pick the method, from this month
 * or next, with a reason. A closed month keeps its method, so "this month" is unavailable once it is closed.
 */
function PayrollConfigDialog({ config, centerName, onClose, onSaved }: { config: PayrollConfig; centerName: string; onClose: () => void; onSaved: (next: PayrollConfig, message: string) => void }) {
  const current = config.currentMonth;
  const next = nextMonth(current);
  const currentClosed = Boolean(config.latestClosedMonth && config.latestClosedMonth >= current);
  const [enabled, setEnabled] = useState(config.enabled || config.version === 0);
  const [mode, setMode] = useState<PayrollMode>(config.mode);
  const [effective, setEffective] = useState(currentClosed ? next : current);
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const action = useAction();
  const reasonError = reason.trim().length >= 3 && reason.trim().length <= 300 ? null : "Ghi lý do (3–300 ký tự).";

  async function submit() {
    setTouched(true);
    if (reasonError) return;
    const result = await action.run(() => payrollApi.setConfig(config.centerId, { enabled, mode, effectiveMonth: effective, reason: reason.trim(), expectedVersion: config.version }));
    if (result) onSaved(result, `${centerName}: ${enabled ? payrollModeLabels[mode].title.toLowerCase() : "tắt lương / chia thu nhập"} từ ${formatMonth(effective).toLowerCase()}.`);
  }

  return (
    <Dialog open size="lg" title={`Lương & chia thu nhập — ${centerName}`}
      description={<>Tháng này: <PayrollStateBadge enabled={config.enabledThisMonth} mode={config.modeThisMonth} />{config.latestClosedMonth ? ` · đã chốt tới ${formatMonth(config.latestClosedMonth).toLowerCase()}` : ""}</>}
      onClose={onClose} onSubmit={submit}
      footer={<><Button onClick={onClose} disabled={action.pending}>Đóng</Button><Button type="submit" variant="primary" pending={action.pending}>Lưu cấu hình</Button></>}>
      <div className="form-grid">
        <div className="span-2"><Toggle checked={enabled} onChange={setEnabled} label="Bật lương / chia thu nhập cho trung tâm này" /></div>
        <Field label="Cách tính" required className="span-2">
          {(id) => (
            <div className="choice-list payroll-modes" id={id} role="radiogroup" aria-label="Cách tính">
              {(["RevenueShare", "PerSession"] as PayrollMode[]).map((value) => (
                <label key={value} className={`choice${mode === value ? " checked" : ""}${enabled ? "" : " disabled"}`}>
                  <input type="radio" name="payroll-mode" value={value} checked={mode === value} onChange={() => setMode(value)} disabled={!enabled} />
                  <span className="choice-text"><strong>{payrollModeLabels[value].title}</strong><small className="cell-note">{payrollModeLabels[value].description}</small></span>
                </label>
              ))}
            </div>
          )}
        </Field>
        <Field label="Áp dụng từ" required hint={currentClosed ? "Tháng này đã chốt, chỉ đổi được từ tháng sau." : "Tháng đã chốt giữ nguyên cách tính cũ."}>
          {(id, describedBy) => (
            <select id={id} aria-describedby={describedBy} value={effective} onChange={(event) => setEffective(event.target.value)}>
              <option value={current} disabled={currentClosed}>{formatMonth(current)} (tháng này)</option>
              <option value={next}>{formatMonth(next)} (tháng sau)</option>
            </select>
          )}
        </Field>
        <Field label="Lý do" required error={touched ? reasonError : null}>
          {(id) => <input id={id} value={reason} maxLength={300} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: Gia đình tự dạy, chia thu nhập" />}
        </Field>
      </div>
      <ErrorNotice error={action.error} />
      {config.history.length > 0 && (
        <div className="payroll-config-history">
          <p className="field-label">Lịch sử thay đổi</p>
          <ol>
            {config.history.slice(0, showAll ? undefined : 3).map((item) => (
              <li key={item.id}>
                <p><strong>{item.enabled ? payrollModeLabels[item.mode]?.title : "Tắt"}</strong> từ {formatMonth(item.effectiveMonth).toLowerCase()}
                  <span className="col-muted"> · trước đó: {item.previousEnabled ? payrollModeLabels[item.previousMode]?.title.toLowerCase() : "tắt"}</span></p>
                <p className="cell-note">{item.reason} — {formatDateTime(item.createdAtUtc)}{item.actorName ? ` · ${item.actorName}` : ""}</p>
              </li>
            ))}
          </ol>
          {config.history.length > 3 && (
            <button type="button" className="text-link" onClick={() => setShowAll(!showAll)}>
              {showAll ? "Thu gọn" : `Xem cả ${config.history.length} lần thay đổi`}
            </button>
          )}
        </div>
      )}
    </Dialog>
  );
}
