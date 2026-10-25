"use client";

import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { ArrowRight, GripVertical } from "lucide-react";
import { academicsApi, type SessionImpact, type TeachingSession } from "@/lib/api";
import { useAction } from "@/lib/hooks/use-resource";
import type { CenterLookups } from "@/lib/hooks/use-lookups";
import { addDays, formatDayMonth, formatSlot, formatTimeRange, formatWeekday, isSameLocalDay } from "@/lib/format";
import { Button, Dialog, ErrorNotice, Field } from "@/components/ui/primitives";
import { hasImpactClash, ImpactSummary } from "./session-impact";

/** Grid step: drops snap to 30 minutes (chốt 23/10). */
const STEP = 30;
const ROW_PX = 30;
const DAY_MS = 24 * 3600 * 1000;
const VIETNAM_OFFSET_MS = 7 * 3600 * 1000;

/** Minutes after Vietnam midnight of the day the instant falls in. */
function localMinutes(iso: string) {
  const shifted = new Date(new Date(iso).getTime() + VIETNAM_OFFSET_MS);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

function dayIndexOf(iso: string, weekStart: Date) {
  return Math.floor((new Date(iso).getTime() - weekStart.getTime()) / DAY_MS);
}

function clock(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Half-open overlap, like the server's exclusion constraints: touching end/start is not a clash. */
function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && aEnd > bStart;
}

export function isMovable(session: TeachingSession, now: number) {
  return session.isActive && new Date(session.startUtc).getTime() > now;
}

interface Placed { session: TeachingSession; day: number; top: number; height: number; lane: number; lanes: number }

/** Sessions of one day side by side when they overlap (e.g. two rooms at once). */
function placeDay(items: Array<{ session: TeachingSession; start: number; end: number }>, day: number, from: number): Placed[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const placed: Placed[] = [];
  let cluster: Array<{ item: (typeof sorted)[number]; lane: number }> = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((x) => x.lane + 1));
    for (const { item, lane } of cluster) {
      placed.push({ session: item.session, day, lane, lanes, top: ((item.start - from) / STEP) * ROW_PX, height: Math.max(ROW_PX, ((item.end - item.start) / STEP) * ROW_PX) });
    }
    cluster = [];
  };
  for (const item of sorted) {
    if (cluster.length > 0 && item.start >= clusterEnd) { flush(); clusterEnd = -1; }
    const laneEnds: number[] = [];
    for (const x of cluster) laneEnds[x.lane] = Math.max(laneEnds[x.lane] ?? -1, x.item.end);
    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane < 0) lane = laneEnds.length;
    cluster.push({ item, lane });
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  if (cluster.length > 0) flush();
  return placed;
}

type Verdict =
  | { tone: "blocked"; lines: string[] }
  | { tone: "checking" }
  | { tone: "warning"; lines: string[] }
  | { tone: "free" };

interface Target { day: number; start: number }

export interface DropRequest { session: TeachingSession; startUtc: string; endUtc: string }

/**
 * Week grid Mon–Sun in Vietnam time. A session that has not started can be dragged to another free slot of the
 * visible week; while dragging the slot shows red (class, teacher or room already busy, in the past, past midnight),
 * yellow (students or the teacher have lessons elsewhere then — allowed after confirming) or green.
 */
export function ScheduleWeekGrid({ centerId, weekStart, sessions, allSessions, lookups, now, canManage, onOpen, onDrop }: {
  centerId: string;
  weekStart: Date;
  /** What the filters show. */
  sessions: TeachingSession[];
  /** Every session of the week, for conflict checks regardless of filters. */
  allSessions: TeachingSession[];
  lookups: CenterLookups;
  now: number;
  canManage: boolean;
  onOpen: (session: TeachingSession) => void;
  onDrop: (request: DropRequest) => void;
}) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const today = new Date(now);

  const { from, to } = useMemo(() => {
    let first = 6 * 60;
    let last = 22 * 60;
    for (const item of sessions) {
      const start = localMinutes(item.startUtc);
      const length = (new Date(item.endUtc).getTime() - new Date(item.startUtc).getTime()) / 60000;
      first = Math.min(first, Math.floor(start / 60) * 60);
      last = Math.max(last, Math.min(24 * 60, Math.ceil((start + length) / 60) * 60));
    }
    return { from: first, to: last };
  }, [sessions]);
  const rows = (to - from) / STEP;

  const placed = useMemo(() => {
    const byDay = new Map<number, Array<{ session: TeachingSession; start: number; end: number }>>();
    for (const session of sessions) {
      const day = dayIndexOf(session.startUtc, weekStart);
      if (day < 0 || day > 6) continue;
      const start = localMinutes(session.startUtc);
      const end = Math.min(24 * 60, start + (new Date(session.endUtc).getTime() - new Date(session.startUtc).getTime()) / 60000);
      byDay.set(day, [...(byDay.get(day) ?? []), { session, start, end }]);
    }
    return [...byDay.entries()].flatMap(([day, items]) => placeDay(items, day, from));
  }, [sessions, weekStart, from]);

  const [drag, setDrag] = useState<{ session: TeachingSession; grab: number; length: number } | null>(null);
  const [target, setTarget] = useState<Target | null>(null);

  const targetRange = useCallback((t: Target, length: number) => {
    const startMs = weekStart.getTime() + t.day * DAY_MS + t.start * 60000;
    return { startMs, endMs: startMs + length * 60000 };
  }, [weekStart]);

  // Red: what the server would refuse with schedule_conflict — checked against every active session of the week.
  const hardVerdict = useCallback((t: Target, session: TeachingSession, length: number): string[] => {
    const lines: string[] = [];
    const { startMs, endMs } = targetRange(t, length);
    if (t.start + length > 24 * 60) lines.push("Buổi học kéo qua nửa đêm — chọn giờ sớm hơn.");
    if (startMs <= now) lines.push("Giờ này đã qua.");
    for (const other of allSessions) {
      if (other.id === session.id || !other.isActive) continue;
      const oStart = new Date(other.startUtc).getTime();
      const oEnd = new Date(other.endUtc).getTime();
      if (!overlaps(startMs, endMs, oStart, oEnd)) continue;
      const label = `${other.classCode ?? lookups.classById.get(other.classId)?.code ?? "Lớp"} ${formatTimeRange(other.startUtc, other.endUtc)}`;
      if (other.classId === session.classId) lines.push(`Lớp đã có buổi ${formatTimeRange(other.startUtc, other.endUtc)}.`);
      if (other.teacherId === session.teacherId) lines.push(`Giáo viên đã bận (${other.teacherName ?? lookups.teacherById.get(other.teacherId)?.fullName ?? "—"}): ${label}.`);
      if (other.roomId === session.roomId) lines.push(`Phòng đã bận (${other.roomName ?? lookups.roomById.get(other.roomId)?.name ?? "—"}): ${label}.`);
    }
    return lines;
  }, [allSessions, lookups, now, targetRange]);

  // Yellow: students' other lessons and the teacher at other centers, from the server (debounced, cached per slot).
  // Cached per slot; forgotten whenever the week's sessions reload (a move may have changed who is busy).
  const [impactCache, setImpactCache] = useState<{ source: TeachingSession[]; byKey: Record<string, SessionImpact | "error"> }>({ source: allSessions, byKey: {} });
  const impacts = impactCache.source === allSessions ? impactCache.byKey : {};
  const remember = useCallback((key: string, value: SessionImpact | "error") => setImpactCache((current) => ({
    source: allSessions,
    byKey: { ...(current.source === allSessions ? current.byKey : {}), [key]: value },
  })), [allSessions]);
  const targetKey = drag && target ? `${drag.session.id}|${target.day}|${target.start}` : "";
  const hard = drag && target ? hardVerdict(target, drag.session, drag.length) : [];
  useEffect(() => {
    if (!drag || !target || hard.length > 0 || impacts[targetKey]) return;
    const key = targetKey;
    const { startMs, endMs } = targetRange(target, drag.length);
    const timer = window.setTimeout(() => {
      academicsApi.sessionImpact(centerId, {
        classId: drag.session.classId,
        startUtc: new Date(startMs).toISOString(),
        endUtc: new Date(endMs).toISOString(),
        sessionId: drag.session.id,
        teacherId: drag.session.teacherId,
      }).then(
        (result) => remember(key, result),
        () => remember(key, "error"),
      );
    }, 220);
    return () => window.clearTimeout(timer);
    // `hard` is derived from drag/target; listing it would re-run on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, centerId, targetRange, remember]);

  let verdict: Verdict | null = null;
  if (drag && target) {
    if (hard.length > 0) verdict = { tone: "blocked", lines: hard };
    else {
      const impact = impacts[targetKey];
      if (!impact) verdict = { tone: "checking" };
      else if (impact === "error") verdict = { tone: "free" };
      else if (hasImpactClash(impact)) {
        const lines: string[] = [];
        const students = new Set(impact.sameCenterConflicts.map((x) => x.studentId)).size;
        if (students > 0) lines.push(`${students} học sinh có lớp khác của trung tâm giờ này.`);
        if (impact.otherCenterConflictStudentCount > 0) lines.push(`${impact.otherCenterConflictStudentCount} học sinh có lịch ở nơi khác.`);
        if ((impact.teacherSessionsElsewhere ?? 0) > 0) lines.push("Giáo viên có buổi dạy ở trung tâm khác.");
        verdict = { tone: "warning", lines };
      } else verdict = { tone: "free" };
    }
  }

  function slotFrom(event: DragEvent<HTMLDivElement>, day: number): Target | null {
    if (!drag) return null;
    const rect = event.currentTarget.getBoundingClientRect();
    const pointer = Math.floor((event.clientY - rect.top) / ROW_PX) * STEP + from;
    const start = Math.max(from, Math.min(to - STEP, pointer - drag.grab));
    return { day, start };
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>, day: number) {
    if (!drag) return;
    event.preventDefault();
    const next = slotFrom(event, day);
    if (!next) return;
    const blocked = hardVerdict(next, drag.session, drag.length).length > 0;
    event.dataTransfer.dropEffect = blocked ? "none" : "move";
    if (!target || target.day !== next.day || target.start !== next.start) setTarget(next);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, day: number) {
    event.preventDefault();
    const current = drag;
    const next = slotFrom(event, day);
    setDrag(null);
    setTarget(null);
    if (!current || !next) return;
    if (hardVerdict(next, current.session, current.length).length > 0) return;
    const { startMs, endMs } = targetRange(next, current.length);
    if (startMs === new Date(current.session.startUtc).getTime()) return;
    onDrop({ session: current.session, startUtc: new Date(startMs).toISOString(), endUtc: new Date(endMs).toISOString() });
  }

  const nowDay = dayIndexOf(new Date(now).toISOString(), weekStart);
  const nowMinutes = localMinutes(new Date(now).toISOString());

  return (
    <div className={`week-grid-scroll${drag ? " is-dragging" : ""}`}>
      <div className="week-grid" style={{ ["--rows" as string]: rows, ["--row" as string]: `${ROW_PX}px` }}>
        <div className="week-grid-corner" />
        {days.map((day) => (
          <div key={day.toISOString()} className={`week-grid-head${isSameLocalDay(day, today) ? " is-today" : ""}`}>
            <span>{formatWeekday(day, true)}</span><small>{formatDayMonth(day)}</small>
          </div>
        ))}
        <div className="week-grid-hours" aria-hidden="true">
          {Array.from({ length: rows / 2 }, (_, index) => <span key={index} style={{ top: index * 2 * ROW_PX }}>{clock(from + index * 60)}</span>)}
        </div>
        {days.map((day, dayIndex) => (
          <div
            key={day.toISOString()}
            className={`week-grid-day${isSameLocalDay(day, today) ? " is-today" : ""}`}
            onDragOver={(event) => handleDragOver(event, dayIndex)}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setTarget(null); }}
            onDrop={(event) => handleDrop(event, dayIndex)}
          >
            {nowDay === dayIndex && nowMinutes >= from && nowMinutes < to && (
              <div className="week-grid-now" style={{ top: ((nowMinutes - from) / STEP) * ROW_PX }} aria-hidden="true" />
            )}
            {placed.filter((item) => item.day === dayIndex).map((item) => (
              <SessionBlock
                key={item.session.id}
                item={item}
                lookups={lookups}
                movable={canManage && isMovable(item.session, now)}
                dragging={drag?.session.id === item.session.id}
                onOpen={() => onOpen(item.session)}
                onDragStart={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const grab = Math.floor((event.clientY - rect.top) / ROW_PX) * STEP;
                  const length = (new Date(item.session.endUtc).getTime() - new Date(item.session.startUtc).getTime()) / 60000;
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", item.session.id);
                  // Let the browser take its drag image before the source turns translucent.
                  window.setTimeout(() => setDrag({ session: item.session, grab: Math.max(0, Math.min(grab, length - STEP)), length }), 0);
                }}
                onDragEnd={() => { setDrag(null); setTarget(null); }}
              />
            ))}
            {drag && target && target.day === dayIndex && verdict && (
              <div
                className={`week-grid-ghost is-${verdict.tone}`}
                style={{ top: ((target.start - from) / STEP) * ROW_PX, height: Math.max(ROW_PX, (drag.length / STEP) * ROW_PX) }}
                role="status"
              >
                <strong>{clock(target.start)}–{clock(Math.min(24 * 60, target.start + drag.length))}</strong>
                <div className={`week-grid-ghost-label${dayIndex >= 5 ? " is-end" : ""}`}>
                  {verdict.tone === "blocked" && <><b>Không thể dời</b>{verdict.lines.map((line) => <span key={line}>{line}</span>)}</>}
                  {verdict.tone === "checking" && <span>Đang kiểm tra lịch học sinh và giáo viên…</span>}
                  {verdict.tone === "warning" && <><b>Có trùng — vẫn dời được sau khi xác nhận</b>{verdict.lines.map((line) => <span key={line}>{line}</span>)}</>}
                  {verdict.tone === "free" && <span>Trống — thả để dời</span>}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SessionBlock({ item, lookups, movable, dragging, onOpen, onDragStart, onDragEnd }: {
  item: Placed;
  lookups: CenterLookups;
  movable: boolean;
  dragging: boolean;
  onOpen: () => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
}) {
  const { session } = item;
  const notHeld = session.status === "NotHeld";
  const state = notHeld ? "is-not-held" : !session.isActive ? "is-cancelled" : session.makeupForSessionId ? "is-makeup" : session.isRescheduled ? "is-moved" : "";
  const className = session.className ?? lookups.classById.get(session.classId)?.name ?? "Lớp";
  const code = session.classCode ?? lookups.classById.get(session.classId)?.code;
  const teacher = session.teacherName ?? lookups.teacherById.get(session.teacherId)?.fullName;
  const room = session.roomName ?? lookups.roomById.get(session.roomId)?.name;
  const width = 100 / item.lanes;
  return (
    <button
      type="button"
      className={`week-grid-block ${state}${movable ? " is-movable" : ""}${dragging ? " is-source" : ""}`}
      style={{ top: item.top, height: item.height - 2, left: `calc(${item.lane * width}% + 2px)`, width: `calc(${width}% - 4px)` }}
      draggable={movable}
      onDragStart={movable ? onDragStart : undefined}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      title={`${className} · ${formatSlot(session.startUtc, session.endUtc)}${teacher ? ` · ${teacher}` : ""}${room ? ` · ${room}` : ""}${movable ? "\nKéo để dời sang giờ khác; bấm để xem thao tác." : ""}`}
      aria-label={`${className}, ${formatWeekday(session.startUtc)} ${formatTimeRange(session.startUtc, session.endUtc)}${notHeld ? ", không diễn ra" : !session.isActive ? ", đã hủy" : ""}`}
    >
      {movable && <GripVertical className="week-grid-grip" aria-hidden="true" />}
      <strong>{formatTimeRange(session.startUtc, session.endUtc)}</strong>
      <span className="week-grid-title">{code ? `${code} · ` : ""}{className}</span>
      <span className="week-grid-meta">{[room, teacher].filter(Boolean).join(" · ")}</span>
    </button>
  );
}

/** After a drop: old → new time, who is affected, a mandatory reason; clashes with students need an extra tick. */
export function DropRescheduleDialog({ centerId, request, lookups, onClose, onSaved, onStale }: {
  centerId: string;
  request: DropRequest;
  lookups: CenterLookups;
  onClose: () => void;
  onSaved: (saved: TeachingSession) => void;
  onStale: () => void;
}) {
  const { session, startUtc, endUtc } = request;
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [impact, setImpact] = useState<SessionImpact | null>(null);
  const [accepted, setAccepted] = useState(false);
  const action = useAction();
  const onData = useCallback((data: SessionImpact | null) => setImpact(data), []);
  const clash = hasImpactClash(impact);
  const trimmed = reason.trim();
  const reasonError = !trimmed || trimmed.length > 500 ? "Nhập lý do dời lịch (1–500 ký tự)." : null;
  const acceptError = clash && !accepted ? "Đánh dấu xác nhận để vẫn dời dù có trùng giờ." : null;
  const className = session.className ?? lookups.classById.get(session.classId)?.name ?? "Buổi học";

  async function submit() {
    setTouched(true);
    if (reasonError || acceptError || !impact) return;
    const saved = await action.run(() => academicsApi.rescheduleSession(centerId, session.id, {
      teacherId: session.teacherId,
      roomId: session.roomId,
      startUtc,
      endUtc,
      expectedVersion: session.version,
      reason: trimmed,
    }));
    if (saved) onSaved(saved);
  }

  return (
    <Dialog
      open
      size="md"
      title="Dời buổi học?"
      description={`${className} · giáo viên và phòng giữ nguyên. Lý do hiển thị cho học sinh và giáo viên.`}
      onClose={onClose}
      onSubmit={submit}
      footer={<><Button onClick={onClose} disabled={action.pending}>Đóng</Button><Button type="submit" variant="primary" pending={action.pending} disabled={!impact}>{impact ? "Dời lịch" : "Đang kiểm tra…"}</Button></>}
    >
      <p className="move-summary">
        <span>{formatWeekday(session.startUtc)} {formatDayMonth(session.startUtc)}<strong>{formatTimeRange(session.startUtc, session.endUtc)}</strong></span>
        <ArrowRight aria-hidden="true" />
        <span>{formatWeekday(startUtc)} {formatDayMonth(startUtc)}<strong>{formatTimeRange(startUtc, endUtc)}</strong></span>
      </p>
      <ImpactSummary centerId={centerId} classId={session.classId} startUtc={startUtc} endUtc={endUtc} sessionId={session.id} teacherId={session.teacherId} onData={onData} />
      {clash && (
        <label className="check-line">
          <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
          <span>Tôi đã xem các trường hợp trùng giờ ở trên và vẫn muốn dời buổi này.</span>
        </label>
      )}
      {touched && acceptError && <p className="field-error">{acceptError}</p>}
      <Field label="Lý do dời lịch" required error={touched ? reasonError : null}>
        {(id, describedBy) => <textarea id={id} aria-describedby={describedBy} rows={2} maxLength={500} value={reason} autoFocus placeholder="Ví dụ: giáo viên bận việc đột xuất" onChange={(event) => setReason(event.target.value)} />}
      </Field>
      <ErrorNotice error={action.error} onReload={onStale} />
    </Dialog>
  );
}
