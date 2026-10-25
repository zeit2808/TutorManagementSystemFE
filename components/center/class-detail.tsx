"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Archive, ArchiveRestore, ArrowLeft, CalendarRange, DoorClosed, DoorOpen, Pencil, Search, UserMinus, UserPlus, UsersRound } from "lucide-react";
import { academicsApi, type ClassStudent, type ScheduleCheck, type Student, type TeachingClass } from "@/lib/api";
import { useAction, useResource } from "@/lib/hooks/use-resource";
import { fetchAllPages } from "@/lib/hooks/use-lookups";
import { formatDateTime } from "@/lib/format";
import { Badge, Button, ButtonLink, Dialog, EmptyState, ErrorNotice, KeyValue, Meter, Notice, PageHeader, Pagination, Panel, Segmented, SkeletonRows, StateRail } from "@/components/ui/primitives";
import { ConfirmDialog, ReasonDialog } from "@/components/ui/reason-dialog";
import { ConflictConfirmDialog, scheduleCheckFrom } from "@/components/ui/conflict-dialog";
import { ClassEditor } from "./classes";
import { useCenter } from "./center-frame";
import { ClassInvitesPanel } from "./student-access";

type EnrollmentFilter = "active" | "withdrawn" | "all";

export function ClassDetail({ classId }: { classId: string }) {
  const { centerId, canManage } = useCenter();
  const [filter, setFilter] = useState<EnrollmentFilter>("active");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<"archive" | "reactivate" | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [withdrawing, setWithdrawing] = useState<ClassStudent | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const registration = useAction();

  const detail = useResource(async () => {
    const [teachingClass, subjects] = await Promise.all([academicsApi.getClass(centerId, classId), academicsApi.listAllSubjects(centerId, true)]);
    return { teachingClass, subjects };
  }, [centerId, classId]);
  const enrollments = useResource(() => academicsApi.listEnrollments(centerId, classId, { status: filter, page, pageSize: 25 }), [centerId, classId, filter, page]);

  const teachingClass = detail.data?.teachingClass;
  const subject = detail.data?.subjects.find((item) => item.id === teachingClass?.subjectId);

  function patchClass(next: TeachingClass) {
    detail.setData((current) => (current ? { ...current, teachingClass: next } : current!));
  }

  async function toggleRegistration() {
    if (!teachingClass) return;
    const result = await registration.run(() =>
      academicsApi.setClassRegistration(centerId, classId, !teachingClass.registrationOpen, teachingClass.version),
    );
    if (result) {
      // The endpoint returns the class with its new version, so later edits keep a fresh expectedVersion.
      patchClass(result);
      setNotice(result.registrationOpen ? "Lớp đã mở nhận đơn đăng ký trực tuyến." : "Lớp đã đóng đăng ký. Đơn đang chờ vẫn được giữ để duyệt.");
    }
  }

  if (!teachingClass) {
    return (
      <>
        <PageHeader title="Chi tiết lớp" />
        <ErrorNotice error={detail.error} onReload={() => void detail.reload()} />
        {!detail.error && <SkeletonRows rows={4} columns={3} />}
      </>
    );
  }

  const full = teachingClass.enrolledCount >= teachingClass.maxStudents;

  return (
    <>
      <Link className="back-link" href={`/centers/${centerId}/classes`}><ArrowLeft aria-hidden="true" />Tất cả lớp</Link>
      <PageHeader
        title={teachingClass.name}
        description={<><code className="code">{teachingClass.code}</code> · {subject?.name ?? "Môn không xác định"}</>}
        meta={
          <StateRail
            label="Vòng đời lớp"
            current={!teachingClass.isActive ? "archived" : teachingClass.registrationOpen ? "open" : "closed"}
            steps={[
              { id: "closed", label: "Hoạt động · đóng đăng ký", tone: "neutral" },
              { id: "open", label: "Hoạt động · mở đăng ký", tone: "success" },
              { id: "archived", label: "Đã lưu trữ", tone: "neutral" },
            ]}
          />
        }
        actions={
          canManage && (
            <>
              <ButtonLink href={`/centers/${centerId}/schedule/series?classId=${classId}`} icon={<CalendarRange aria-hidden="true" />}>Lịch lặp của lớp</ButtonLink>
              {teachingClass.isActive ? (
                <>
                  <Button icon={<Pencil aria-hidden="true" />} onClick={() => setEditing(true)}>Sửa lớp</Button>
                  <Button icon={<Archive aria-hidden="true" />} onClick={() => setConfirm("archive")}>Lưu trữ</Button>
                </>
              ) : (
                <Button variant="primary" icon={<ArchiveRestore aria-hidden="true" />} onClick={() => setConfirm("reactivate")}>Khôi phục lớp</Button>
              )}
            </>
          )
        }
      />
      {notice && <Notice tone="success" onDismiss={() => setNotice(null)}>{notice}</Notice>}
      <ErrorNotice error={detail.error} onReload={() => void detail.reload()} />

      <div className="detail-grid">
        <Panel title="Sĩ số & tuyển sinh">
          <div className="panel-body stack">
            <Meter value={teachingClass.enrolledCount} max={teachingClass.maxStudents} label="Sĩ số" />
            <KeyValue
              items={[
                { label: "Đang học", value: `${teachingClass.enrolledCount} học sinh` },
                { label: "Sĩ số tối đa", value: teachingClass.maxStudents },
                { label: "Còn trống", value: Math.max(0, teachingClass.maxStudents - teachingClass.enrolledCount) },
                { label: "Phiên bản", value: teachingClass.version },
              ]}
            />
            {full && <Notice tone="warning">Lớp đã đủ sĩ số: ghi danh mới và duyệt đơn sẽ bị từ chối cho tới khi tăng sĩ số.</Notice>}
            {canManage && teachingClass.isActive && (
              <div className="inline-action">
                <div>
                  <strong>{teachingClass.registrationOpen ? "Đang nhận đơn trực tuyến" : "Không nhận đơn trực tuyến"}</strong>
                  <p>{teachingClass.registrationOpen ? "Học sinh đăng nhập Google thấy lớp này khi còn chỗ." : "Đóng không xoá các đơn đang chờ duyệt."}</p>
                </div>
                <Button variant={teachingClass.registrationOpen ? "secondary" : "primary"} icon={teachingClass.registrationOpen ? <DoorClosed aria-hidden="true" /> : <DoorOpen aria-hidden="true" />} pending={registration.pending} onClick={() => void toggleRegistration()}>
                  {teachingClass.registrationOpen ? "Đóng đăng ký" : "Mở đăng ký"}
                </Button>
              </div>
            )}
            <ErrorNotice error={registration.error} onDismiss={registration.clearError} onReload={() => void detail.reload()} />
          </div>
        </Panel>

        <Panel
          title="Học sinh trong lớp"
          description="Rút học giữ lại lịch sử ghi danh và giảm sĩ số."
          flush
          actions={
            <>
              <Segmented label="Lọc ghi danh" value={filter} onChange={(value) => { setFilter(value); setPage(1); }} options={[{ value: "active", label: "Đang học" }, { value: "withdrawn", label: "Đã rút" }, { value: "all", label: "Tất cả" }]} />
              {canManage && teachingClass.isActive && <Button variant="primary" size="sm" icon={<UserPlus aria-hidden="true" />} disabled={full} onClick={() => setEnrolling(true)}>Ghi danh</Button>}
            </>
          }
        >
          <ErrorNotice error={enrollments.error} onReload={() => void enrollments.reload()} />
          {!enrollments.data ? (
            <SkeletonRows rows={5} columns={4} />
          ) : enrollments.data.items.length === 0 ? (
            <EmptyState icon={<UsersRound aria-hidden="true" />} title={filter === "withdrawn" ? "Chưa có học sinh rút khỏi lớp" : "Lớp chưa có học sinh"}>
              {filter === "active" ? "Ghi danh hồ sơ tạo tại trung tâm, hoặc duyệt đơn của học sinh có tài khoản." : undefined}
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th className="col-code">Mã</th><th>Họ và tên</th><th>Ghi danh lúc</th><th>Trạng thái</th>{canManage && <th className="col-actions"><span className="sr-only">Thao tác</span></th>}</tr></thead>
                <tbody>
                  {enrollments.data.items.map((row) => (
                    <tr key={row.enrollmentId}>
                      <td className="col-code"><code className="code">{row.studentCode}</code></td>
                      <td><strong>{row.fullName}</strong></td>
                      <td className="col-muted">
                        {formatDateTime(row.enrolledAtUtc)}
                        {row.withdrawnAtUtc && <><br />Rút: {formatDateTime(row.withdrawnAtUtc)}{row.withdrawnByName && ` · ${row.withdrawnByName}`}</>}
                        {row.withdrawalReason && <p className="cell-note">Lý do: {row.withdrawalReason}</p>}
                      </td>
                      <td>{row.status === "Active" ? <Badge tone="success">Đang học</Badge> : <Badge tone="neutral">Đã rút</Badge>}</td>
                      {canManage && <td className="col-actions">{row.status === "Active" && <Button size="sm" variant="ghost" icon={<UserMinus aria-hidden="true" />} onClick={() => setWithdrawing(row)}>Rút khỏi lớp</Button>}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {enrollments.data && <Pagination page={page} pageSize={enrollments.data.pageSize} total={enrollments.data.totalCount} onChange={setPage} />}
        </Panel>
        {canManage && <ClassInvitesPanel teachingClass={teachingClass} />}
      </div>

      {editing && detail.data && (
        <ClassEditor
          subjects={detail.data.subjects}
          item={teachingClass}
          onClose={() => setEditing(false)}
          onStale={() => void detail.reload()}
          onSaved={(saved) => {
            setEditing(false);
            patchClass(saved);
            setNotice("Đã cập nhật lớp.");
          }}
        />
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "archive" ? "Lưu trữ lớp?" : "Khôi phục lớp?"}
        confirmLabel={confirm === "archive" ? "Lưu trữ" : "Khôi phục"}
        variant={confirm === "archive" ? "danger" : "primary"}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          const saved = confirm === "archive"
            ? await academicsApi.archiveClass(centerId, classId, teachingClass.version)
            : await academicsApi.reactivateClass(centerId, classId, teachingClass.version);
          patchClass(saved);
          setNotice(confirm === "archive" ? "Lớp đã được lưu trữ và đóng đăng ký." : "Lớp đã hoạt động trở lại.");
        }}
      >
        <p>
          {confirm === "archive"
            ? "Chỉ lưu trữ được lớp không còn học sinh đang học và không còn buổi học sắp tới. Lớp lưu trữ tự đóng đăng ký."
            : "Môn học của lớp phải còn hoạt động. Lớp khôi phục vẫn đóng đăng ký cho tới khi bạn mở lại."}
        </p>
      </ConfirmDialog>

      <ReasonDialog
        open={Boolean(withdrawing)}
        title="Rút học sinh khỏi lớp?"
        label="Lý do rút học"
        placeholder="Ví dụ: Gia đình chuyển nhà, xin nghỉ hẳn"
        confirmLabel="Rút khỏi lớp"
        variant="danger"
        maxLength={500}
        onClose={() => setWithdrawing(null)}
        onConfirm={async (reason) => {
          if (!withdrawing) return;
          await academicsApi.withdrawStudent(centerId, classId, withdrawing.studentId, reason);
          setNotice(`Đã rút ${withdrawing.fullName} khỏi lớp.`);
          await Promise.all([detail.reload(), enrollments.reload()]);
        }}
      >
        {withdrawing && <p><strong>{withdrawing.fullName}</strong> rời lớp ngay bây giờ: không còn trong danh sách điểm danh của các buổi bắt đầu sau thời điểm này. Các buổi đã học và lịch sử ghi danh được giữ lại.</p>}
      </ReasonDialog>

      {enrolling && (
        <EnrollDialog
          teachingClass={teachingClass}
          onClose={() => setEnrolling(false)}
          onEnrolled={async (student, elsewhere) => {
            setEnrolling(false);
            setNotice(`Đã ghi danh ${student.fullName}.` + (elsewhere > 0 ? ` Học sinh có lịch ở nơi khác trùng ${elsewhere} buổi của lớp.` : ""));
            setFilter("active");
            await Promise.all([detail.reload(), enrollments.reload()]);
          }}
        />
      )}
    </>
  );
}

function EnrollDialog({ teachingClass, onClose, onEnrolled }: { teachingClass: TeachingClass; onClose: () => void; onEnrolled: (student: Student, otherCenterConflicts: number) => void }) {
  const { centerId } = useCenter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Student | null>(null);
  const action = useAction();

  const data = useResource(async () => {
    const [students, active] = await Promise.all([
      fetchAllPages((page) => academicsApi.listStudents(centerId, { page, pageSize: 100 })),
      fetchAllPages((page) => academicsApi.listEnrollments(centerId, teachingClass.id, { status: "active", page, pageSize: 100 })),
    ]);
    return { students, enrolled: new Set(active.map((row) => row.studentId)) };
  }, [centerId, teachingClass.id]);

  const candidates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data.data?.students ?? [])
      .filter((student) => !needle || `${student.code} ${student.fullName}`.toLowerCase().includes(needle))
      .slice(0, 60);
  }, [data.data, query]);

  const [clash, setClash] = useState<ScheduleCheck | null>(null);

  async function submit() {
    if (!selected) return;
    let blocked: ScheduleCheck | null = null;
    const result = await action.run(async () => {
      try {
        return await academicsApi.enrollStudent(centerId, teachingClass.id, selected.id);
      } catch (error) {
        // B5: clashes with the student's other classes here need an explicit confirmation.
        blocked = scheduleCheckFrom(error);
        if (blocked) return undefined;
        throw error;
      }
    });
    if (blocked) setClash(blocked);
    else if (result) onEnrolled(selected, result.otherCenterConflictCount ?? 0);
  }

  return (
    <>
    <Dialog
      open
      size="lg"
      title={`Ghi danh vào ${teachingClass.name}`}
      description={`Còn ${Math.max(0, teachingClass.maxStudents - teachingClass.enrolledCount)} chỗ. Học sinh đã kích hoạt tài khoản sẽ nhận thông báo được thêm vào lớp.`}
      onClose={onClose}
      onSubmit={submit}
      footer={<><Button onClick={onClose} disabled={action.pending}>Hủy</Button><Button type="submit" variant="primary" disabled={!selected} pending={action.pending}>Ghi danh {selected ? selected.fullName : ""}</Button></>}
    >
      <label className="search search-block">
        <Search aria-hidden="true" />
        <span className="sr-only">Tìm học sinh</span>
        <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo mã hoặc họ tên…" />
      </label>
      <ErrorNotice error={data.error} onReload={() => void data.reload()} />
      {!data.data ? (
        <SkeletonRows rows={5} columns={3} />
      ) : candidates.length === 0 ? (
        <EmptyState icon={<Search aria-hidden="true" />} title="Không tìm thấy học sinh đang hoạt động">Tạo hồ sơ ở mục Học sinh rồi quay lại ghi danh.</EmptyState>
      ) : (
        <ul className="pick-list" role="listbox" aria-label="Chọn học sinh">
          {candidates.map((student) => {
            const enrolled = data.data!.enrolled.has(student.id);
            const blocked = enrolled;
            return (
              <li key={student.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected?.id === student.id}
                  disabled={blocked}
                  className={selected?.id === student.id ? "selected" : ""}
                  onClick={() => setSelected(student)}
                >
                  <code className="code">{student.code}</code>
                  <strong>{student.fullName}</strong>
                  {enrolled ? <Badge tone="success">Đã trong lớp</Badge> : student.hasAccount ? <Badge tone="info">Có tài khoản · sẽ được báo</Badge> : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <ErrorNotice error={action.error} />
    </Dialog>
      <ConflictConfirmDialog
        check={clash}
        title="Học sinh bị trùng lịch"
        lead={`${selected?.fullName ?? "Học sinh"} đang học lớp khác của trung tâm vào cùng giờ với ${teachingClass.name}:`}
        confirmLabel="Vẫn ghi danh"
        onClose={() => setClash(null)}
        onConfirm={async () => {
          if (!selected) return;
          const result = await academicsApi.enrollStudent(centerId, teachingClass.id, selected.id, true);
          setClash(null);
          onEnrolled(selected, result.otherCenterConflictCount ?? 0);
        }}
      />
    </>
  );
}
