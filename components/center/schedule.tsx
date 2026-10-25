"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Ban, CalendarClock, CalendarPlus, CalendarRange, ChevronLeft, ChevronRight, ClipboardCheck, History, MoveRight, RefreshCcw, Undo2, XCircle } from "lucide-react";
import { academicsApi, type TeachingSession } from "@/lib/api";
import { useAction, useResource } from "@/lib/hooks/use-resource";
import { useNow } from "@/lib/hooks/use-now";
import { useCenterLookups, type CenterLookups } from "@/lib/hooks/use-lookups";
import {
  addDays,
  addMinutesUtc,
  formatDate,
  formatDayMonth,
  formatDuration,
  formatTimeRange,
  formatDateTime,
  formatSlot,
  formatWeekday,
  isSameLocalDay,
  localInputsToUtc,
  minutesBetween,
  startOfWeek,
  toDateInput,
  toTimeInput,
} from "@/lib/format";
import { Badge, Button, ButtonLink, Dialog, EmptyState, ErrorNotice, Field, Notice, PageHeader, Panel, Segmented, SkeletonRows, Toggle } from "@/components/ui/primitives";
import { ReasonDialog } from "@/components/ui/reason-dialog";
import { changeKindLabels } from "@/lib/labels";
import { useCenter } from "./center-frame";
import { ScheduleTabs } from "./schedule-tabs";
import { DropRescheduleDialog, ScheduleWeekGrid, type DropRequest } from "./schedule-grid";
import { ImpactSummary } from "./session-impact";

type ScheduleView = "list" | "grid";
const VIEW_KEY = "schedule.view";

/** Grid on wide screens with a mouse (drag and drop needs one); the list elsewhere. Remembered per browser. */
function initialView(): ScheduleView {
  if (typeof window === "undefined") return "list";
  try {
    const saved = window.localStorage.getItem(VIEW_KEY);
    if (saved === "list" || saved === "grid") return saved;
  } catch { /* storage blocked */ }
  return window.matchMedia("(min-width: 861px) and (pointer: fine)").matches ? "grid" : "list";
}

export function ScheduleWorkspace() {
  const { centerId, canManage } = useCenter();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [classFilter, setClassFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [roomFilter, setRoomFilter] = useState("");
  const [showCancelled, setShowCancelled] = useState(true);
  const [editor, setEditor] = useState<
    { mode: "create" } | { mode: "reschedule"; session: TeachingSession } | { mode: "makeup"; session: TeachingSession } | null
  >(null);
  const [statusChange, setStatusChange] = useState<{ kind: "cancel" | "notHeld"; session: TeachingSession } | null>(null);
  const [history, setHistory] = useState<TeachingSession | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [view, setViewState] = useState<ScheduleView>("list");
  const [detail, setDetail] = useState<TeachingSession | null>(null);
  const [drop, setDrop] = useState<DropRequest | null>(null);
  useEffect(() => {
    // Read the browser's preference after hydration so server and client render the same first frame.
    const timer = window.setTimeout(() => setViewState(initialView()), 0);
    return () => window.clearTimeout(timer);
  }, []);
  function setView(next: ScheduleView) {
    setViewState(next);
    try { window.localStorage.setItem(VIEW_KEY, next); } catch { /* storage blocked */ }
  }

  const lookups = useCenterLookups(centerId);
  const now = useNow();
  const weekEnd = addDays(weekStart, 7);
  const sessions = useResource(
    () => academicsApi.listSessions(centerId, weekStart.toISOString(), weekEnd.toISOString()),
    [centerId, weekStart.getTime()],
  );

  const filtered = useMemo(
    () =>
      (sessions.data ?? [])
        .filter((item) => showCancelled || item.isActive)
        .filter((item) => !classFilter || item.classId === classFilter)
        .filter((item) => !teacherFilter || item.teacherId === teacherFilter)
        .filter((item) => !roomFilter || item.roomId === roomFilter)
        .sort((a, b) => a.startUtc.localeCompare(b.startUtc)),
    [sessions.data, showCancelled, classFilter, teacherFilter, roomFilter],
  );

  const madeUp = useMemo(
    () => new Set((sessions.data ?? []).filter((item) => item.isActive && item.makeupForSessionId).map((item) => item.makeupForSessionId as string)),
    [sessions.data],
  );
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const today = new Date(now);
  const lk = lookups.data;

  return (
    <>
      <PageHeader
        title="Lịch dạy"
        description="Mỗi buổi gắn một lớp, một giáo viên và một phòng; hệ thống chặn trùng lịch cho cả ba. Lịch lặp sinh nhiều buổi cùng lúc theo thứ trong tuần."
        meta={<ScheduleTabs centerId={centerId} />}
        actions={
          canManage && (
            <>
              <ButtonLink href={`/centers/${centerId}/schedule/series?new=1`} icon={<CalendarRange aria-hidden="true" />}>Tạo lịch lặp</ButtonLink>
              <Button variant="primary" icon={<CalendarPlus aria-hidden="true" />} onClick={() => setEditor({ mode: "create" })} disabled={!lk}>Thêm buổi lẻ</Button>
            </>
          )
        }
      />
      {notice && <Notice tone="success" onDismiss={() => setNotice(null)}>{notice}</Notice>}
      <ErrorNotice error={sessions.error ?? lookups.error} onReload={() => { void sessions.reload(); void lookups.reload(); }} />

      <Panel flush>
        <div className="toolbar">
          <div className="week-nav">
            <Button size="sm" icon={<ChevronLeft aria-hidden="true" />} onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Tuần trước" />
            <strong>{formatDate(weekStart)} – {formatDate(addDays(weekStart, 6))}</strong>
            <Button size="sm" icon={<ChevronRight aria-hidden="true" />} onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Tuần sau" />
            <Button size="sm" variant="ghost" onClick={() => setWeekStart(startOfWeek(new Date()))}>Tuần này</Button>
          </div>
          <label className="select-inline"><span>Lớp</span>
            <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
              <option value="">Tất cả</option>
              {lk?.classes.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
            </select>
          </label>
          <label className="select-inline"><span>Giáo viên</span>
            <select value={teacherFilter} onChange={(event) => setTeacherFilter(event.target.value)}>
              <option value="">Tất cả</option>
              {lk?.teachers.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
            </select>
          </label>
          <label className="select-inline"><span>Phòng</span>
            <select value={roomFilter} onChange={(event) => setRoomFilter(event.target.value)}>
              <option value="">Tất cả</option>
              {lk?.rooms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <Toggle checked={showCancelled} onChange={setShowCancelled} label="Hiện buổi đã hủy / không diễn ra" />
          <Segmented label="Kiểu xem" value={view} onChange={setView} options={[{ value: "grid", label: "Lưới giờ" }, { value: "list", label: "Danh sách" }]} />
          <Button size="sm" variant="ghost" icon={<RefreshCcw aria-hidden="true" />} onClick={() => void sessions.reload()} pending={sessions.loading && Boolean(sessions.data)}>Làm mới</Button>
        </div>

        {!sessions.data || !lk ? (
          <SkeletonRows rows={7} columns={5} />
        ) : view === "grid" ? (
          <>
            {canManage && <p className="week-grid-hint">Kéo một buổi chưa diễn ra sang ô trống trong tuần để dời lịch (bước 30 phút). Ô đỏ: lớp, giáo viên hoặc phòng đã bận; ô vàng: học sinh hoặc giáo viên có lịch khác — vẫn dời được sau khi xác nhận. Bấm vào buổi để xem thao tác.</p>}
            <ScheduleWeekGrid
              centerId={centerId}
              weekStart={weekStart}
              sessions={filtered}
              allSessions={sessions.data}
              lookups={lk}
              now={now}
              canManage={canManage}
              onOpen={setDetail}
              onDrop={setDrop}
            />
          </>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<CalendarClock aria-hidden="true" />} title="Không có buổi học trong tuần này">
            {canManage ? "Thêm buổi lẻ, hoặc tạo lịch lặp theo tuần để sinh nhiều buổi cùng lúc." : "Thử tuần khác hoặc bỏ bớt bộ lọc."}
          </EmptyState>
        ) : (
          <div className="timetable">
            {days.map((day) => {
              const items = filtered.filter((session) => isSameLocalDay(new Date(session.startUtc), day));
              return (
                <section key={day.toISOString()} className={`timetable-day${isSameLocalDay(day, today) ? " is-today" : ""}`}>
                  <h3><span>{formatWeekday(day)}</span><small>{formatDayMonth(day)}</small></h3>
                  {items.length === 0 ? (
                    <p className="timetable-empty">Không có buổi</p>
                  ) : (
                    <ul>
                      {items.map((session) => (
                        <SessionRow
                          key={session.id}
                          session={session}
                          lookups={lk}
                          canManage={canManage}
                          centerId={centerId}
                          now={now}
                          hasMakeup={madeUp.has(session.id)}
                          onReschedule={() => setEditor({ mode: "reschedule", session })}
                          onCancel={() => setStatusChange({ kind: "cancel", session })}
                          onNotHeld={() => setStatusChange({ kind: "notHeld", session })}
                          onMakeup={() => setEditor({ mode: "makeup", session })}
                          onHistory={() => setHistory(session)}
                        />
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </Panel>

      {editor && lk && (
        <SessionEditor
          lookups={lk}
          session={editor.mode === "reschedule" ? editor.session : undefined}
          makeupFor={editor.mode === "makeup" ? editor.session : undefined}
          defaultDate={weekStart.getTime() > now ? weekStart : new Date(now)}
          onClose={() => setEditor(null)}
          onStale={() => void sessions.reload()}
          onSaved={(saved, created) => {
            setEditor(null);
            setNotice(editor.mode === "makeup" ? "Đã xếp buổi học bù." : created ? "Đã thêm buổi học." : "Đã dời lịch buổi học.");
            setWeekStart(startOfWeek(new Date(saved.startUtc)));
            void sessions.reload();
          }}
        />
      )}

      <ReasonDialog
        open={Boolean(statusChange)}
        title={statusChange?.kind === "notHeld" ? "Ghi nhận buổi không diễn ra?" : "Hủy buổi học?"}
        confirmLabel={statusChange?.kind === "notHeld" ? "Ghi nhận không diễn ra" : "Hủy buổi học"}
        variant="danger"
        maxLength={500}
        placeholder={statusChange?.kind === "notHeld" ? "Ví dụ: mất điện, giáo viên ốm đột xuất…" : "Ví dụ: nghỉ lễ, giáo viên bận…"}
        onClose={() => setStatusChange(null)}
        onConfirm={async (reason) => {
          if (!statusChange) return;
          const { kind, session } = statusChange;
          if (kind === "notHeld") await academicsApi.markSessionNotHeld(centerId, session.id, session.version, reason);
          else await academicsApi.cancelSession(centerId, session.id, session.version, reason);
          setNotice(kind === "notHeld"
            ? "Đã ghi nhận buổi không diễn ra và báo cho học sinh. Có thể xếp buổi học bù ngay trên lịch."
            : "Đã hủy buổi học và báo cho học sinh (trong ứng dụng và qua email). Buổi vẫn hiện trong lịch kèm lý do.");
          await sessions.reload();
        }}
      >
        {statusChange && lk && (
          <p>
            {lk.classById.get(statusChange.session.classId)?.name} · {formatWeekday(statusChange.session.startUtc)} {formatDayMonth(statusChange.session.startUtc)} {formatTimeRange(statusChange.session.startUtc, statusChange.session.endUtc)}.
            {" "}{statusChange.kind === "notHeld"
              ? "Dùng khi buổi đã tới giờ nhưng không học. Buổi phải chưa có phiếu điểm danh. Lý do hiển thị cho học sinh và giáo viên."
              : "Chỉ hủy được buổi chưa bắt đầu và chưa có phiếu điểm danh. Lý do hiển thị cho học sinh và giáo viên."}
          </p>
        )}
        {statusChange?.kind === "cancel" && (
          <ImpactSummary centerId={centerId} classId={statusChange.session.classId} startUtc={statusChange.session.startUtc}
            endUtc={statusChange.session.endUtc} sessionId={statusChange.session.id} cancelling />
        )}
      </ReasonDialog>

      {detail && lk && (
        <Dialog open size="lg" title={detail.className ?? lk.classById.get(detail.classId)?.name ?? "Buổi học"} description={`${formatWeekday(detail.startUtc)} ${formatDayMonth(detail.startUtc)} · ${formatTimeRange(detail.startUtc, detail.endUtc)}`}
          onClose={() => setDetail(null)} footer={<Button onClick={() => setDetail(null)}>Đóng</Button>}>
          <div className="timetable timetable-single">
            <section className="timetable-day">
              <ul>
                <SessionRow
                  session={detail}
                  lookups={lk}
                  canManage={canManage}
                  centerId={centerId}
                  now={now}
                  hasMakeup={madeUp.has(detail.id)}
                  onReschedule={() => { setDetail(null); setEditor({ mode: "reschedule", session: detail }); }}
                  onCancel={() => { setDetail(null); setStatusChange({ kind: "cancel", session: detail }); }}
                  onNotHeld={() => { setDetail(null); setStatusChange({ kind: "notHeld", session: detail }); }}
                  onMakeup={() => { setDetail(null); setEditor({ mode: "makeup", session: detail }); }}
                  onHistory={() => { setDetail(null); setHistory(detail); }}
                />
              </ul>
            </section>
          </div>
        </Dialog>
      )}

      {drop && lk && (
        <DropRescheduleDialog
          centerId={centerId}
          request={drop}
          lookups={lk}
          onClose={() => setDrop(null)}
          onStale={() => { setDrop(null); void sessions.reload(); }}
          onSaved={(saved) => {
            setDrop(null);
            setNotice(`Đã dời buổi sang ${formatWeekday(saved.startUtc).toLowerCase()} ${formatDayMonth(saved.startUtc)} ${formatTimeRange(saved.startUtc, saved.endUtc)} và báo cho học sinh.`);
            void sessions.reload();
          }}
        />
      )}

      {history && <SessionHistoryDialog centerId={centerId} session={history} onClose={() => setHistory(null)} />}
    </>
  );
}

function SessionRow({ session, lookups, canManage, centerId, now, hasMakeup, onReschedule, onCancel, onNotHeld, onMakeup, onHistory }: { session: TeachingSession; lookups: CenterLookups; canManage: boolean; centerId: string; now: number; hasMakeup: boolean; onReschedule: () => void; onCancel: () => void; onNotHeld: () => void; onMakeup: () => void; onHistory: () => void }) {
  const teachingClass = lookups.classById.get(session.classId);
  const started = new Date(session.startUtc).getTime() <= now;
  const notHeld = session.status === "NotHeld";
  const reason = notHeld ? session.notHeldReason : !session.isActive ? session.cancellationReason : session.isRescheduled ? session.rescheduleReason : null;
  return (
    <li className={session.isActive ? "" : "is-cancelled"}>
      <time>{formatTimeRange(session.startUtc, session.endUtc)}<small>{formatDuration(minutesBetween(session.startUtc, session.endUtc))}</small></time>
      <div className="timetable-main">
        <strong>{teachingClass ? <Link href={`/centers/${centerId}/classes/${teachingClass.id}`}>{teachingClass.name}</Link> : session.className ?? "Lớp không xác định"}</strong>
        <span>{session.classCode ?? teachingClass?.code} · {session.teacherName ?? lookups.teacherById.get(session.teacherId)?.fullName ?? "—"} · {session.roomName ?? lookups.roomById.get(session.roomId)?.name ?? "—"}</span>
        {session.isActive && session.previousStartUtc && session.previousEndUtc && (
          <span className="timetable-reason">Đã dời từ {formatSlot(session.previousStartUtc, session.previousEndUtc)}</span>
        )}
        {reason && <span className="timetable-reason">Lý do: {reason}</span>}
      </div>
      <div className="timetable-tags">
        {notHeld && <Badge tone="warning">Không diễn ra</Badge>}
        {!session.isActive && !notHeld && <Badge tone="danger">Đã hủy</Badge>}
        {session.isRescheduled && session.isActive && <Badge tone="info">Đã dời</Badge>}
        {session.makeupForSessionId && <Badge tone="brand">Học bù</Badge>}
        {session.seriesId && <Badge tone="neutral">Lịch lặp</Badge>}
        {(session.isRescheduled || !session.isActive || session.makeupForSessionId) && (
          <button type="button" className="icon-button" onClick={onHistory} aria-label="Lịch sử thay đổi" title="Lịch sử thay đổi"><History aria-hidden="true" /></button>
        )}
      </div>
      {canManage && !session.isActive && !hasMakeup && (
        <div className="timetable-actions">
          <Button size="sm" variant="ghost" icon={<Undo2 aria-hidden="true" />} onClick={onMakeup}>Xếp buổi bù</Button>
        </div>
      )}
      {canManage && session.isActive && (
        <div className="timetable-actions">
          {started ? (
            <>
              <ButtonLink size="sm" href={`/centers/${centerId}/attendance?session=${session.id}`} icon={<ClipboardCheck aria-hidden="true" />}>Điểm danh</ButtonLink>
              <Button size="sm" variant="ghost" icon={<Ban aria-hidden="true" />} onClick={onNotHeld}>Không diễn ra</Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" icon={<MoveRight aria-hidden="true" />} onClick={onReschedule}>Dời lịch</Button>
              <Button size="sm" variant="ghost" icon={<XCircle aria-hidden="true" />} onClick={onCancel}>Hủy</Button>
            </>
          )}
        </div>
      )}
    </li>
  );
}

function SessionEditor({ lookups, session, makeupFor, defaultDate, onClose, onSaved, onStale }: { lookups: CenterLookups; session?: TeachingSession; makeupFor?: TeachingSession; defaultDate: Date; onClose: () => void; onSaved: (saved: TeachingSession, created: boolean) => void; onStale: () => void }) {
  const { centerId } = useCenter();
  const activeClasses = lookups.classes.filter((item) => item.isActive);
  const activeTeachers = lookups.teachers.filter((item) => item.isActive);
  const activeRooms = lookups.rooms.filter((item) => item.isActive);
  const now = useNow();
  const [initialStart] = useState(() => {
    if (session) return new Date(session.startUtc);
    // 18:00 Vietnam time on the default day, or the next day if that has passed.
    let date = new Date(localInputsToUtc(toDateInput(defaultDate), "18:00"));
    if (date.getTime() <= Date.now()) date = new Date(date.getTime() + 24 * 3600 * 1000);
    return date;
  });

  const base = session ?? makeupFor;
  const [classId, setClassId] = useState(base?.classId ?? activeClasses[0]?.id ?? "");
  const [teacherId, setTeacherId] = useState(base?.teacherId ?? activeTeachers[0]?.id ?? "");
  const [roomId, setRoomId] = useState(base?.roomId ?? activeRooms[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(toDateInput(initialStart));
  const [time, setTime] = useState(toTimeInput(initialStart));
  const [duration, setDuration] = useState(String(base ? minutesBetween(base.startUtc, base.endUtc) : 90));
  const [touched, setTouched] = useState(false);
  const action = useAction();

  const minutes = Number(duration);
  const startUtc = date && time ? localInputsToUtc(date, time) : "";
  const errors = {
    classId: classId ? null : "Chọn lớp đang hoạt động.",
    teacherId: teacherId ? null : "Chọn giáo viên đang hoạt động.",
    roomId: roomId ? null : "Chọn phòng đang hoạt động.",
    when: !startUtc ? "Chọn ngày và giờ bắt đầu." : new Date(startUtc).getTime() <= now ? "Giờ bắt đầu phải ở tương lai." : null,
    duration: !Number.isInteger(minutes) || minutes < 15 || minutes > 480 ? "Thời lượng từ 15 đến 480 phút." : null,
    reason: session && (!reason.trim() || reason.trim().length > 500) ? "Nhập lý do dời lịch (1–500 ký tự)." : null,
  };
  const invalid = Object.values(errors).some(Boolean);

  async function submit() {
    setTouched(true);
    if (invalid) return;
    const endUtc = addMinutesUtc(startUtc, minutes);
    const saved = await action.run(() =>
      session
        ? academicsApi.rescheduleSession(centerId, session.id, { teacherId, roomId, startUtc, endUtc, expectedVersion: session.version, reason: reason.trim() })
        : academicsApi.createSession(centerId, { classId, teacherId, roomId, startUtc, endUtc, makeupForSessionId: makeupFor?.id ?? null }),
    );
    if (saved) onSaved(saved, !session);
  }

  return (
    <Dialog
      open
      title={session ? "Dời lịch buổi học" : makeupFor ? "Xếp buổi học bù" : "Thêm buổi học lẻ"}
      description={session
        ? "Có thể đổi giáo viên, phòng và thời gian; lớp giữ nguyên. Lý do hiển thị cho học sinh và giáo viên."
        : makeupFor
          ? `Bù cho buổi ${formatWeekday(makeupFor.startUtc).toLowerCase()} ${formatDayMonth(makeupFor.startUtc)} ${formatTimeRange(makeupFor.startUtc, makeupFor.endUtc)}. Mỗi buổi chỉ có một buổi bù.`
          : "Giờ nhập theo giờ Việt Nam."}
      onClose={onClose}
      onSubmit={submit}
      footer={<><Button onClick={onClose} disabled={action.pending}>Đóng</Button><Button type="submit" variant="primary" pending={action.pending}>{session ? "Dời lịch" : makeupFor ? "Xếp buổi bù" : "Thêm buổi"}</Button></>}
    >
      <div className="form-grid">
        <Field label="Lớp" required error={touched ? errors.classId : null} className="span-2">
          {(id) => (
            <select id={id} value={classId} disabled={Boolean(base)} onChange={(event) => setClassId(event.target.value)}>
              {base && !activeClasses.some((item) => item.id === base.classId) && <option value={base.classId}>{lookups.classById.get(base.classId)?.name ?? "Lớp hiện tại"}</option>}
              {activeClasses.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="Giáo viên" required error={touched ? errors.teacherId : null}>
          {(id) => (
            <select id={id} value={teacherId} onChange={(event) => setTeacherId(event.target.value)}>
              {activeTeachers.map((item) => <option key={item.id} value={item.id}>{item.fullName} · {item.code}</option>)}
            </select>
          )}
        </Field>
        <Field label="Phòng" required error={touched ? errors.roomId : null}>
          {(id) => (
            <select id={id} value={roomId} onChange={(event) => setRoomId(event.target.value)}>
              {activeRooms.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}
            </select>
          )}
        </Field>
        <Field label="Ngày" required error={touched ? errors.when : null}>
          {(id) => <input id={id} type="date" value={date} min={toDateInput(new Date(now))} onChange={(event) => setDate(event.target.value)} />}
        </Field>
        <Field label="Giờ bắt đầu" required>
          {(id) => <input id={id} type="time" value={time} onChange={(event) => setTime(event.target.value)} />}
        </Field>
        <Field label="Thời lượng (phút)" required hint="15 phút đến 8 giờ." error={touched ? errors.duration : null}>
          {(id, describedBy) => <input id={id} aria-describedby={describedBy} type="number" min={15} max={480} step={5} value={duration} onChange={(event) => setDuration(event.target.value)} />}
        </Field>
        {session && (
          <Field label="Lý do dời lịch" required error={touched ? errors.reason : null} className="span-2">
            {(id, describedBy) => <textarea id={id} aria-describedby={describedBy} rows={2} maxLength={500} value={reason} placeholder="Ví dụ: giáo viên bận việc đột xuất" onChange={(event) => setReason(event.target.value)} />}
          </Field>
        )}
      </div>
      {classId && startUtc && !errors.when && !errors.duration && (
        <ImpactSummary centerId={centerId} classId={classId} startUtc={startUtc} endUtc={addMinutesUtc(startUtc, minutes)} sessionId={session?.id} teacherId={teacherId || undefined} />
      )}
      <ErrorNotice error={action.error} onReload={onStale} />
    </Dialog>
  );
}

/** B6: old and new time, reason, who and when for one session. */
function SessionHistoryDialog({ centerId, session, onClose }: { centerId: string; session: TeachingSession; onClose: () => void }) {
  const changes = useResource(() => academicsApi.sessionChanges(centerId, session.id), [centerId, session.id]);
  return (
    <Dialog open size="md" title="Lịch sử thay đổi buổi học" description={`${session.className ?? "Buổi học"} · ${formatSlot(session.startUtc, session.endUtc)}`} onClose={onClose}
      footer={<Button onClick={onClose}>Đóng</Button>}>
      <ErrorNotice error={changes.error} onReload={() => void changes.reload()} />
      {!changes.data ? <SkeletonRows rows={2} columns={2} /> : changes.data.length === 0 ? (
        <p className="cell-note">Chưa có thay đổi nào được ghi lại cho buổi này (thay đổi trước khi có nhật ký không hiện ở đây).</p>
      ) : (
        <ol className="history-list">
          {changes.data.map((item) => (
            <li key={item.id}>
              <strong>{changeKindLabels[item.kind] ?? item.kind}</strong>{item.isUrgent && <> <Badge tone="danger">Báo gấp</Badge></>}
              {item.oldStartUtc && item.oldEndUtc && item.newStartUtc && item.newEndUtc && (
                <p>{formatSlot(item.oldStartUtc, item.oldEndUtc)} → {formatSlot(item.newStartUtc, item.newEndUtc)}</p>
              )}
              {item.oldTeacherName && item.newTeacherName && item.oldTeacherName !== item.newTeacherName && <p>Giáo viên: {item.oldTeacherName} → {item.newTeacherName}</p>}
              {item.oldRoomName && item.newRoomName && item.oldRoomName !== item.newRoomName && <p>Phòng: {item.oldRoomName} → {item.newRoomName}</p>}
              {item.reason && <p>Lý do: {item.reason}</p>}
              <p className="cell-note">{formatDateTime(item.createdAtUtc)}{item.actorName ? ` · ${item.actorName}` : ""}</p>
            </li>
          ))}
        </ol>
      )}
    </Dialog>
  );
}
