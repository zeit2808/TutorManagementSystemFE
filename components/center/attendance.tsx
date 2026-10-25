"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Check, CheckCircle2, ClipboardCheck, Clock3, History, MapPin, MessageSquarePlus, PencilLine, Save, Send, UserRound, UsersRound } from "lucide-react";
import { academicsApi, type AttendanceMark, type AttendanceRevision, type AttendanceSheet, type AttendanceStudent } from "@/lib/api";
import { useAction, useResource } from "@/lib/hooks/use-resource";
import { useNow } from "@/lib/hooks/use-now";
import { useCenterLookups, type CenterLookups } from "@/lib/hooks/use-lookups";
import { addDays, formatDateTime, formatDayMonth, formatDuration, formatTimeRange, formatWeekday, initials, minutesBetween } from "@/lib/format";
import { attendanceStatus, markLabels, markOptions, revisionActions } from "@/lib/labels";
import { Badge, Button, EmptyState, ErrorNotice, Field, Notice, PageHeader, Panel, SkeletonRows, StateRail } from "@/components/ui/primitives";
import { useCenter } from "./center-frame";

/** Managers see every session. Other members see only sessions of the teacher profile linked to their login. */
export function AttendanceWorkspace() {
  return <AttendanceInner />;
}

/** Decision D3/D12: a teacher may save until midnight (Vietnam time) of the session's day. */
function endOfVietnamDay(startUtc: string) {
  const VN_OFFSET = 7 * 60 * 60 * 1000;
  const local = new Date(new Date(startUtc).getTime() + VN_OFFSET);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1) - VN_OFFSET;
}

function AttendanceInner() {
  const { centerId, canManage } = useCenter();
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get("session") ?? "";
  const lookups = useCenterLookups(centerId);
  const now = useNow();

  const sessions = useResource(async () => {
    const now = new Date();
    const from = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), -21);
    const to = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), 2);
    if (!canManage) {
      const mine = await academicsApi.myTeaching(centerId, from.toISOString(), to.toISOString());
      return { linked: Boolean(mine.teacher), rows: mine.sessions.filter((row) => row.isActive).sort((a, b) => b.startUtc.localeCompare(a.startUtc)) };
    }
    const rows = await academicsApi.listSessions(centerId, from.toISOString(), to.toISOString());
    return { linked: true, rows: rows.filter((row) => row.isActive).sort((a, b) => b.startUtc.localeCompare(a.startUtc)) };
  }, [centerId, canManage]);
  const rows = sessions.data?.rows;

  useEffect(() => {
    if (selectedId || !rows?.length) return;
    const nearest = rows.find((row) => new Date(row.startUtc).getTime() <= Date.now());
    if (nearest) router.replace(`/centers/${centerId}/attendance?session=${nearest.id}`);
  }, [centerId, router, selectedId, rows]);

  const lk = lookups.data;
  const selected = rows?.find((row) => row.id === selectedId);

  return (
    <>
      <PageHeader
        title="Điểm danh"
        description={canManage
          ? "Danh sách lấy theo học sinh đang học tại thời điểm buổi học bắt đầu. Lưu nháp trong lúc điểm danh, nộp khi đủ mọi học sinh."
          : "Các buổi bạn được phân công dạy. Bạn tự điểm danh được đến hết ngày diễn ra buổi học; sau đó chủ hoặc quản lý trung tâm sẽ hiệu chỉnh nếu cần."}
      />
      <ErrorNotice error={sessions.error ?? lookups.error} onReload={() => { void sessions.reload(); void lookups.reload(); }} />
      <div className="attendance-layout">
        <Panel title={canManage ? "Buổi học" : "Buổi tôi dạy"} description="21 ngày gần nhất" flush className="attendance-sessions">
          {!rows || !lk ? (
            <SkeletonRows rows={8} columns={1} />
          ) : !sessions.data?.linked ? (
            <EmptyState icon={<UserRound aria-hidden="true" />} title="Tài khoản chưa gắn hồ sơ giáo viên">
              Nhờ chủ trung tâm vào mục Giáo viên, chọn hồ sơ của bạn và gắn tài khoản này để thấy các buổi mình dạy.
            </EmptyState>
          ) : rows.length === 0 ? (
            <EmptyState icon={<CalendarDays aria-hidden="true" />} title="Chưa có buổi học">Buổi học xuất hiện ở đây sau khi xếp lịch.</EmptyState>
          ) : (
            <ul className="session-picker">
              {rows.map((row) => {
                const started = new Date(row.startUtc).getTime() <= now;
                const teachingClass = lk.classById.get(row.classId);
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      className={row.id === selectedId ? "active" : ""}
                      aria-current={row.id === selectedId ? "true" : undefined}
                      onClick={() => router.replace(`/centers/${centerId}/attendance?session=${row.id}`)}
                    >
                      <span className="session-picker-when">{formatWeekday(row.startUtc, true)} {formatDayMonth(row.startUtc)} · {formatTimeRange(row.startUtc, row.endUtc)}</span>
                      <strong>{row.className ?? teachingClass?.name ?? "Lớp"}</strong>
                      <span className="session-picker-meta">{row.classCode ?? teachingClass?.code}{!started && " · chưa bắt đầu"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <div className="attendance-main">
          {!selectedId ? (
            <Panel><EmptyState icon={<ClipboardCheck aria-hidden="true" />} title="Chọn một buổi học để điểm danh" /></Panel>
          ) : !lk ? (
            <Panel><SkeletonRows rows={6} columns={3} /></Panel>
          ) : (
            <AttendanceSheetEditor key={selectedId} sessionId={selectedId} lookups={lk} sessionStartUtc={selected?.startUtc} canManage={canManage} />
          )}
        </div>
      </div>
    </>
  );
}

function AttendanceSheetEditor({ sessionId, lookups, sessionStartUtc, canManage }: { sessionId: string; lookups: CenterLookups; sessionStartUtc?: string; canManage: boolean }) {
  const { centerId } = useCenter();
  const now = useNow();
  const sheetResource = useResource(() => academicsApi.getAttendance(centerId, sessionId), [centerId, sessionId]);
  const sessionInfo = useResource(async () => {
    // The attendance sheet omits teacher/room/end time; read them from the schedule.
    const start = sessionStartUtc ? new Date(sessionStartUtc) : new Date();
    const rows = await academicsApi.listSessions(centerId, addDays(start, -1).toISOString(), addDays(start, 1).toISOString());
    return rows.find((row) => row.id === sessionId) ?? null;
  }, [centerId, sessionId, sessionStartUtc ?? ""]);

  const [edit, setEdit] = useState<{ base: AttendanceSheet; value: AttendanceSheet } | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [reason, setReason] = useState("");
  const [notesOpen, setNotesOpen] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<AttendanceRevision[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const action = useAction();
  const historyAction = useAction();

  const original = sheetResource.data;
  // Local edits are tied to the sheet version they started from; a fresh server copy resets them.
  const draft = original ? (edit && edit.base === original ? edit.value : original) : null;
  function setDraft(next: AttendanceSheet | ((current: AttendanceSheet) => AttendanceSheet)) {
    if (!original) return;
    setEdit((previous) => {
      const current = previous && previous.base === original ? previous.value : original;
      return { base: original, value: typeof next === "function" ? next(current) : next };
    });
  }

  const session = sessionInfo.data;
  const teachingClass = original ? lookups.classById.get(original.classId) : undefined;
  const started = original ? new Date(original.startUtc).getTime() <= now : false;
  const submitted = original?.status === "Submitted";
  const cancelled = original?.status === "Cancelled";
  const windowEnd = original ? endOfVietnamDay(original.startUtc) : 0;
  const windowClosed = !canManage && now >= windowEnd;
  const editable = started && !cancelled && !windowClosed && (!submitted || correcting);

  const summary = useMemo(() => {
    const rows = draft?.students ?? [];
    const count = (mark: AttendanceMark) => rows.filter((row) => row.mark === mark).length;
    return { total: rows.length, present: count("Present"), late: count("Late"), excused: count("ExcusedAbsent"), unexcused: count("UnexcusedAbsent"), unknown: count("Unknown") };
  }, [draft]);

  const changedStudents = useMemo(() => {
    if (!draft || !original) return [];
    const before = new Map(original.students.map((row) => [row.studentId, row]));
    return draft.students.filter((row) => {
      const prior = before.get(row.studentId);
      return !prior || prior.mark !== row.mark || (prior.note ?? "") !== (row.note ?? "");
    });
  }, [draft, original]);
  const headerChanged = Boolean(draft && original && ((draft.actualTeacherId ?? "") !== (original.actualTeacherId ?? "") || (draft.note ?? "") !== (original.note ?? "")));
  const dirty = changedStudents.length > 0 || headerChanged;

  if (!original || !draft) {
    return (
      <Panel>
        <ErrorNotice error={sheetResource.error} onReload={() => void sheetResource.reload()} />
        {!sheetResource.error && <SkeletonRows rows={6} columns={3} />}
      </Panel>
    );
  }

  const actualTeacherId = draft.actualTeacherId ?? session?.teacherId ?? "";
  const teacherOptions = lookups.teachers.filter((teacher) => teacher.isActive || teacher.id === actualTeacherId);
  const status = attendanceStatus[original.status] ?? { label: original.status, tone: "neutral" as const };

  function setMark(studentId: string, mark: AttendanceMark) {
    setDraft((current) => ({ ...current, students: current.students.map((row) => (row.studentId === studentId ? { ...row, mark } : row)) }));
    setMessage(null);
  }
  function setNote(studentId: string, note: string) {
    setDraft((current) => ({ ...current, students: current.students.map((row) => (row.studentId === studentId ? { ...row, note } : row)) }));
  }
  function markAll(mark: AttendanceMark) {
    setDraft((current) => ({ ...current, students: current.students.map((row) => (row.mark === "Unknown" ? { ...row, mark } : row)) }));
  }

  function draftPayload() {
    return {
      expectedVersion: original!.version,
      actualTeacherId: actualTeacherId || null,
      note: draft!.note?.trim() || null,
      defaultMark: "Unknown" as AttendanceMark,
      overrides: draft!.students.map((row) => ({ studentId: row.studentId, mark: row.mark, note: row.note?.trim() || null })),
    };
  }

  async function saveDraft() {
    const saved = await action.run(() => academicsApi.saveAttendanceDraft(centerId, sessionId, draftPayload()));
    if (saved) {
      sheetResource.setData(saved);
      setMessage("Đã lưu bản nháp.");
      setHistory(null);
    }
  }

  async function submit() {
    const saved = await action.run(async () => {
      const latest = await academicsApi.saveAttendanceDraft(centerId, sessionId, draftPayload());
      return academicsApi.submitAttendance(centerId, sessionId, latest.version);
    });
    if (saved) {
      sheetResource.setData(saved);
      setMessage("Đã nộp phiếu điểm danh. Mọi thay đổi sau đây phải qua hiệu chỉnh có lý do.");
      setHistory(null);
    }
  }

  async function saveCorrection() {
    const saved = await action.run(() =>
      academicsApi.correctAttendance(centerId, sessionId, {
        expectedVersion: original!.version,
        actualTeacherId,
        note: draft!.note?.trim() || null,
        reason: reason.trim(),
        changes: changedStudents.map((row) => ({ studentId: row.studentId, mark: row.mark, note: row.note?.trim() || null })),
      }),
    );
    if (saved) {
      sheetResource.setData(saved);
      setCorrecting(false);
      setReason("");
      setHistory(null);
      setMessage("Đã lưu hiệu chỉnh và ghi vào lịch sử.");
    }
  }

  async function toggleHistory() {
    if (history) return setHistory(null);
    const rows = await historyAction.run(() => academicsApi.attendanceHistory(centerId, sessionId));
    if (rows) setHistory(rows);
  }

  const studentName = new Map(original.students.map((row) => [row.studentId, row.fullName]));
  const reasonValid = reason.trim().length >= 10 && reason.trim().length <= 500;

  return (
    <>
      <section className="attendance-context">
        <div>
          <h2>{original.className ?? teachingClass?.name ?? "Buổi học"}</h2>
          <p>
            <span><CalendarDays aria-hidden="true" />{formatWeekday(original.startUtc)} {formatDayMonth(original.startUtc)}</span>
            {session && <span><Clock3 aria-hidden="true" />{formatTimeRange(session.startUtc, session.endUtc)} · {formatDuration(minutesBetween(session.startUtc, session.endUtc))}</span>}
            {session && <span><MapPin aria-hidden="true" />{session.roomName ?? lookups.roomById.get(session.roomId)?.name ?? "—"}</span>}
            {session && <span><UserRound aria-hidden="true" />Theo lịch: {session.teacherName ?? lookups.teacherById.get(session.teacherId)?.fullName ?? "—"}</span>}
          </p>
        </div>
        <StateRail
          label="Trạng thái phiếu"
          current={original.status === "Cancelled" ? "NotStarted" : original.status}
          steps={[
            { id: "NotStarted", label: "Chưa điểm danh", tone: "neutral" },
            { id: "Draft", label: "Bản nháp", tone: "warning" },
            { id: "Submitted", label: "Đã nộp", tone: "success" },
          ]}
        />
      </section>

      {!started && <Notice tone="info">Buổi học chưa bắt đầu. Có thể điểm danh từ {formatDateTime(original.startUtc)}.</Notice>}
      {!canManage && started && !cancelled && !submitted && (windowClosed
        ? <Notice tone="warning">Đã hết ngày diễn ra buổi học nên bạn không tự lưu được nữa. Hãy nhờ chủ hoặc quản lý trung tâm hiệu chỉnh.</Notice>
        : <Notice tone="info">Bạn tự điểm danh được đến hết ngày {formatWeekday(original.startUtc)} {formatDayMonth(original.startUtc)}. Sau đó chỉ chủ hoặc quản lý trung tâm hiệu chỉnh được.</Notice>)}
      {cancelled && <Notice tone="danger">Buổi học đã hủy nên không điểm danh được.</Notice>}
      {message && <Notice tone="success" onDismiss={() => setMessage(null)}>{message}</Notice>}
      <ErrorNotice error={action.error} onReload={() => { action.clearError(); void sheetResource.reload(); }} onDismiss={action.clearError} />

      <Panel
        title="Danh sách học sinh"
        description={`${summary.total} học sinh · ${summary.present} có mặt · ${summary.late} muộn · ${summary.excused + summary.unexcused} vắng${summary.unknown ? ` · ${summary.unknown} chưa chọn` : ""}`}
        flush
        actions={
          <>
            <Badge tone={status.tone}>{status.label}</Badge>
            {editable && !submitted && summary.unknown > 0 && <Button size="sm" variant="ghost" icon={<Check aria-hidden="true" />} onClick={() => markAll("Present")}>Còn lại có mặt</Button>}
          </>
        }
      >
        <div className="attendance-settings">
          <Field label="Giáo viên dạy thực tế" required hint="Mặc định là giáo viên theo lịch.">
            {(id, describedBy) => (
              <select id={id} aria-describedby={describedBy} value={actualTeacherId} disabled={!editable || action.pending} onChange={(event) => setDraft({ ...draft, actualTeacherId: event.target.value })}>
                {!actualTeacherId && <option value="">Chọn giáo viên</option>}
                {teacherOptions.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName} · {teacher.code}</option>)}
              </select>
            )}
          </Field>
          <Field label="Ghi chú buổi học" className="grow">
            {(id) => <input id={id} value={draft.note ?? ""} maxLength={500} disabled={!editable || action.pending} placeholder="Không bắt buộc" onChange={(event) => setDraft({ ...draft, note: event.target.value })} />}
          </Field>
        </div>

        {draft.students.length === 0 ? (
          <EmptyState icon={<UsersRound aria-hidden="true" />} title="Không có học sinh trong danh sách">Lớp không có học sinh đang học vào thời điểm buổi học bắt đầu.</EmptyState>
        ) : (
          <ol className="roster">
            {draft.students.map((row, index) => (
              <RosterRow
                key={row.studentId}
                index={index}
                row={row}
                editable={editable && !action.pending}
                changed={correcting && changedStudents.some((item) => item.studentId === row.studentId)}
                noteOpen={notesOpen.has(row.studentId) || Boolean(row.note)}
                onToggleNote={() => setNotesOpen((current) => new Set(current).add(row.studentId))}
                onMark={(mark) => setMark(row.studentId, mark)}
                onNote={(note) => setNote(row.studentId, note)}
              />
            ))}
          </ol>
        )}

        {correcting && (
          <div className="correction-box">
            <Field label="Lý do hiệu chỉnh" required hint="10–500 ký tự. Lý do và trạng thái trước/sau được lưu vào lịch sử." error={reason && !reasonValid ? `Cần 10–500 ký tự (hiện ${reason.trim().length}).` : null}>
              {(id, describedBy) => <textarea id={id} aria-describedby={describedBy} rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: Phụ huynh gửi giấy xin phép sau buổi học" />}
            </Field>
            <p className="col-muted">{dirty ? `${changedStudents.length} học sinh thay đổi${headerChanged ? ", có thay đổi giáo viên/ghi chú" : ""}.` : "Chưa có thay đổi nào so với phiếu đã nộp."}</p>
          </div>
        )}

        <footer className="roster-footer">
          {canManage ? (
            <Button variant="ghost" icon={<History aria-hidden="true" />} pending={historyAction.pending} onClick={() => void toggleHistory()} disabled={original.version === 0}>
              {history ? "Ẩn lịch sử" : `Lịch sử · phiên bản ${original.version}`}
            </Button>
          ) : <span className="col-muted">Phiên bản {original.version}</span>}
          <div className="roster-actions">
            {submitted ? (
              correcting ? (
                <>
                  <Button onClick={() => { setCorrecting(false); setReason(""); setDraft(original); }} disabled={action.pending}>Hủy hiệu chỉnh</Button>
                  <Button variant="primary" icon={<Save aria-hidden="true" />} pending={action.pending} disabled={!dirty || !reasonValid || !actualTeacherId} onClick={() => void saveCorrection()}>Lưu hiệu chỉnh</Button>
                </>
              ) : canManage ? (
                <Button icon={<PencilLine aria-hidden="true" />} onClick={() => setCorrecting(true)}>Hiệu chỉnh phiếu</Button>
              ) : (
                <span className="col-muted">Phiếu đã nộp. Chủ hoặc quản lý trung tâm hiệu chỉnh nếu cần.</span>
              )
            ) : (
              <>
                <Button icon={<Save aria-hidden="true" />} pending={action.pending} disabled={!editable} onClick={() => void saveDraft()}>Lưu nháp</Button>
                <Button variant="primary" icon={<Send aria-hidden="true" />} pending={action.pending} disabled={!editable || summary.unknown > 0 || !actualTeacherId || draft.students.length === 0} onClick={() => void submit()}>
                  {summary.unknown > 0 ? `Còn ${summary.unknown} học sinh chưa chọn` : "Lưu và nộp phiếu"}
                </Button>
              </>
            )}
          </div>
        </footer>
        <ErrorNotice error={historyAction.error} onDismiss={historyAction.clearError} />
        {history && <RevisionList revisions={history} studentName={studentName} lookups={lookups} />}
      </Panel>
    </>
  );
}

function RosterRow({ index, row, editable, changed, noteOpen, onToggleNote, onMark, onNote }: { index: number; row: AttendanceStudent; editable: boolean; changed: boolean; noteOpen: boolean; onToggleNote: () => void; onMark: (mark: AttendanceMark) => void; onNote: (note: string) => void }) {
  return (
    <li className={`roster-row${changed ? " is-changed" : ""}${row.mark === "Unknown" ? " is-unknown" : ""}`}>
      <span className="roster-index">{index + 1}</span>
      <div className="roster-identity">
        <span className="avatar" aria-hidden="true">{initials(row.fullName)}</span>
        <div><strong>{row.fullName}</strong><small>{row.studentCode}{row.excusedAbsenceApproved && " · đã duyệt xin vắng"}</small></div>
      </div>
      <div className="mark-group" role="radiogroup" aria-label={`Trạng thái của ${row.fullName}`}>
        {markOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={row.mark === option.value}
            disabled={!editable}
            className={row.mark === option.value ? `active tone-${option.tone}` : ""}
            title={option.label}
            onClick={() => onMark(option.value)}
          >
            <Check aria-hidden="true" className={row.mark === option.value ? "" : "is-hidden"} />
            {option.short}
          </button>
        ))}
      </div>
      {noteOpen ? (
        <input className="roster-note" aria-label={`Ghi chú cho ${row.fullName}`} value={row.note ?? ""} maxLength={500} disabled={!editable} placeholder="Ghi chú" onChange={(event) => onNote(event.target.value)} />
      ) : (
        editable && <button type="button" className="icon-button" onClick={onToggleNote} aria-label={`Thêm ghi chú cho ${row.fullName}`}><MessageSquarePlus aria-hidden="true" /></button>
      )}
    </li>
  );
}

function RevisionList({ revisions, studentName, lookups }: { revisions: AttendanceRevision[]; studentName: Map<string, string>; lookups: CenterLookups }) {
  if (!revisions.length) return <p className="history-empty">Chưa có lần lưu nào.</p>;
  return (
    <ol className="revision-list">
      {[...revisions].reverse().map((revision) => {
        const before = new Map(revision.before.students.map((row) => [row.studentId, row]));
        const changes = revision.after.students.filter((row) => before.get(row.studentId)?.mark !== row.mark);
        const teacherChanged = revision.before.actualTeacherId !== revision.after.actualTeacherId;
        return (
          <li key={revision.version}>
            <header>
              <strong>v{revision.version} · {revisionActions[revision.action] ?? revision.action}</strong>
              <span>{formatDateTime(revision.createdAtUtc)} · {revision.actorName ?? `người thao tác ${revision.actorUserId.slice(0, 8)}`}</span>
            </header>
            {revision.reason && <p className="revision-reason">“{revision.reason}”</p>}
            {(changes.length > 0 || teacherChanged) && (
              <ul>
                {teacherChanged && <li>Giáo viên thực tế: {lookups.teacherById.get(revision.before.actualTeacherId ?? "")?.fullName ?? "chưa chọn"} → {lookups.teacherById.get(revision.after.actualTeacherId ?? "")?.fullName ?? "chưa chọn"}</li>}
                {changes.slice(0, 12).map((row) => (
                  <li key={row.studentId}>{studentName.get(row.studentId) ?? row.studentId.slice(0, 8)}: {markLabels[before.get(row.studentId)?.mark ?? "Unknown"]} → <strong>{markLabels[row.mark]}</strong></li>
                ))}
                {changes.length > 12 && <li>… và {changes.length - 12} học sinh khác</li>}
              </ul>
            )}
          </li>
        );
      })}
      <li className="revision-foot"><CheckCircle2 aria-hidden="true" />Lịch sử chỉ đọc, không thể xoá.</li>
    </ol>
  );
}
