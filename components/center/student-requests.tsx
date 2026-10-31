"use client";

import { useState } from "react";
import { Check, History, Inbox, RefreshCcw, X } from "lucide-react";
import { academicsApi, type ScheduleChange, type ScheduleCheck, type StudentRequest, type StudentRequestKind, type StudentRequestStatus } from "@/lib/api";
import { useAction, useResource } from "@/lib/hooks/use-resource";
import { useCenterLookups } from "@/lib/hooks/use-lookups";
import { useNow } from "@/lib/hooks/use-now";
import { formatDateTime, formatSlot, formatStartLabel } from "@/lib/format";
import { changeKindLabels, requestKindLabels, requestStatus } from "@/lib/labels";
import { Badge, Button, EmptyState, ErrorNotice, Notice, PageHeader, Pagination, Panel, Segmented, SkeletonRows } from "@/components/ui/primitives";
import { ReasonDialog } from "@/components/ui/reason-dialog";
import { ConflictConfirmDialog, scheduleCheckFrom } from "@/components/ui/conflict-dialog";
import { RoleGate, useCenter } from "./center-frame";

type Tab = "requests" | "changes";

/** F6: the center's queue of student requests and how students answered schedule changes. */
export function StudentRequestsWorkspace() {
  return (
    <RoleGate need="manage">
      <Inner />
    </RoleGate>
  );
}

function Inner() {
  const [tab, setTab] = useState<Tab>("requests");
  return (
    <>
      <PageHeader
        title="Phản hồi học sinh"
        description="Yêu cầu học sinh gửi (xin vắng, học bù, chuyển lớp, rút lớp) và phản hồi cho từng lần đổi lịch. Duyệt xin vắng sẽ điền sẵn “Vắng có phép” vào phiếu điểm danh."
        meta={<Segmented label="Mục" value={tab} onChange={setTab} options={[{ value: "requests", label: "Yêu cầu" }, { value: "changes", label: "Đổi lịch gần đây" }]} />}
      />
      {tab === "requests" ? <RequestQueue /> : <ChangeLog />}
    </>
  );
}

function RequestQueue() {
  const { centerId } = useCenter();
  const lookups = useCenterLookups(centerId);
  const [status, setStatus] = useState<StudentRequestStatus | "All">("Pending");
  const [kind, setKind] = useState<StudentRequestKind | "">("");
  const [classId, setClassId] = useState("");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<StudentRequest | null>(null);
  const [clash, setClash] = useState<{ item: StudentRequest; check: ScheduleCheck } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const action = useAction();
  const now = useNow();
  const list = useResource(
    () => academicsApi.listStudentRequests(centerId, { status: status === "All" ? undefined : status, kind: kind || undefined, classId: classId || undefined, page, pageSize: 25 }),
    [centerId, status, kind, classId, page],
  );

  function done(item: StudentRequest, result: StudentRequest) {
    const elsewhere = result.otherCenterConflictCount ?? 0;
    setNotice(`Đã duyệt “${requestKindLabels[item.kind] ?? item.kind}” của ${item.studentName ?? "học sinh"}.` +
      (item.kind === "Transfer" ? ` Học sinh đã chuyển sang ${item.targetClassName}.` : "") +
      (item.kind === "Withdrawal" ? " Học sinh đã rời lớp; lịch sử vẫn được giữ." : "") +
      (item.kind === "Makeup" ? " Hãy xếp buổi học bù trên Lịch dạy." : "") +
      (elsewhere > 0 ? ` Lớp mới trùng ${elsewhere} buổi với lịch ở nơi khác của học sinh.` : ""));
    void list.reload();
  }

  async function approve(item: StudentRequest) {
    setBusyId(item.id);
    let blocked: ScheduleCheck | null = null;
    const result = await action.run(async () => {
      try {
        return await academicsApi.approveStudentRequest(centerId, item.id, { expectedVersion: item.version });
      } catch (error) {
        blocked = scheduleCheckFrom(error);
        if (blocked) return undefined;
        throw error;
      }
    });
    setBusyId(null);
    if (blocked) setClash({ item, check: blocked });
    else if (result) done(item, result);
  }

  const data = list.data;
  return (
    <>
      {notice && <Notice tone="success" onDismiss={() => setNotice(null)}>{notice}</Notice>}
      <ErrorNotice error={action.error} onDismiss={action.clearError} onReload={() => void list.reload()} />
      <Panel flush>
        <div className="toolbar">
          <Segmented label="Trạng thái" value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={[
            { value: "Pending", label: "Chờ duyệt" }, { value: "Approved", label: "Đã duyệt" }, { value: "Rejected", label: "Từ chối" }, { value: "All", label: "Tất cả" },
          ]} />
          <label className="select-inline"><span>Loại</span>
            <select value={kind} onChange={(event) => { setKind(event.target.value as StudentRequestKind | ""); setPage(1); }}>
              <option value="">Mọi loại</option>
              {Object.entries(requestKindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="select-inline"><span>Lớp</span>
            <select value={classId} onChange={(event) => { setClassId(event.target.value); setPage(1); }}>
              <option value="">Mọi lớp</option>
              {(lookups.data?.classes ?? []).filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <Button size="sm" variant="ghost" icon={<RefreshCcw aria-hidden="true" />} onClick={() => void list.reload()} pending={list.loading && Boolean(data)}>Làm mới</Button>
        </div>
        <ErrorNotice error={list.error} onReload={() => void list.reload()} />
        {!data ? <SkeletonRows rows={5} columns={5} /> : data.items.length === 0 ? (
          <EmptyState icon={<Inbox aria-hidden="true" />} title={status === "Pending" ? "Không có yêu cầu chờ duyệt" : "Không có yêu cầu phù hợp"}>
            Học sinh gửi yêu cầu từ cổng học sinh, thường là khi trả lời thông báo đổi lịch.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Học sinh</th><th>Yêu cầu</th><th>Chi tiết</th><th>Gửi lúc</th><th>Trạng thái</th><th className="col-actions"><span className="sr-only">Thao tác</span></th></tr></thead>
              <tbody>
                {data.items.map((item) => {
                  const state = requestStatus[item.status] ?? { label: item.status, tone: "neutral" as const };
                  const sessionPassed = item.kind === "ExcusedAbsence" && item.sessionStartUtc && new Date(item.sessionStartUtc).getTime() < now;
                  return (
                    <tr key={item.id}>
                      <td><strong>{item.studentName}</strong></td>
                      <td><strong>{requestKindLabels[item.kind] ?? item.kind}</strong><p className="cell-note">{item.className}</p></td>
                      <td>
                        {item.sessionStartUtc && item.sessionEndUtc && <p>Buổi {formatSlot(item.sessionStartUtc, item.sessionEndUtc)}{sessionPassed && <> <Badge tone="neutral">Đã qua giờ học</Badge></>}</p>}
                        {item.targetClassName && <p>Sang lớp {item.targetClassName}</p>}
                        <p className="cell-note">Lý do: {item.reason}</p>
                      </td>
                      <td className="col-muted">{formatDateTime(item.submittedAtUtc)}</td>
                      <td>
                        <Badge tone={state.tone}>{state.label}</Badge>
                        {item.reviewNote && <p className="cell-note">{item.reviewNote}</p>}
                        {item.reviewedAtUtc && item.reviewedByName && <p className="cell-note">{formatDateTime(item.reviewedAtUtc)} · {item.reviewedByName}</p>}
                      </td>
                      <td className="col-actions">
                        {item.status === "Pending" && (
                          <>
                            <Button size="sm" icon={<Check aria-hidden="true" />} status={busyId === item.id ? action.status : undefined} disabled={action.pending} onClick={() => void approve(item)}>Duyệt</Button>
                            <Button size="sm" variant="ghost" icon={<X aria-hidden="true" />} onClick={() => setRejecting(item)}>Từ chối</Button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pagination page={page} pageSize={data.pageSize} total={data.totalCount} onChange={setPage} />}
      </Panel>

      <ConflictConfirmDialog
        check={clash?.check ?? null}
        title="Lớp mới trùng lịch của học sinh"
        lead={clash ? `${clash.item.studentName} đang học lớp khác của trung tâm vào cùng giờ với ${clash.item.targetClassName}:` : ""}
        confirmLabel="Vẫn chuyển lớp"
        onClose={() => setClash(null)}
        onConfirm={async () => {
          if (!clash) return;
          const result = await academicsApi.approveStudentRequest(centerId, clash.item.id, { expectedVersion: clash.item.version, acknowledgeConflicts: true });
          done(clash.item, result);
        }}
      />
      <ReasonDialog
        open={Boolean(rejecting)}
        title="Từ chối yêu cầu"
        description={rejecting ? `${rejecting.studentName} sẽ thấy lý do này trong cổng học sinh.` : undefined}
        confirmLabel="Từ chối"
        variant="danger"
        maxLength={500}
        onClose={() => setRejecting(null)}
        onConfirm={async (reason) => {
          if (!rejecting) return;
          await academicsApi.rejectStudentRequest(centerId, rejecting.id, { expectedVersion: rejecting.version, reason });
          setNotice(`Đã từ chối yêu cầu của ${rejecting.studentName}.`);
          await list.reload();
        }}
      />
    </>
  );
}

function describeChange(item: ScheduleChange) {
  if (item.oldStartUtc && item.oldEndUtc && item.newStartUtc && item.newEndUtc)
    return `${formatSlot(item.oldStartUtc, item.oldEndUtc)} → ${formatSlot(item.newStartUtc, item.newEndUtc)}`;
  if (item.oldStartUtc && item.oldEndUtc) return formatSlot(item.oldStartUtc, item.oldEndUtc);
  if (item.newStartUtc && item.newEndUtc) return formatSlot(item.newStartUtc, item.newEndUtc);
  if (item.firstAffectedStartUtc) return `${item.affectedSessionCount} buổi, từ ${formatStartLabel(item.firstAffectedStartUtc)}`;
  return `${item.affectedSessionCount} buổi`;
}

/** "Toán 9A: 15 đã xem · 2 xin vắng · 1 xin học bù". */
function responseLine(item: ScheduleChange) {
  const r = item.responses;
  if (!r || r.notified === 0) return "Lớp chưa có học sinh nào cần báo.";
  const parts = [`${r.seen}/${r.notified - r.withoutAccount} đã xem`, `${r.acknowledged} xác nhận đi được`];
  for (const [kind, count] of Object.entries(r.requestsByKind)) parts.push(`${count} ${(requestKindLabels[kind] ?? kind).toLowerCase()}`);
  if (r.withoutAccount > 0) parts.push(`${r.withoutAccount} chưa có tài khoản (báo qua phụ huynh)`);
  return parts.join(" · ");
}

function ChangeLog() {
  const { centerId } = useCenter();
  const [page, setPage] = useState(1);
  const list = useResource(() => academicsApi.scheduleChanges(centerId, { page, pageSize: 20 }), [centerId, page]);
  const data = list.data;
  return (
    <Panel title="Đổi lịch gần đây" description="Mỗi lần thêm, dời, hủy buổi hoặc đổi lịch lặp đều được ghi lại và báo cho học sinh của lớp." flush
      actions={<Button size="sm" variant="ghost" icon={<RefreshCcw aria-hidden="true" />} onClick={() => void list.reload()} pending={list.loading && Boolean(data)}>Làm mới</Button>}>
      <ErrorNotice error={list.error} onReload={() => void list.reload()} />
      {!data ? <SkeletonRows rows={4} columns={3} /> : data.items.length === 0 ? (
        <EmptyState icon={<History aria-hidden="true" />} title="Chưa có thay đổi lịch nào được ghi lại" />
      ) : (
        <ul className="notice-list">
          {data.items.map((item) => (
            <li key={item.id}>
              <div className="notice-head">
                <strong>{changeKindLabels[item.kind] ?? item.kind} · {item.className ?? "Lớp"}</strong>
                {item.isUrgent && <Badge tone="danger">Báo gấp</Badge>}
                {item.responses && item.responses.pendingRequests > 0 && <Badge tone="warning">{item.responses.pendingRequests} yêu cầu chờ duyệt</Badge>}
              </div>
              <p className="notice-text">{describeChange(item)}{item.reason ? ` · Lý do: ${item.reason}` : ""}</p>
              <p className="cell-note">{responseLine(item)}</p>
              <p className="cell-note">{formatDateTime(item.createdAtUtc)}{item.actorName ? ` · ${item.actorName}` : ""}</p>
            </li>
          ))}
        </ul>
      )}
      {data && <Pagination page={page} pageSize={data.pageSize} total={data.totalCount} onChange={setPage} />}
    </Panel>
  );
}
