"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CalendarCheck2, CalendarRange, CheckCircle2, Eye, Plus, RefreshCcw, Repeat, StopCircle } from "lucide-react";
import { academicsApi, ApiError, type CreateScheduleSeriesInput, type ScheduleOccurrence, type SchedulePreview, type ScheduleSeries } from "@/lib/api";
import { useAction, useResource } from "@/lib/hooks/use-resource";
import { useNow } from "@/lib/hooks/use-now";
import { useCenterLookups, type CenterLookups } from "@/lib/hooks/use-lookups";
import { addDays, formatDateOnly, formatDuration, formatTimeRange, formatWeekday, localInputsToUtc, newUuid, toDateInput } from "@/lib/format";
import { conflictLabels, weekdays } from "@/lib/labels";
import { Badge, Button, Dialog, EmptyState, ErrorNotice, Field, Notice, PageHeader, Pagination, Panel, SkeletonRows } from "@/components/ui/primitives";
import { useCenter } from "./center-frame";
import { ScheduleTabs } from "./schedule-tabs";

const englishDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
function weekdayOf(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return englishDays[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

const weekdayShort = Object.fromEntries(weekdays.map((day) => [day.value, day.short]));

export function SeriesWorkspace() {
  const { centerId, canManage } = useCenter();
  const params = useSearchParams();
  const initialClass = params.get("classId") ?? "";
  const [classFilter, setClassFilter] = useState(initialClass);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(() => params.get("new") === "1" && canManage);
  const [stopping, setStopping] = useState<ScheduleSeries | null>(null);
  const [replacing, setReplacing] = useState<ScheduleSeries | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const lookups = useCenterLookups(centerId);
  const now = useNow();
  const series = useResource(() => academicsApi.listScheduleSeries(centerId, { page, pageSize: 25, classId: classFilter || undefined }), [centerId, page, classFilter]);
  const lk = lookups.data;

  return (
    <>
      <PageHeader
        title="Lịch dạy"
        description="Mỗi buổi gắn một lớp, một giáo viên và một phòng; hệ thống chặn trùng lịch cho cả ba. Lịch lặp sinh nhiều buổi cùng lúc theo thứ trong tuần."
        meta={<ScheduleTabs centerId={centerId} />}
        actions={canManage && <Button variant="primary" icon={<Plus aria-hidden="true" />} disabled={!lk} onClick={() => setCreating(true)}>Tạo lịch lặp</Button>}
      />
      {notice && <Notice tone="success" onDismiss={() => setNotice(null)}>{notice}</Notice>}
      <ErrorNotice error={series.error ?? lookups.error} onReload={() => void series.reload()} />

      <Panel flush>
        <div className="toolbar">
          <label className="select-inline"><span>Lớp</span>
            <select value={classFilter} onChange={(event) => { setClassFilter(event.target.value); setPage(1); }}>
              <option value="">Tất cả lớp</option>
              {lk?.classes.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
            </select>
          </label>
          <Button size="sm" variant="ghost" icon={<RefreshCcw aria-hidden="true" />} onClick={() => void series.reload()} pending={series.loading && Boolean(series.data)}>Làm mới</Button>
        </div>
        {!series.data || !lk ? (
          <SkeletonRows rows={5} columns={6} />
        ) : series.data.items.length === 0 ? (
          <EmptyState icon={<CalendarRange aria-hidden="true" />} title="Chưa có lịch lặp">
            {canManage ? "Lịch lặp tạo nhiều buổi cùng lúc trong tối đa 180 ngày, theo các thứ đã chọn." : "Chủ hoặc quản lý trung tâm sẽ tạo lịch lặp cho các lớp."}
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Lớp</th><th>Lịch</th><th>Khoảng ngày</th><th>Giáo viên · Phòng</th><th>Trạng thái</th>{canManage && <th className="col-actions"><span className="sr-only">Thao tác</span></th>}</tr></thead>
              <tbody>
                {series.data.items.map((item) => {
                  const teachingClass = lk.classById.get(item.classId);
                  const ended = item.endDate < toDateInput(new Date(now));
                  const stopped = Boolean(item.stoppedFromDate);
                  return (
                    <tr key={item.id}>
                      <td><strong>{item.className ?? teachingClass?.name ?? "—"}</strong><br /><code className="code">{item.classCode ?? teachingClass?.code}</code></td>
                      <td>
                        <span className="weekday-chips">{item.weekdays.map((day) => <span key={day}>{weekdayShort[day] ?? day}</span>)}</span>
                        <span className="col-muted"> {item.localStartTime.slice(0, 5)} · {formatDuration(item.durationMinutes)}</span>
                      </td>
                      <td className="col-muted">{formatDateOnly(item.startDate)} – {formatDateOnly(item.endDate)}<br />{item.generatedSessionCount} buổi</td>
                      <td className="col-muted">{item.teacherName ?? lk.teacherById.get(item.teacherId)?.fullName ?? "—"}<br />{item.roomName ?? lk.roomById.get(item.roomId)?.name ?? "—"}</td>
                      <td>
                        {stopped ? <Badge tone="warning">Dừng từ {formatDateOnly(item.stoppedFromDate)}</Badge> : ended ? <Badge tone="neutral">Đã kết thúc</Badge> : <Badge tone="success">Đang áp dụng</Badge>}
                        {item.replacesSeriesId && <><br /><Badge tone="info">Thay cho lịch cũ</Badge></>}
                      </td>
                      {canManage && (
                        <td className="col-actions">
                          {!ended && (
                            <>
                              <Button size="sm" variant="ghost" icon={<Repeat aria-hidden="true" />} onClick={() => setReplacing(item)}>Thay từ ngày…</Button>
                              <Button size="sm" variant="ghost" icon={<StopCircle aria-hidden="true" />} onClick={() => setStopping(item)}>Dừng từ ngày…</Button>
                            </>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {series.data && <Pagination page={page} pageSize={series.data.pageSize} total={series.data.totalCount} onChange={setPage} />}
      </Panel>

      {creating && lk && (
        <SeriesComposer
          lookups={lk}
          initialClassId={classFilter}
          onClose={() => setCreating(false)}
          onDone={(message) => { setCreating(false); setNotice(message); void series.reload(); }}
        />
      )}
      {replacing && lk && (
        <SeriesComposer
          lookups={lk}
          replace={replacing}
          onClose={() => setReplacing(null)}
          onDone={(message) => { setReplacing(null); setNotice(message); void series.reload(); }}
        />
      )}
      {stopping && <StopSeriesDialog series={stopping} onClose={() => setStopping(null)} onDone={(message) => { setStopping(null); setNotice(message); void series.reload(); }} />}
    </>
  );
}

function StopSeriesDialog({ series, onClose, onDone }: { series: ScheduleSeries; onClose: () => void; onDone: (message: string) => void }) {
  const { centerId } = useCenter();
  const today = toDateInput(new Date());
  const [fromDate, setFromDate] = useState(series.startDate > today ? series.startDate : today);
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [shortNotice, setShortNotice] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const action = useAction();
  const outOfRange = fromDate < today || fromDate < series.startDate || fromDate > series.endDate;
  const reasonError = !reason.trim() || reason.trim().length > 500 ? "Nhập lý do (1–500 ký tự); học sinh sẽ thấy lý do này." : null;

  async function submit() {
    setTouched(true);
    if (outOfRange || reasonError || (shortNotice && !acknowledged)) return;
    let needsConfirm = false;
    const result = await action.run(() => askShortNotice(() => academicsApi.stopScheduleSeries(centerId, series.id,
      { fromDate, expectedVersion: series.version, reason: reason.trim(), acknowledgeShortNotice: acknowledged }), () => { needsConfirm = true; }));
    if (result) onDone(`Đã dừng lịch từ ${formatDateOnly(fromDate)}; ${result.sessionsCancelled} buổi tương lai đã được hủy và học sinh đã được báo.`);
    else if (needsConfirm) setShortNotice(true);
  }

  return (
    <Dialog open size="sm" title="Dừng lịch lặp từ một ngày" onClose={onClose} onSubmit={submit}
      footer={<><Button onClick={onClose} disabled={action.pending}>Đóng</Button><Button type="submit" variant="danger" pending={action.pending} disabled={outOfRange}>Dừng lịch</Button></>}>
      <p>Mọi buổi của chuỗi từ ngày này trở đi sẽ bị hủy và học sinh của lớp được báo trong ứng dụng và qua email. Thao tác bị chặn nếu trong phạm vi đó có buổi đã bắt đầu hoặc đã có phiếu điểm danh.</p>
      <Field label="Dừng từ ngày" required error={outOfRange ? `Chọn từ ${formatDateOnly(series.startDate > today ? series.startDate : today)} đến ${formatDateOnly(series.endDate)}.` : null}>
        {(id) => <input id={id} type="date" value={fromDate} min={series.startDate > today ? series.startDate : today} max={series.endDate} onChange={(event) => { setFromDate(event.target.value); setShortNotice(false); setAcknowledged(false); }} />}
      </Field>
      <Field label="Lý do" required error={touched ? reasonError : null}>
        {(id, describedBy) => <textarea id={id} aria-describedby={describedBy} rows={2} maxLength={500} value={reason} placeholder="Ví dụ: lớp tạm nghỉ hết học kỳ" onChange={(event) => setReason(event.target.value)} />}
      </Field>
      {shortNotice && <ShortNoticeConfirm checked={acknowledged} onChange={setAcknowledged} />}
      <ErrorNotice error={action.error} />
    </Dialog>
  );
}

interface ComposerState {
  classId: string;
  teacherId: string;
  roomId: string;
  startDate: string;
  endDate: string;
  time: string;
  duration: string;
  weekdays: string[];
  excluded: string[];
}

function SeriesComposer({ lookups, replace, initialClassId, onClose, onDone }: { lookups: CenterLookups; replace?: ScheduleSeries; initialClassId?: string; onClose: () => void; onDone: (message: string) => void }) {
  const { centerId } = useCenter();
  const activeClasses = lookups.classes.filter((item) => item.isActive);
  const activeTeachers = lookups.teachers.filter((item) => item.isActive);
  const activeRooms = lookups.rooms.filter((item) => item.isActive);
  const tomorrow = toDateInput(addDays(new Date(), 1));
  const today = toDateInput(new Date());
  const replaceFrom = replace ? (replace.startDate > today ? replace.startDate : tomorrow) : "";

  const [state, setState] = useState<ComposerState>(() => ({
    classId: replace?.classId ?? (initialClassId || activeClasses[0]?.id || ""),
    teacherId: replace?.teacherId ?? activeTeachers[0]?.id ?? "",
    roomId: replace?.roomId ?? activeRooms[0]?.id ?? "",
    startDate: replace ? replaceFrom : tomorrow,
    endDate: replace ? replace.endDate : toDateInput(addDays(new Date(), 60)),
    time: replace ? replace.localStartTime.slice(0, 5) : "18:00",
    duration: String(replace?.durationMinutes ?? 90),
    weekdays: replace?.weekdays ?? ["Monday", "Thursday"],
    excluded: [],
  }));
  const [requestId, setRequestId] = useState(() => newUuid());
  const [reason, setReason] = useState("");
  const [shortNotice, setShortNotice] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [preview, setPreview] = useState<SchedulePreview | null>(null);
  const [ownSessions, setOwnSessions] = useState<Set<string>>(new Set());
  const previewAction = useAction();
  const saveAction = useAction();

  function update(patch: Partial<ComposerState>) {
    setState((current) => ({ ...current, ...patch }));
    setPreview(null);
    setRequestId(newUuid()); // new content → new idempotency key
  }

  const span = Math.round((new Date(state.endDate).getTime() - new Date(state.startDate).getTime()) / 86400000);
  const duration = Number(state.duration);
  const errors = {
    resources: !state.classId || !state.teacherId || !state.roomId ? "Chọn đủ lớp, giáo viên và phòng đang hoạt động." : null,
    dates: !state.startDate || !state.endDate ? "Chọn khoảng ngày." : span < 0 ? "Ngày kết thúc phải sau ngày bắt đầu." : span > 179 ? "Một chuỗi tối đa 180 ngày." : null,
    weekdays: state.weekdays.length === 0 ? "Chọn ít nhất một thứ trong tuần." : null,
    duration: !Number.isInteger(duration) || duration < 15 || duration > 480 ? "Thời lượng 15–480 phút." : null,
    time: /^\d{2}:\d{2}$/.test(state.time) ? null : "Chọn giờ bắt đầu.",
    reason: replace && (!reason.trim() || reason.trim().length > 500) ? "Nhập lý do đổi lịch (1–500 ký tự); học sinh sẽ thấy lý do này." : null,
  };
  const invalid = Object.values(errors).some(Boolean);

  function input(): CreateScheduleSeriesInput {
    return {
      requestId,
      classId: state.classId,
      teacherId: state.teacherId,
      roomId: state.roomId,
      startDate: state.startDate,
      endDate: state.endDate,
      localStartTime: `${state.time}:00`,
      durationMinutes: duration,
      weekdays: weekdays.map((day) => day.value).filter((day) => state.weekdays.includes(day)),
      excludedDates: state.excluded
        .filter((date) => date >= state.startDate && date <= state.endDate && state.weekdays.includes(weekdayOf(date)))
        .sort(),
    };
  }

  async function runPreview() {
    if (invalid) return;
    const result = await previewAction.run(async () => {
      const value = await academicsApi.previewScheduleSeries(centerId, input());
      // When replacing, the old chain's own future sessions show up as class conflicts but will be released.
      if (replace) {
        const ids = new Set<string>();
        let cursor = new Date(localInputsToUtc(state.startDate, "00:00"));
        const end = addDays(new Date(localInputsToUtc(state.endDate, "00:00")), 1);
        while (cursor < end) {
          const next = addDays(cursor, 30) < end ? addDays(cursor, 30) : end;
          const sessions = await academicsApi.listSessions(centerId, cursor.toISOString(), next.toISOString());
          sessions.filter((item) => item.seriesId === replace.id && item.isActive).forEach((item) => ids.add(item.id));
          cursor = next;
        }
        setOwnSessions(ids);
      }
      return value;
    });
    if (result) setPreview(result);
  }

  const realConflicts = (occurrence: ScheduleOccurrence) =>
    occurrence.conflicts.filter((conflict) => !(conflict.existingSessionId && ownSessions.has(conflict.existingSessionId)));
  const conflicted = preview?.occurrences.filter((occurrence) => realConflicts(occurrence).length > 0) ?? [];

  function excludeConflicts() {
    const dates = conflicted.map((occurrence) => occurrence.occurrenceDate);
    update({ excluded: Array.from(new Set([...state.excluded, ...dates])) });
  }

  async function save() {
    if (replace) {
      if (errors.reason || (shortNotice && !acknowledged)) return;
      let needsConfirm = false;
      const result = await saveAction.run(() => askShortNotice(() =>
        academicsApi.replaceFutureScheduleSeries(centerId, replace.id, {
          fromDate: state.startDate, expectedVersion: replace.version, replacement: input(),
          reason: reason.trim(), acknowledgeShortNotice: acknowledged,
        }), () => { needsConfirm = true; }),
      );
      if (result) onDone(`Đã thay lịch từ ${formatDateOnly(state.startDate)}: hủy ${result.sessionsCancelled} buổi cũ, tạo ${result.replacement.sessionsCreated} buổi mới. Học sinh đã được báo.`);
      else if (needsConfirm) setShortNotice(true);
      return;
    }
    const result = await saveAction.run(() => academicsApi.createScheduleSeries(centerId, input()));
    if (result) onDone(result.replayed ? "Yêu cầu đã được xử lý trước đó; không tạo thêm buổi trùng." : `Đã tạo lịch lặp với ${result.sessionsCreated} buổi học.`);
  }


  return (
    <Dialog
      open
      size="lg"
      title={replace ? "Thay phần tương lai của lịch lặp" : "Tạo lịch lặp theo tuần"}
      description={replace ? "Các buổi của chuỗi cũ từ ngày áp dụng sẽ bị hủy và thay bằng chuỗi mới, trong cùng một giao dịch." : "Bước 1: điền quy tắc. Bước 2: xem trước từng buổi và xung đột. Bước 3: lưu."}
      onClose={onClose}
      onSubmit={() => (preview && conflicted.length === 0 ? void save() : void runPreview())}
      footer={
        <>
          <Button onClick={onClose} disabled={saveAction.pending}>Hủy</Button>
          <Button icon={<Eye aria-hidden="true" />} onClick={() => void runPreview()} pending={previewAction.pending} disabled={invalid}>{preview ? "Xem trước lại" : "Xem trước"}</Button>
          <Button type="submit" variant="primary" icon={<CalendarCheck2 aria-hidden="true" />} pending={saveAction.pending} disabled={!preview || conflicted.length > 0}>
            {replace ? "Thay lịch" : `Lưu ${preview ? preview.sessionCount : ""} buổi`}
          </Button>
        </>
      }
    >
      <div className="form-grid form-grid-3">
        <Field label="Lớp" required error={errors.resources}>
          {(id) => (
            <select id={id} value={state.classId} disabled={Boolean(replace)} onChange={(event) => update({ classId: event.target.value })}>
              {replace && !activeClasses.some((item) => item.id === replace.classId) && <option value={replace.classId}>{lookups.classById.get(replace.classId)?.name}</option>}
              {activeClasses.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="Giáo viên" required>
          {(id) => <select id={id} value={state.teacherId} onChange={(event) => update({ teacherId: event.target.value })}>{activeTeachers.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select>}
        </Field>
        <Field label="Phòng" required>
          {(id) => <select id={id} value={state.roomId} onChange={(event) => update({ roomId: event.target.value })}>{activeRooms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
        </Field>
        <Field label={replace ? "Áp dụng từ ngày" : "Từ ngày"} required error={errors.dates}>
          {(id) => <input id={id} type="date" value={state.startDate} min={replace ? (replace.startDate > today ? replace.startDate : today) : tomorrow} max={replace?.endDate} onChange={(event) => update({ startDate: event.target.value })} />}
        </Field>
        <Field label="Đến ngày" required hint="Tối đa 180 ngày.">
          {(id, describedBy) => <input id={id} aria-describedby={describedBy} type="date" value={state.endDate} min={state.startDate} onChange={(event) => update({ endDate: event.target.value })} />}
        </Field>
        <Field label="Giờ bắt đầu (giờ Việt Nam)" required error={errors.time}>
          {(id) => <input id={id} type="time" value={state.time} onChange={(event) => update({ time: event.target.value })} />}
        </Field>
        <Field label="Thời lượng (phút)" required error={errors.duration}>
          {(id) => <input id={id} type="number" min={15} max={480} step={5} value={state.duration} onChange={(event) => update({ duration: event.target.value })} />}
        </Field>
        <div className="field">
          <span className="field-label">Thứ trong tuần<span className="field-required" aria-hidden="true">*</span></span>
          <div className="weekday-picker" role="group" aria-label="Thứ trong tuần">
            {weekdays.map((day) => {
              const on = state.weekdays.includes(day.value);
              return (
                <button type="button" key={day.value} aria-pressed={on} className={on ? "active" : ""} title={day.label}
                  onClick={() => update({ weekdays: on ? state.weekdays.filter((value) => value !== day.value) : [...state.weekdays, day.value] })}>
                  {day.short}
                </button>
              );
            })}
          </div>
          {errors.weekdays && <p className="field-error">{errors.weekdays}</p>}
        </div>
      </div>

      {state.excluded.length > 0 && (
        <p className="excluded-line">
          Loại trừ {state.excluded.length} ngày: {state.excluded.sort().map(formatDateOnly).join(", ")}{" "}
          <button type="button" className="text-link" onClick={() => update({ excluded: [] })}>Bỏ loại trừ</button>
        </p>
      )}

      {replace && (
        <Field label="Lý do đổi lịch" required error={errors.reason}>
          {(id, describedBy) => <textarea id={id} aria-describedby={describedBy} rows={2} maxLength={500} value={reason} placeholder="Ví dụ: giáo viên đổi ca dạy" onChange={(event) => setReason(event.target.value)} />}
        </Field>
      )}
      {shortNotice && <ShortNoticeConfirm checked={acknowledged} onChange={setAcknowledged} />}
      <ErrorNotice error={previewAction.error} />
      <ErrorNotice error={saveAction.error} onReload={() => void runPreview()} />

      {preview && (
        <section className="preview" aria-live="polite">
          <header>
            <strong>{preview.sessionCount} buổi sẽ được tạo</strong>
            {conflicted.length > 0 ? (
              <>
                <Badge tone="danger" icon={<AlertTriangle aria-hidden="true" />}>{conflicted.length} buổi xung đột</Badge>
                <Button size="sm" onClick={excludeConflicts}>Loại các ngày xung đột</Button>
              </>
            ) : (
              <Badge tone="success" icon={<CheckCircle2 aria-hidden="true" />}>Không có xung đột</Badge>
            )}
          </header>
          <ol className="preview-list">
            {preview.occurrences.map((occurrence) => {
              const conflicts = realConflicts(occurrence);
              return (
                <li key={occurrence.occurrenceDate} className={conflicts.length ? "has-conflict" : ""}>
                  <span>{formatWeekday(occurrence.startUtc, true)} {formatDateOnly(occurrence.occurrenceDate)}</span>
                  <span>{formatTimeRange(occurrence.startUtc, occurrence.endUtc)}</span>
                  <span>{conflicts.length ? Array.from(new Set(conflicts.map((conflict) => conflictLabels[conflict.resourceType] ?? conflict.resourceType))).join(" · ") : "Trống lịch"}</span>
                  <button type="button" className="text-link" onClick={() => update({ excluded: [...state.excluded, occurrence.occurrenceDate] })}>Bỏ ngày này</button>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </Dialog>
  );
}

/** Runs a series change; a 422 schedule_short_notice asks for confirmation instead of showing an error. */
async function askShortNotice<T>(call: () => Promise<T>, onShortNotice: () => void): Promise<T | undefined> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof ApiError && error.hasCode("schedule_short_notice")) {
      onShortNotice();
      return undefined;
    }
    throw error;
  }
}

/** B6: changing a recurring schedule less than 7 days ahead is allowed but must be confirmed and is flagged urgent. */
function ShortNoticeConfirm({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <Notice tone="warning" title="Báo trước chưa đủ 7 ngày">
      Buổi đầu tiên bị ảnh hưởng diễn ra trong chưa đầy 7 ngày. Học sinh sẽ nhận thông báo gắn nhãn “Báo gấp”.
      <label className="check-line">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        Tôi xác nhận đổi lịch với thời gian báo trước ngắn
      </label>
    </Notice>
  );
}
