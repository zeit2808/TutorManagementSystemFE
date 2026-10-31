"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Plus, Presentation, RefreshCcw, Search } from "lucide-react";
import { academicsApi, type Subject, type TeachingClass } from "@/lib/api";
import { useAction, useResource } from "@/lib/hooks/use-resource";
import { validateName } from "@/lib/validation";
import { Badge, Button, Dialog, EmptyState, ErrorNotice, Field, Meter, Notice, PageHeader, Pagination, Panel, SkeletonRows, Toggle, ButtonLink } from "@/components/ui/primitives";
import { useCenter } from "./center-frame";

const PAGE_SIZE = 25;

export function ClassesWorkspace() {
  const { centerId, canManage } = useCenter();
  const [page, setPage] = useState(1);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const subjects = useResource(() => academicsApi.listAllSubjects(centerId, true), [centerId]);
  // Search runs on the server once typing pauses, so it covers every page.
  const [search, setSearch] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = query.trim();
      if (next !== search) {
        setSearch(next);
        setPage(1);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, search]);
  const classes = useResource(
    () => academicsApi.listClasses(centerId, { page, pageSize: PAGE_SIZE, includeArchived, search: search || undefined }),
    [centerId, page, includeArchived, search],
  );
  const subjectById = useMemo(() => new Map((subjects.data ?? []).map((item) => [item.id, item])), [subjects.data]);

  const rows = useMemo(
    () => (classes.data?.items ?? []).filter((item) => !subjectFilter || item.subjectId === subjectFilter),
    [classes.data, subjectFilter],
  );

  return (
    <>
      <PageHeader
        title="Lớp học"
        description="Mỗi lớp thuộc một môn, có sĩ số tối đa 1–500 và tự quyết định mở hay đóng đăng ký trực tuyến."
        actions={
          <>
            <Button icon={<RefreshCcw aria-hidden="true" />} onClick={() => void classes.reload()} pending={classes.loading && Boolean(classes.data)}>Làm mới</Button>
            {canManage && <Button variant="primary" icon={<Plus aria-hidden="true" />} onClick={() => setCreating(true)}>Mở lớp mới</Button>}
          </>
        }
      />
      {notice && <Notice tone="success" onDismiss={() => setNotice(null)}>{notice}</Notice>}
      <ErrorNotice error={classes.error ?? subjects.error} onReload={() => void classes.reload()} />

      <Panel flush>
        <div className="toolbar">
          <label className="search">
            <Search aria-hidden="true" />
            <span className="sr-only">Tìm lớp</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên lớp…" />
          </label>
          <label className="select-inline">
            <span>Môn</span>
            <select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}>
              <option value="">Tất cả môn</option>
              {(subjects.data ?? []).map((subject) => <option key={subject.id} value={subject.id}>{subject.name}{subject.isActive ? "" : " (đã lưu trữ)"}</option>)}
            </select>
          </label>
          <Toggle checked={includeArchived} onChange={(value) => { setIncludeArchived(value); setPage(1); }} label="Hiện lớp đã lưu trữ" />
        </div>

        {!classes.data ? (
          <SkeletonRows rows={6} columns={6} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Presentation aria-hidden="true" />}
            title={query || subjectFilter ? "Không có lớp phù hợp bộ lọc" : "Chưa có lớp học"}
            action={canManage && !query && !subjectFilter ? <Button variant="primary" icon={<Plus aria-hidden="true" />} onClick={() => setCreating(true)}>Mở lớp đầu tiên</Button> : undefined}
          >
            {query || subjectFilter ? "Bỏ bớt điều kiện lọc để xem thêm lớp." : "Cần có ít nhất một môn học đang hoạt động trước khi mở lớp."}
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Tên lớp</th><th>Môn</th><th>Sĩ số</th><th>Đăng ký trực tuyến</th><th>Trạng thái</th><th className="col-actions"><span className="sr-only">Mở</span></th></tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id} className={item.isActive ? "" : "is-archived"}>
                    <td><Link className="row-link" href={`/centers/${centerId}/classes/${item.id}`}>{item.name}</Link></td>
                    <td className="col-muted">{subjectById.get(item.subjectId)?.name ?? "—"}</td>
                    <td><Meter value={item.enrolledCount} max={item.maxStudents} label={`Sĩ số lớp ${item.name}`} /></td>
                    <td>{item.registrationOpen ? <Badge tone="success">Đang mở</Badge> : <Badge tone="neutral">Đóng</Badge>}</td>
                    <td>{item.isActive ? <Badge tone="success">Đang hoạt động</Badge> : <Badge tone="neutral">Đã lưu trữ</Badge>}</td>
                    <td className="col-actions"><ButtonLink size="sm" variant="soft" href={`/centers/${centerId}/classes/${item.id}`} trailing={<ArrowRight aria-hidden="true" />}>Chi tiết</ButtonLink></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {classes.data && <Pagination page={page} pageSize={classes.data.pageSize} total={classes.data.totalCount} onChange={setPage} />}
      </Panel>

      {creating && (
        <ClassEditor
          subjects={(subjects.data ?? []).filter((item) => item.isActive)}
          onClose={() => setCreating(false)}
          onSaved={(created) => {
            setCreating(false);
            setNotice(`Đã mở lớp ${created.name}. Lớp mặc định đóng đăng ký trực tuyến.`);
            void classes.reload();
          }}
        />
      )}
    </>
  );
}

export function ClassEditor({ subjects, item, onClose, onSaved, onStale }: { subjects: Subject[]; item?: TeachingClass; onClose: () => void; onSaved: (saved: TeachingClass) => void; onStale?: () => void }) {
  const { centerId } = useCenter();
  const [subjectId, setSubjectId] = useState(item?.subjectId ?? subjects[0]?.id ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [maxStudents, setMaxStudents] = useState(String(item?.maxStudents ?? 20));
  const [touched, setTouched] = useState(false);
  const action = useAction();

  const capacity = Number(maxStudents);
  const errors = {
    subject: item ? null : subjectId ? null : "Chọn môn học đang hoạt động.",
    name: validateName(name, "Tên lớp"),
    maxStudents: !Number.isInteger(capacity) || capacity < 1 || capacity > 500
      ? "Sĩ số tối đa từ 1 đến 500."
      : item && capacity < item.enrolledCount ? `Không thấp hơn số học sinh đang học (${item.enrolledCount}).` : null,
  };
  const invalid = Object.values(errors).some(Boolean);

  async function submit() {
    setTouched(true);
    if (invalid) return;
    const saved = await action.run(() =>
      item
        ? academicsApi.updateClass(centerId, item.id, { name: name.trim(), maxStudents: capacity, expectedVersion: item.version })
        : academicsApi.createClass(centerId, { subjectId, name: name.trim(), maxStudents: capacity }),
    );
    if (saved) onSaved(saved);
  }

  return (
    <Dialog
      open
      title={item ? "Sửa lớp học" : "Mở lớp mới"}
      description={item ? "Môn học cố định sau khi tạo." : "Lớp mới mặc định đóng đăng ký; mở đăng ký ở trang chi tiết lớp."}
      onClose={onClose}
      onSubmit={submit}
      footer={<><Button onClick={onClose} disabled={action.pending}>Hủy</Button><Button type="submit" variant="primary" pending={action.pending} status={action.status}>{item ? "Lưu thay đổi" : "Mở lớp"}</Button></>}
    >
      {!item && subjects.length === 0 && <Notice tone="warning">Trung tâm chưa có môn học đang hoạt động. Hãy thêm môn học trước.</Notice>}
      <div className="form-grid">
        {!item && (
          <Field label="Môn học" required error={touched ? errors.subject : null}>
            {(id) => (
              <select id={id} value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
                {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
              </select>
            )}
          </Field>
        )}
        <Field label="Tên lớp" required error={touched ? errors.name : null} className={item ? "span-2" : undefined}>
          {(id) => <input id={id} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} />}
        </Field>
        <Field label="Sĩ số tối đa" required hint={item ? `Đang có ${item.enrolledCount} học sinh.` : "1–500 học sinh."} error={touched ? errors.maxStudents : null}>
          {(id, describedBy) => <input id={id} aria-describedby={describedBy} type="number" min={item?.enrolledCount || 1} max={500} value={maxStudents} onChange={(event) => setMaxStudents(event.target.value)} />}
        </Field>
      </div>
      <ErrorNotice error={action.error} onReload={onStale} />
    </Dialog>
  );
}
