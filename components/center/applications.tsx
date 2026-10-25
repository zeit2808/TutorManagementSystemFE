"use client";

import { useState } from "react";
import { Check, Inbox, RefreshCcw, X } from "lucide-react";
import { academicsApi, type ClassApplication, type ClassApplicationStatus } from "@/lib/api";
import { useAction, useResource } from "@/lib/hooks/use-resource";
import { useCenterLookups } from "@/lib/hooks/use-lookups";
import { formatDateTime, formatPhone } from "@/lib/format";
import { applicationStatus } from "@/lib/labels";
import { Badge, Button, EmptyState, ErrorNotice, Meter, Notice, PageHeader, Pagination, Panel, Segmented, SkeletonRows } from "@/components/ui/primitives";
import { ReasonDialog } from "@/components/ui/reason-dialog";
import { ConflictConfirmDialog, scheduleCheckFrom } from "@/components/ui/conflict-dialog";
import type { ScheduleCheck } from "@/lib/api";
import { RoleGate, useCenter } from "./center-frame";

type Filter = ClassApplicationStatus | "All";

export function ApplicationsWorkspace() {
  return (
    <RoleGate need="manage">
      <ApplicationsInner />
    </RoleGate>
  );
}

function ApplicationsInner() {
  const { centerId } = useCenter();
  const [filter, setFilter] = useState<Filter>("Pending");
  const [page, setPage] = useState(1);
  const [rejecting, setRejecting] = useState<ClassApplication | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const approve = useAction();
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [clash, setClash] = useState<{ item: ClassApplication; check: ScheduleCheck } | null>(null);

  const lookups = useCenterLookups(centerId);
  const [classFilter, setClassFilter] = useState("");
  const list = useResource(
    () => academicsApi.listClassApplications(centerId, { status: filter === "All" ? undefined : filter, classId: classFilter || undefined, page, pageSize: 25 }),
    [centerId, filter, classFilter, page],
  );

  function approved(item: ClassApplication, result: ClassApplication) {
    const elsewhere = result.otherCenterConflictCount ?? 0;
    setNotice(`Đã nhận ${item.fullName} vào lớp. Hồ sơ học sinh được tạo hoặc dùng lại tự động.` +
      (elsewhere > 0 ? ` Lưu ý: học sinh có lịch ở nơi khác trùng ${elsewhere} buổi của lớp này.` : ""));
    void Promise.all([list.reload(), lookups.reload()]);
  }

  async function approveOne(item: ClassApplication) {
    setApprovingId(item.id);
    let blocked: ScheduleCheck | null = null;
    const result = await approve.run(async () => {
      try {
        return await academicsApi.approveClassApplication(centerId, item.id);
      } catch (error) {
        // B5: a clash with another class of this center needs an explicit confirmation.
        blocked = scheduleCheckFrom(error);
        if (blocked) return undefined;
        throw error;
      }
    });
    setApprovingId(null);
    if (blocked) setClash({ item, check: blocked });
    else if (result) approved(item, result);
  }

  const lk = lookups.data;

  return (
    <>
      <PageHeader
        title="Đơn đăng ký lớp"
        description="Học sinh đăng nhập Google nộp đơn cho các lớp đang mở. Mỗi lớp trong một lần nộp là một đơn riêng, duyệt độc lập."
        actions={<Button icon={<RefreshCcw aria-hidden="true" />} onClick={() => void list.reload()} pending={list.loading && Boolean(list.data)}>Làm mới</Button>}
      />
      {notice && <Notice tone="success" onDismiss={() => setNotice(null)}>{notice}</Notice>}
      <ErrorNotice error={list.error ?? lookups.error} onReload={() => void list.reload()} />
      <ErrorNotice error={approve.error} onDismiss={approve.clearError} onReload={() => void list.reload()} />

      <Panel flush>
        <div className="toolbar">
          <Segmented
            label="Trạng thái đơn"
            value={filter}
            onChange={(value) => { setFilter(value); setPage(1); }}
            options={[
              { value: "Pending", label: "Chờ duyệt" },
              { value: "Approved", label: "Đã nhận" },
              { value: "Rejected", label: "Từ chối" },
              { value: "All", label: "Tất cả" },
            ]}
          />
          <label className="select-inline">
            <span className="sr-only">Lọc theo lớp</span>
            <select value={classFilter} onChange={(event) => { setClassFilter(event.target.value); setPage(1); }}>
              <option value="">Mọi lớp</option>
              {(lk?.classes ?? []).filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
            </select>
          </label>
          <span className="toolbar-note">Lớp đầy: đơn vẫn ở trạng thái chờ để bạn tăng sĩ số hoặc từ chối.</span>
        </div>
        {!list.data || !lk ? (
          <SkeletonRows rows={6} columns={5} />
        ) : list.data.items.length === 0 ? (
          <EmptyState icon={<Inbox aria-hidden="true" />} title={filter === "Pending" ? "Không có đơn chờ duyệt" : "Không có đơn phù hợp"}>
            Học sinh chỉ thấy các lớp đang mở đăng ký và còn chỗ.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Học sinh</th><th>Lớp</th><th>Sĩ số lớp</th><th>Nộp lúc</th><th>Trạng thái</th><th className="col-actions"><span className="sr-only">Thao tác</span></th></tr></thead>
              <tbody>
                {list.data.items.map((item) => {
                  const teachingClass = lk.classById.get(item.classId);
                  const status = applicationStatus[item.status] ?? { label: item.status, tone: "neutral" as const };
                  const full = Boolean(teachingClass && teachingClass.enrolledCount >= teachingClass.maxStudents);
                  return (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.fullName}</strong>
                        {item.parentPhone && <p className="cell-note">Phụ huynh: {item.parentName} · <a className="text-link" href={`tel:${item.parentPhone}`}>{formatPhone(item.parentPhone)}</a></p>}
                      </td>
                      <td>{item.className ?? teachingClass?.name ?? "—"}<br /><code className="code">{item.classCode ?? teachingClass?.code}</code></td>
                      <td>{teachingClass ? <Meter value={teachingClass.enrolledCount} max={teachingClass.maxStudents} label="Sĩ số" /> : "—"}</td>
                      <td className="col-muted">{formatDateTime(item.submittedAtUtc)}</td>
                      <td>
                        <Badge tone={status.tone}>{status.label}</Badge>
                        {item.reviewReason && <p className="cell-note">Lý do: {item.reviewReason}</p>}
                        {item.reviewedAtUtc && <p className="cell-note">{formatDateTime(item.reviewedAtUtc)}{item.reviewedByName && ` · ${item.reviewedByName}`}</p>}
                      </td>
                      <td className="col-actions">
                        {item.status === "Pending" && (
                          <>
                            <Button
                              size="sm"
                              icon={<Check aria-hidden="true" />}
                              pending={approve.pending && approvingId === item.id}
                              disabled={approve.pending || full}
                              title={full ? "Lớp đã đủ sĩ số: tăng sĩ số ở trang lớp hoặc từ chối đơn." : undefined}
                              onClick={() => void approveOne(item)}
                            >
                              Nhận vào lớp
                            </Button>
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
        {list.data && <Pagination page={page} pageSize={list.data.pageSize} total={list.data.totalCount} onChange={setPage} />}
      </Panel>

      <ConflictConfirmDialog
        check={clash?.check ?? null}
        title="Học sinh bị trùng lịch"
        lead={clash ? `${clash.item.fullName} đang học lớp khác của trung tâm vào cùng giờ với ${clash.item.className ?? "lớp này"}:` : ""}
        confirmLabel="Vẫn nhận vào lớp"
        onClose={() => setClash(null)}
        onConfirm={async () => {
          if (!clash) return;
          const result = await academicsApi.approveClassApplication(centerId, clash.item.id, true);
          approved(clash.item, result);
        }}
      />

      <ReasonDialog
        open={Boolean(rejecting)}
        title="Từ chối đơn đăng ký"
        description={rejecting ? `${rejecting.fullName} sẽ thấy lý do này và có thể nộp lại khi lớp còn mở.` : undefined}
        confirmLabel="Từ chối đơn"
        variant="danger"
        maxLength={500}
        onClose={() => setRejecting(null)}
        onConfirm={async (reason) => {
          if (!rejecting) return;
          await academicsApi.rejectClassApplication(centerId, rejecting.id, reason);
          setNotice(`Đã từ chối đơn của ${rejecting.fullName}.`);
          await list.reload();
        }}
      />
    </>
  );
}
