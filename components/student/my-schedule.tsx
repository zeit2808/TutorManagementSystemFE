"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BellRing, Check, ClipboardList, Inbox, Search, Send, Undo2 } from "lucide-react";
import { academicsApi, type MyNotice, type MyScheduleEntry, type StudentRequest, type StudentRequestKind } from "@/lib/api";
import { useAction, useResource } from "@/lib/hooks/use-resource";
import { formatDateTime, formatSlot, formatStartLabel } from "@/lib/format";
import { changeKindLabels, requestKindLabels, requestStatus } from "@/lib/labels";
import { Badge, Button, Dialog, EmptyState, ErrorNotice, Field, Notice, PageHeader, Pagination, Panel, SkeletonRows } from "@/components/ui/primitives";
import { PersonalSchedule } from "@/components/schedule/personal-schedule";
import { TuitionReminderNotice } from "./my-tuition";

interface RequestTarget {
  centerId: string;
  centerName?: string | null;
  classId: string;
  className?: string | null;
  sessionId?: string | null;
  sessionStartUtc?: string | null;
  sessionEndUtc?: string | null;
  /** The session can still be skipped with permission (active and not started). */
  canExcuse: boolean;
  noticeId?: string | null;
  kind: StudentRequestKind;
}

/** F1: the student portal home — notices, the combined schedule of every center, and requests. */
export function StudentDashboard({ joinedClass }: { joinedClass?: string } = {}) {
  const [request, setRequest] = useState<RequestTarget | null>(null);
  const [notice, setNotice] = useState<string | null>(joinedClass ? `Bạn đã vào lớp ${joinedClass}. Lịch của lớp hiện ngay bên dưới.` : null);
  const [reloadToken, setReloadToken] = useState(0);
  const refresh = () => setReloadToken((value) => value + 1);

  function excuse(entry: MyScheduleEntry) {
    setRequest({
      centerId: entry.centerId, centerName: entry.centerName, classId: entry.classId, className: entry.className,
      sessionId: entry.sessionId, sessionStartUtc: entry.startUtc, sessionEndUtc: entry.endUtc, canExcuse: true, kind: "ExcusedAbsence",
    });
  }

  return (
    <>
      <PageHeader
        title="Lịch học của tôi"
        description="Gộp lịch ở mọi trung tâm bạn đang học. Khi trung tâm đổi lịch, thông báo hiện ở đây và gửi qua email; bạn có thể xác nhận hoặc gửi yêu cầu."
        actions={<Link className="btn btn-secondary" href="/student/find"><Search aria-hidden="true" />Tìm trung tâm, đăng ký lớp</Link>}
      />
      <TuitionReminderNotice />
      {notice && <Notice tone="success" onDismiss={() => setNotice(null)}>{notice}</Notice>}
      <NoticesPanel reloadToken={reloadToken} onRequest={setRequest} onChanged={refresh} />
      <PersonalSchedule
        title="Hai tuần của tôi"
        description="Buổi đã hủy hoặc không diễn ra vẫn hiện kèm lý do. “Trùng giờ” nghĩa là bạn có hai buổi cùng lúc."
        reloadToken={reloadToken}
        actions={(entry, now) =>
          entry.role === "Student" && entry.status === "Scheduled" && !entry.absenceRequestStatus && new Date(entry.startUtc).getTime() > now
            ? <Button size="sm" variant="ghost" onClick={() => excuse(entry)}>Xin vắng</Button>
            : null}
      />
      <MyRequestsPanel reloadToken={reloadToken} onChanged={refresh} />
      {request && (
        <StudentRequestDialog
          target={request}
          onClose={() => setRequest(null)}
          onSent={(sent) => {
            setRequest(null);
            setNotice(`Đã gửi “${requestKindLabels[sent.kind] ?? sent.kind}” tới ${sent.centerName ?? "trung tâm"}. Bạn sẽ thấy kết quả ở mục Yêu cầu của tôi.`);
            refresh();
          }}
        />
      )}
    </>
  );
}

function describeNotice(item: MyNotice) {
  if (item.oldStartUtc && item.oldEndUtc && item.newStartUtc && item.newEndUtc)
    return `${formatSlot(item.oldStartUtc, item.oldEndUtc)} → ${formatSlot(item.newStartUtc, item.newEndUtc)}`;
  if (item.oldStartUtc && item.oldEndUtc) return formatSlot(item.oldStartUtc, item.oldEndUtc);
  if (item.kind === "SeriesStopped" || item.kind === "SeriesReplaced")
    return `${item.affectedSessionCount} buổi${item.firstAffectedStartUtc ? ` từ ${formatStartLabel(item.firstAffectedStartUtc)}` : ""}`;
  if (item.newStartUtc && item.newEndUtc) return formatSlot(item.newStartUtc, item.newEndUtc);
  return "";
}

function NoticesPanel({ reloadToken, onRequest, onChanged }: { reloadToken: number; onRequest: (target: RequestTarget) => void; onChanged: () => void }) {
  const [page, setPage] = useState(1);
  const list = useResource(() => academicsApi.myNotices({ page, pageSize: 5 }), [page, reloadToken]);
  const action = useAction();

  async function acknowledge(item: MyNotice) {
    if (await action.run(() => academicsApi.acknowledgeNotice(item.id))) onChanged();
  }

  function ask(item: MyNotice, kind: StudentRequestKind) {
    const sessionStart = item.newStartUtc ?? item.oldStartUtc;
    const sessionEnd = item.newEndUtc ?? item.oldEndUtc;
    onRequest({
      centerId: item.centerId, centerName: item.centerName, classId: item.classId, className: item.className,
      sessionId: item.sessionId, sessionStartUtc: sessionStart, sessionEndUtc: sessionEnd, noticeId: item.id, kind,
      canExcuse: Boolean(item.sessionId && item.kind !== "SessionCancelled" && item.kind !== "SessionNotHeld" &&
        sessionStart && new Date(sessionStart).getTime() > Date.now()),
    });
  }

  const data = list.data;
  return (
    <Panel
      title={<span className="title-with-count"><BellRing aria-hidden="true" />Thông báo đổi lịch{data && data.unreadCount > 0 && <Badge tone="warning">{data.unreadCount} chưa xem</Badge>}</span>}
      description="Trung tâm ghi rõ lịch cũ, lịch mới và lý do. “Báo gấp” là thay đổi trong 24 giờ tới (hoặc lịch lặp đổi khi còn chưa đầy 7 ngày)."
      flush
      actions={data && data.unreadCount > 0 ? <Button size="sm" variant="ghost" onClick={() => void action.run(() => academicsApi.markNoticesSeen()).then((done) => { if (done !== undefined) onChanged(); })}>Đánh dấu đã xem hết</Button> : undefined}
    >
      <ErrorNotice error={list.error ?? action.error} onReload={() => void list.reload()} onDismiss={action.clearError} />
      {!data ? (
        <SkeletonRows rows={2} columns={2} />
      ) : data.items.length === 0 ? (
        <EmptyState icon={<Inbox aria-hidden="true" />} title="Chưa có thay đổi lịch nào">Khi trung tâm dời, hủy hoặc thêm buổi của lớp bạn, thông báo sẽ hiện ở đây.</EmptyState>
      ) : (
        <ul className="notice-list">
          {data.items.map((item) => (
            <li key={item.id} className={item.seenAtUtc ? "" : "is-unread"}>
              <div className="notice-head">
                <strong>{changeKindLabels[item.kind] ?? item.kind} · {item.className ?? "Lớp"}</strong>
                {item.isUrgent && <Badge tone="danger">Báo gấp</Badge>}
                {item.conflictCount > 0 && <Badge tone="danger">Trùng {item.conflictCount} buổi khác</Badge>}
                {item.response === "Acknowledged" && <Badge tone="success">Đã xác nhận</Badge>}
                {item.response === "Requested" && <Badge tone="info">Đã gửi yêu cầu</Badge>}
              </div>
              <p className="notice-text">{describeNotice(item)}</p>
              <p className="cell-note">{item.centerName}{item.reason ? ` · Lý do: ${item.reason}` : ""} · {formatDateTime(item.createdAtUtc)}</p>
              {item.response === "None" && (
                <div className="notice-actions">
                  <Button size="sm" icon={<Check aria-hidden="true" />} onClick={() => void acknowledge(item)} pending={action.pending}>Đã xem, vẫn đi được</Button>
                  {item.sessionId && <Button size="sm" variant="ghost" onClick={() => ask(item, item.kind === "SessionCancelled" || item.kind === "SessionNotHeld" ? "Makeup" : "ExcusedAbsence")}>{item.kind === "SessionCancelled" || item.kind === "SessionNotHeld" ? "Xin học bù" : "Xin vắng / học bù"}</Button>}
                  <Button size="sm" variant="ghost" onClick={() => ask(item, "Transfer")}>Xin chuyển lớp</Button>
                  <Button size="sm" variant="ghost" onClick={() => ask(item, "Withdrawal")}>Xin rút</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {data && <Pagination page={page} pageSize={data.pageSize} total={data.totalCount} onChange={setPage} />}
    </Panel>
  );
}

function MyRequestsPanel({ reloadToken, onChanged }: { reloadToken: number; onChanged: () => void }) {
  const [page, setPage] = useState(1);
  const list = useResource(() => academicsApi.myRequests({ page, pageSize: 10 }), [page, reloadToken]);
  const action = useAction();
  return (
    <Panel title="Yêu cầu của tôi" description="Xin vắng, xin học bù, chuyển lớp, rút lớp — trung tâm duyệt từng yêu cầu." flush>
      <ErrorNotice error={list.error ?? action.error} onReload={() => void list.reload()} onDismiss={action.clearError} />
      {!list.data ? (
        <SkeletonRows rows={2} columns={3} />
      ) : list.data.items.length === 0 ? (
        <EmptyState icon={<ClipboardList aria-hidden="true" />} title="Bạn chưa gửi yêu cầu nào">Dùng nút “Xin vắng” trên lịch hoặc trả lời một thông báo đổi lịch.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Yêu cầu</th><th>Lớp</th><th>Gửi lúc</th><th>Kết quả</th><th className="col-actions"><span className="sr-only">Thao tác</span></th></tr></thead>
            <tbody>
              {list.data.items.map((item) => {
                const status = requestStatus[item.status] ?? { label: item.status, tone: "neutral" as const };
                return (
                  <tr key={item.id}>
                    <td><strong>{requestKindLabels[item.kind] ?? item.kind}</strong><p className="cell-note">{requestDetail(item)}</p></td>
                    <td>{item.className}<p className="cell-note">{item.centerName}</p></td>
                    <td className="col-muted">{formatDateTime(item.submittedAtUtc)}</td>
                    <td><Badge tone={status.tone}>{status.label}</Badge>{item.reviewNote && <p className="cell-note">{item.status === "Rejected" ? "Lý do" : "Ghi chú"}: {item.reviewNote}</p>}</td>
                    <td className="col-actions">
                      {item.status === "Pending" && (
                        <Button size="sm" variant="ghost" icon={<Undo2 aria-hidden="true" />} pending={action.pending}
                          onClick={() => void action.run(() => academicsApi.cancelStudentRequest(item.centerId, item.id)).then((done) => { if (done) onChanged(); })}>Rút lại</Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {list.data && <Pagination page={page} pageSize={list.data.pageSize} total={list.data.totalCount} onChange={setPage} />}
    </Panel>
  );
}

export function requestDetail(item: StudentRequest) {
  const parts: string[] = [];
  if (item.sessionStartUtc && item.sessionEndUtc) parts.push(`Buổi ${formatSlot(item.sessionStartUtc, item.sessionEndUtc)}`);
  if (item.targetClassName) parts.push(`Sang lớp ${item.targetClassName}`);
  parts.push(`Lý do: ${item.reason}`);
  return parts.join(" · ");
}

const KIND_ORDER: StudentRequestKind[] = ["ExcusedAbsence", "Makeup", "Transfer", "Withdrawal"];

/** B8: one dialog for every request kind; only the kinds that make sense for the target are offered. */
function StudentRequestDialog({ target, onClose, onSent }: { target: RequestTarget; onClose: () => void; onSent: (request: StudentRequest) => void }) {
  const kinds = KIND_ORDER.filter((kind) =>
    kind === "ExcusedAbsence" ? target.canExcuse : kind === "Makeup" ? Boolean(target.sessionId) : true);
  const [kind, setKind] = useState<StudentRequestKind>(kinds.includes(target.kind) ? target.kind : kinds[0]);
  const [reason, setReason] = useState("");
  const [targetClassId, setTargetClassId] = useState("");
  const [touched, setTouched] = useState(false);
  const action = useAction();
  const open = useResource(
    () => kind === "Transfer" ? academicsApi.listOpenClasses(target.centerId, { page: 1, pageSize: 100 }) : Promise.resolve(null),
    [target.centerId, kind],
  );
  const options = useMemo(() => (open.data?.items ?? []).filter((item) => item.id !== target.classId), [open.data, target.classId]);
  const errors = {
    reason: !reason.trim() || reason.trim().length > 500 ? "Nhập lý do (1–500 ký tự)." : null,
    target: kind === "Transfer" && !targetClassId ? "Chọn lớp muốn chuyển sang." : null,
  };

  async function submit() {
    setTouched(true);
    if (errors.reason || errors.target) return;
    const needsSession = kind === "ExcusedAbsence" || kind === "Makeup";
    const sent = await action.run(() => academicsApi.submitStudentRequest(target.centerId, {
      kind, classId: target.classId, reason: reason.trim(), noticeId: target.noticeId ?? null,
      sessionId: needsSession ? target.sessionId : null, targetClassId: kind === "Transfer" ? targetClassId : null,
    }));
    if (sent) onSent(sent);
  }

  return (
    <Dialog open title="Gửi yêu cầu tới trung tâm" description={`${target.className ?? "Lớp"} · ${target.centerName ?? ""}`} onClose={onClose} onSubmit={submit}
      footer={<><Button onClick={onClose} disabled={action.pending}>Đóng</Button><Button type="submit" variant="primary" icon={<Send aria-hidden="true" />} pending={action.pending}>Gửi yêu cầu</Button></>}>
      <fieldset className="choice-row">
        <legend className="sr-only">Loại yêu cầu</legend>
        {kinds.map((value) => (
          <label key={value} className={`choice-pill${kind === value ? " checked" : ""}`}>
            <input type="radio" name="request-kind" value={value} checked={kind === value} onChange={() => setKind(value)} />
            {requestKindLabels[value]}
          </label>
        ))}
      </fieldset>
      {(kind === "ExcusedAbsence" || kind === "Makeup") && target.sessionStartUtc && target.sessionEndUtc && (
        <p>Buổi: <strong>{formatSlot(target.sessionStartUtc, target.sessionEndUtc)}</strong></p>
      )}
      <p className="cell-note">
        {kind === "ExcusedAbsence" && "Gửi trước giờ học. Khi trung tâm duyệt, phiếu điểm danh tự ghi “Vắng có phép”; chưa duyệt thì vẫn tính như bình thường."}
        {kind === "Makeup" && "Trung tâm xem xét xếp buổi bù hoặc cho học ghép với lớp cùng môn."}
        {kind === "Transfer" && "Khi duyệt, bạn rời lớp hiện tại và vào lớp mới cùng lúc."}
        {kind === "Withdrawal" && "Khi trung tâm xác nhận, bạn rời lớp ngay; lịch sử học vẫn được giữ."}
      </p>
      {kind === "Transfer" && (
        <Field label="Lớp muốn chuyển sang" required error={touched ? errors.target : null} hint="Chỉ hiện lớp đang mở đăng ký, còn chỗ.">
          {(id, describedBy) => (
            <select id={id} aria-describedby={describedBy} value={targetClassId} onChange={(event) => setTargetClassId(event.target.value)}>
              <option value="">{open.data ? (options.length ? "Chọn lớp…" : "Trung tâm chưa mở lớp nào khác") : "Đang tải…"}</option>
              {options.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}
            </select>
          )}
        </Field>
      )}
      <Field label="Lý do" required error={touched ? errors.reason : null}>
        {(id, describedBy) => <textarea id={id} aria-describedby={describedBy} rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />}
      </Field>
      <ErrorNotice error={action.error ?? open.error} />
      <p className="cell-note"><Link className="text-link" href={`/student/centers/${target.centerId}`}>Mở trang trung tâm <ArrowRight aria-hidden="true" /></Link></p>
    </Dialog>
  );
}
