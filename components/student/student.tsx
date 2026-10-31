"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, BookOpen, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, GraduationCap, LoaderCircle, LogOut, School, Search, Send, ShieldAlert, UserCog, Users, WalletCards } from "lucide-react";
import { academicsApi, authApi, type ClassApplication, type DirectoryCenter, type DirectoryClass, type OpenClass } from "@/lib/api";
import { useSessionUser } from "@/lib/auth/session";
import { useAction, useResource } from "@/lib/hooks/use-resource";
import { useNow } from "@/lib/hooks/use-now";
import { addDays, formatDateOnly, formatDateTime, formatDuration, formatDayMonth, formatTimeRange, formatWeekday, isSameLocalDay, newUuid, startOfWeek, formatDate } from "@/lib/format";
import { applicationStatus } from "@/lib/labels";
import { validateName, validateVietnamMobile } from "@/lib/validation";
import { Badge, Button, EmptyState, ErrorNotice, Field, Meter, Notice, PageHeader, Pagination, Panel, Segmented, SkeletonRows, BackButton } from "@/components/ui/primitives";
import { ConflictList } from "@/components/ui/conflict-dialog";

const RECENT_KEY = "tm.student.recentCenters";
const GUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && GUID.test(item)).slice(0, 5) : [];
  } catch {
    return [];
  }
}

function rememberCenter(centerId: string) {
  try {
    const next = [centerId, ...readRecent().filter((item) => item !== centerId)].slice(0, 5);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: the link still works */
  }
}

export function StudentFrame({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, status } = useSessionUser();

  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [pathname, router, status]);

  if (status !== "ready") return <main className="standalone-state"><LoaderCircle className="spin" aria-hidden="true" /><h1>Đang mở cổng học sinh</h1></main>;
  if (!user?.isStudent) {
    return (
      <main className="standalone-state">
        <ShieldAlert aria-hidden="true" />
        <h1>Cổng chỉ dành cho tài khoản học sinh</h1>
        <p>Bạn đang đăng nhập bằng tài khoản nhân sự trung tâm. Tài khoản học sinh và tài khoản nhân sự là hai loại riêng: muốn đi học, hãy đăng xuất rồi đăng nhập bằng một tài khoản Google khác, không trùng email nhân sự.</p>
        <div className="standalone-actions">
          <Link className="btn btn-primary" href="/select-center">Về trang chính</Link>
        </div>
      </main>
    );
  }

  async function logout() {
    await authApi.logout();
    router.replace("/login");
  }

  return (
    <div className="student-app">
      <header className="student-bar">
        <Link className="brand brand-dark" href="/student"><span className="brand-mark"><BookOpen aria-hidden="true" /></span><strong>Quản Lý Dạy Thêm</strong></Link>
        <nav>
          <Link href="/student" aria-current={pathname === "/student" ? "page" : undefined}><CalendarDays aria-hidden="true" /><span>Lịch học</span></Link>
          <Link href="/student/find" aria-current={pathname.startsWith("/student/find") || pathname.startsWith("/student/centers") ? "page" : undefined}><Search aria-hidden="true" /><span>Đăng ký học</span></Link>
          <Link href="/student/tuition" aria-current={pathname.startsWith("/student/tuition") ? "page" : undefined}><WalletCards aria-hidden="true" /><span>Học phí</span></Link>
          <Link href="/account/security"><UserCog aria-hidden="true" /><span>Tài khoản</span></Link>
          <button type="button" onClick={() => void logout()}><LogOut aria-hidden="true" /><span>Đăng xuất</span></button>
        </nav>
      </header>
      <main className="student-main">{children}</main>
    </div>
  );
}

export function StudentHome() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    const timer = window.setTimeout(() => setRecent(readRecent()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function open(event: React.FormEvent) {
    event.preventDefault();
    const match = value.match(GUID);
    if (!match) return setError("Dán đường dẫn đăng ký hoặc mã trung tâm (dạng xxxxxxxx-xxxx-…) do trung tâm gửi.");
    router.push(`/student/centers/${match[0].toLowerCase()}`);
  }

  return (
    <>
      <PageHeader title="Đăng ký học" description="Tìm trung tâm theo tên hoặc môn học, xem lớp đang tuyển rồi nộp đơn. Nếu trung tâm gửi cho bạn đường dẫn riêng, dán vào ô bên dưới." actions={<Link className="btn btn-secondary" href="/student"><CalendarDays aria-hidden="true" />Lịch học của tôi</Link>} />
      <CenterDirectory />
      <div className="detail-grid">
        <Panel title="Vào trung tâm bằng đường dẫn">
          <form className="panel-body stack" onSubmit={open} noValidate>
            <Field label="Đường dẫn hoặc mã trung tâm" required error={error}>
              {(id) => <input id={id} value={value} onChange={(event) => { setValue(event.target.value); setError(null); }} placeholder="https://…/student/centers/…" />}
            </Field>
            <Button type="submit" variant="primary" icon={<ArrowRight aria-hidden="true" />}>Mở trung tâm</Button>
          </form>
        </Panel>
        <Panel title="Trung tâm đã mở gần đây" flush>
          {recent.length === 0 ? (
            <EmptyState icon={<School aria-hidden="true" />} title="Chưa có trung tâm nào">Danh sách được lưu trên trình duyệt này sau khi bạn mở một trung tâm.</EmptyState>
          ) : (
            <ul className="link-list">
              {recent.map((centerId) => (
                <li key={centerId}><Link href={`/student/centers/${centerId}`}><School aria-hidden="true" /><span>Trung tâm <code className="code">{centerId.slice(0, 8)}</code></span><ArrowRight aria-hidden="true" /></Link></li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

const WEEKDAY_LABELS: Record<string, string> = {
  Monday: "Thứ 2", Tuesday: "Thứ 3", Wednesday: "Thứ 4", Thursday: "Thứ 5", Friday: "Thứ 6", Saturday: "Thứ 7", Sunday: "Chủ nhật",
};

function weeklyText(item: DirectoryClass) {
  if (item.weeklySchedule.length === 0) return "Chưa có lịch cố định";
  return item.weeklySchedule
    .map((slot) => `${WEEKDAY_LABELS[slot.weekday] ?? slot.weekday} ${slot.startTime.slice(0, 5)} (${formatDuration(slot.durationMinutes)})`)
    .join(" · ");
}

/** D4: centers that opted in, with only the classes open for registration. */
function CenterDirectory() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(query.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);
  const subjects = useResource(() => academicsApi.directorySubjects(), []);
  const centers = useResource(
    () => academicsApi.directoryCenters({ search: search || undefined, subject: subject || undefined, page, pageSize: 10 }),
    [search, subject, page],
  );

  return (
    <Panel title="Tìm trung tâm" description="Chỉ hiện trung tâm đã bật hiển thị trong danh bạ và các lớp đang mở đăng ký, còn chỗ." flush>
      <div className="toolbar">
        <label className="search">
          <Search aria-hidden="true" />
          <span className="sr-only">Tìm theo tên trung tâm hoặc lớp</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tên trung tâm hoặc tên lớp…" />
        </label>
        <label className="select-inline"><span>Môn</span>
          <select value={subject} onChange={(event) => { setSubject(event.target.value); setPage(1); }}>
            <option value="">Tất cả môn</option>
            {(subjects.data ?? []).map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
      </div>
      <ErrorNotice error={centers.error} onReload={() => void centers.reload()} />
      {!centers.data ? (
        <SkeletonRows rows={3} columns={2} />
      ) : centers.data.items.length === 0 ? (
        <EmptyState icon={<School aria-hidden="true" />} title={search || subject ? "Không có trung tâm phù hợp" : "Chưa có trung tâm nào trong danh bạ"}>
          Thử từ khoá hoặc môn khác, hoặc dùng đường dẫn trung tâm gửi cho bạn.
        </EmptyState>
      ) : (
        <ul className="directory-list">
          {centers.data.items.map((center) => (
            <DirectoryCenterItem key={center.id} center={center} subject={subject} open={expanded === center.id} onToggle={() => setExpanded(expanded === center.id ? null : center.id)} />
          ))}
        </ul>
      )}
      {centers.data && <Pagination page={page} pageSize={centers.data.pageSize} total={centers.data.totalCount} onChange={setPage} />}
    </Panel>
  );
}

function DirectoryCenterItem({ center, subject, open, onToggle }: { center: DirectoryCenter; subject: string; open: boolean; onToggle: () => void }) {
  return (
    <li className={`directory-item${open ? " is-open" : ""}`}>
      <button type="button" className="directory-head" aria-expanded={open} onClick={onToggle}>
        <School aria-hidden="true" />
        <span>
          <strong>{center.name}</strong>
          <small>{center.openClassCount > 0 ? `${center.openClassCount} lớp đang tuyển` : "Chưa có lớp đang tuyển"}{center.subjects.length > 0 && ` · ${center.subjects.join(", ")}`}</small>
        </span>
        <ChevronDown aria-hidden="true" className="directory-chevron" />
      </button>
      {open && <DirectoryClasses centerId={center.id} subject={subject} />}
    </li>
  );
}

function DirectoryClasses({ centerId, subject }: { centerId: string; subject: string }) {
  const detail = useResource(() => academicsApi.directoryCenter(centerId, subject || undefined), [centerId, subject]);
  if (detail.error) return <ErrorNotice error={detail.error} onReload={() => void detail.reload()} />;
  if (!detail.data) return <SkeletonRows rows={2} columns={3} />;
  return (
    <div className="directory-classes">
      {detail.data.classes.length === 0 ? (
        <p className="panel-empty">Trung tâm chưa có lớp đang mở đăng ký{subject ? ` cho môn ${subject}` : ""}.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Lớp</th><th>Lịch hằng tuần</th><th>Giáo viên</th><th>Thời gian học</th><th>Còn chỗ</th></tr></thead>
            <tbody>
              {detail.data.classes.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.name}</strong><br /><span className="col-muted">{item.subjectName}</span></td>
                  <td>{weeklyText(item)}</td>
                  <td>{item.teacherNames.length ? item.teacherNames.join(", ") : <span className="col-muted">Chưa phân công</span>}</td>
                  <td className="col-muted">{item.startDate ? `${formatDateOnly(item.startDate)} – ${formatDateOnly(item.endDate)}` : "Chưa xếp buổi"}</td>
                  <td><Badge tone={item.seatsLeft <= 3 ? "warning" : "success"} icon={<Users aria-hidden="true" />}>{item.seatsLeft}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="directory-actions">
        <Link className="btn btn-primary" href={`/student/centers/${centerId}`}>Đăng ký tại trung tâm này <ArrowRight aria-hidden="true" /></Link>
      </div>
    </div>
  );
}

type Tab = "open" | "applications" | "classes" | "schedule";

export function StudentCenter({ centerId }: { centerId: string }) {
  const [tab, setTab] = useState<Tab>("open");
  useEffect(() => rememberCenter(centerId), [centerId]);
  const myClasses = useResource(() => academicsApi.myClasses(centerId), [centerId]);
  // The directory name is shown when the center is listed; otherwise only the code is known.
  const listed = useResource(() => academicsApi.directoryCenter(centerId).catch(() => null), [centerId]);

  return (
    <>
      <BackButton href="/student/find">Chọn trung tâm khác</BackButton>
      <PageHeader
        title={listed.data?.name ?? "Trung tâm của bạn"}
        description={<>Mã trung tâm <code className="code">{centerId}</code></>}
        meta={<Segmented label="Mục" value={tab} onChange={setTab} options={[
          { value: "open", label: "Lớp đang tuyển" },
          { value: "applications", label: "Đơn của tôi" },
          { value: "classes", label: "Lớp đang học", count: myClasses.data?.length },
          { value: "schedule", label: "Lịch học" },
        ]} />}
      />
      {tab === "open" && <OpenClasses centerId={centerId} enrolledIds={new Set((myClasses.data ?? []).map((item) => item.id))} onSubmitted={() => setTab("applications")} />}
      {tab === "applications" && <MyApplications centerId={centerId} />}
      {tab === "classes" && <MyClasses classes={myClasses.data} error={myClasses.error} reload={() => void myClasses.reload()} />}
      {tab === "schedule" && <MySchedule centerId={centerId} classes={myClasses.data ?? []} />}
    </>
  );
}

function OpenClasses({ centerId, enrolledIds, onSubmitted }: { centerId: string; enrolledIds: Set<string>; onSubmitted: () => void }) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fullName, setFullName] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const [submissionKey, setSubmissionKey] = useState(() => newUuid());
  const [result, setResult] = useState<ClassApplication[] | null>(null);
  const action = useAction();
  const open = useResource(() => academicsApi.listOpenClasses(centerId, { page, pageSize: 25 }), [centerId, page]);
  // F3: warn about clashes with the student's other classes (any center) before submitting; nothing is blocked.
  const selectedKey = Array.from(selected).sort().join(",");
  const check = useResource(
    () => selectedKey ? academicsApi.checkClassApplications(centerId, selectedKey.split(",")) : Promise.resolve(null),
    [centerId, selectedKey],
  );
  const conflictsByClass = new Map((check.data?.classes ?? []).map((item) => [item.classId, item.conflicts]));
  const clashing = Array.from(conflictsByClass.values()).filter((items) => items.length > 0).length;

  const nameError = validateName(fullName, "Họ và tên");
  const parentNameError = validateName(parentName, "Tên phụ huynh");
  const parentPhoneError = validateVietnamMobile(parentPhone, true);
  const selectionError = selected.size === 0 ? "Chọn ít nhất một lớp." : selected.size > 10 ? "Mỗi lần nộp tối đa 10 lớp." : null;

  function toggle(item: OpenClass) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
    setSubmissionKey(newUuid()); // different content → different idempotency key
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (nameError || parentNameError || parentPhoneError || selectionError) return;
    // Retrying with the same key and content returns the original result instead of duplicating.
    const created = await action.run(() => academicsApi.submitClassApplications(centerId, { fullName: fullName.trim(), parentName: parentName.trim(), parentPhone: parentPhone.replace(/[\s.()-]/g, ""), classIds: Array.from(selected) }, submissionKey));
    if (created) {
      setResult(created);
      setSelected(new Set());
      setSubmissionKey(newUuid());
      void open.reload();
    }
  }

  return (
    <div className="detail-grid detail-grid-wide">
      <Panel title="Lớp đang mở đăng ký" description="Chỉ hiện lớp còn chỗ. Mỗi lớp được trung tâm xét riêng." flush>
        <ErrorNotice error={open.error} onReload={() => void open.reload()} />
        {!open.data ? (
          <SkeletonRows rows={5} columns={3} />
        ) : open.data.items.length === 0 ? (
          <EmptyState icon={<School aria-hidden="true" />} title="Trung tâm chưa mở lớp nào">Quay lại sau hoặc liên hệ trung tâm.</EmptyState>
        ) : (
          <ul className="choice-list">
            {open.data.items.map((item) => {
              const enrolled = enrolledIds.has(item.id);
              const checked = selected.has(item.id);
              return (
                <li key={item.id}>
                  <label className={`choice${checked ? " checked" : ""}${enrolled ? " disabled" : ""}`}>
                    <input type="checkbox" checked={checked} disabled={enrolled} onChange={() => toggle(item)} />
                    <span className="choice-text"><strong>{item.name}</strong>
                      {checked && (conflictsByClass.get(item.id)?.length ?? 0) > 0 && <Badge tone="danger">Trùng {conflictsByClass.get(item.id)!.length} buổi</Badge>}
                    </span>
                    {enrolled ? <Badge tone="success">Đang học</Badge> : <Meter value={item.enrolledCount} max={item.maxStudents} label={`Sĩ số ${item.name}`} />}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        {open.data && <Pagination page={page} pageSize={open.data.pageSize} total={open.data.totalCount} onChange={setPage} />}
      </Panel>

      <Panel title="Nộp đơn">
        <form className="panel-body stack" onSubmit={submit} noValidate>
          {result && (
            <Notice tone="success" title={`Đã nộp ${result.length} đơn`} action={<Button size="sm" onClick={onSubmitted}>Xem đơn</Button>}>
              Trung tâm sẽ duyệt từng lớp; bạn theo dõi kết quả ở mục Đơn của tôi.
            </Notice>
          )}
          <Field label="Họ và tên học sinh" required error={touched ? nameError : null} hint="Tên dùng cho hồ sơ học sinh khi được nhận vào lớp.">
            {(id, describedBy) => <input id={id} aria-describedby={describedBy} autoComplete="name" value={fullName} maxLength={100} onChange={(event) => { setFullName(event.target.value); setSubmissionKey(newUuid()); }} />}
          </Field>
          <Field label="Tên phụ huynh" required error={touched ? parentNameError : null} hint="Trung tâm liên hệ khi có thay đổi lịch hoặc học sinh vắng.">
            {(id, describedBy) => <input id={id} aria-describedby={describedBy} value={parentName} maxLength={100} onChange={(event) => { setParentName(event.target.value); setSubmissionKey(newUuid()); }} />}
          </Field>
          <Field label="Số điện thoại phụ huynh" required error={touched ? parentPhoneError : null}>
            {(id, describedBy) => <input id={id} aria-describedby={describedBy} type="tel" autoComplete="tel" value={parentPhone} placeholder="0912 345 678" onChange={(event) => { setParentPhone(event.target.value); setSubmissionKey(newUuid()); }} />}
          </Field>
          {clashing > 0 && check.data && (
            <Notice tone="warning" title="Một số lớp trùng giờ với lịch hiện có của bạn">
              {check.data.classes.filter((item) => item.conflicts.length > 0).map((item) => (
                <div key={item.classId}>
                  <strong>{open.data?.items.find((row) => row.id === item.classId)?.name ?? "Lớp đã chọn"}</strong>
                  <ConflictList items={item.conflicts} limit={3} />
                </div>
              ))}
              Bạn vẫn có thể nộp đơn; trung tâm sẽ thấy số buổi trùng khi duyệt.
            </Notice>
          )}
          <p className={touched && selectionError ? "field-error" : "col-muted"}>{selectionError && touched ? selectionError : `Đã chọn ${selected.size}/10 lớp.`}</p>
          <ErrorNotice error={action.error} onDismiss={action.clearError} />
          <Button type="submit" variant="primary" icon={<Send aria-hidden="true" />} pending={action.pending} status={action.status}>Nộp đơn {selected.size ? `(${selected.size} lớp)` : ""}</Button>
        </form>
      </Panel>
    </div>
  );
}

function MyApplications({ centerId }: { centerId: string }) {
  const [page, setPage] = useState(1);
  const list = useResource(() => academicsApi.myClassApplications(centerId, { page, pageSize: 25 }), [centerId, page]);
  const open = useResource(() => academicsApi.listOpenClasses(centerId, { page: 1, pageSize: 100 }), [centerId]);
  const mine = useResource(() => academicsApi.myClasses(centerId), [centerId]);
  const names = useMemo(() => new Map([...(open.data?.items ?? []), ...(mine.data ?? [])].map((item) => [item.id, item.name])), [open.data, mine.data]);

  return (
    <Panel title="Đơn của tôi" flush>
      <ErrorNotice error={list.error} onReload={() => void list.reload()} />
      {!list.data ? (
        <SkeletonRows rows={4} columns={3} />
      ) : list.data.items.length === 0 ? (
        <EmptyState icon={<ClipboardList aria-hidden="true" />} title="Bạn chưa nộp đơn nào" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Lớp</th><th>Nộp lúc</th><th>Kết quả</th></tr></thead>
            <tbody>
              {list.data.items.map((item) => {
                const status = applicationStatus[item.status] ?? { label: item.status, tone: "neutral" as const };
                return (
                  <tr key={item.id}>
                    <td><strong>{item.className ?? names.get(item.classId) ?? "Lớp đã đóng đăng ký"}</strong></td>
                    <td className="col-muted">{formatDateTime(item.submittedAtUtc)}</td>
                    <td>
                      <Badge tone={status.tone}>{status.label}</Badge>
                      {item.reviewReason && <p className="cell-note">Lý do: {item.reviewReason}</p>}
                      {item.status === "Rejected" && <p className="cell-note">Có thể nộp lại nếu lớp còn mở.</p>}
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

function MyClasses({ classes, error, reload }: { classes: OpenClass[] | undefined; error: unknown; reload: () => void }) {
  return (
    <Panel title="Lớp đang học" flush>
      <ErrorNotice error={error} onReload={reload} />
      {!classes ? (
        <SkeletonRows rows={3} columns={2} />
      ) : classes.length === 0 ? (
        <EmptyState icon={<GraduationCap aria-hidden="true" />} title="Bạn chưa học lớp nào ở trung tâm này">Lớp xuất hiện sau khi trung tâm nhận đơn của bạn.</EmptyState>
      ) : (
        <ul className="link-list">
          {classes.map((item) => <li key={item.id}><span><GraduationCap aria-hidden="true" /><strong>{item.name}</strong></span><Meter value={item.enrolledCount} max={item.maxStudents} label="Sĩ số" /></li>)}
        </ul>
      )}
    </Panel>
  );
}

function MySchedule({ centerId, classes }: { centerId: string; classes: OpenClass[] }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const sessions = useResource(() => academicsApi.mySessions(centerId, weekStart.toISOString(), addDays(weekStart, 14).toISOString()), [centerId, weekStart.getTime()]);
  const now = useNow();
  const today = new Date(now);
  const names = new Map(classes.map((item) => [item.id, item]));
  const days = Array.from({ length: 14 }, (_, index) => addDays(weekStart, index));
  return (
    <Panel
      title="Lịch học 2 tuần"
      description="Các buổi trong thời gian bạn học ở mỗi lớp, kể cả lớp đã rời. Lịch gộp mọi trung tâm ở trang Lịch học."
      flush
      actions={
        <div className="week-nav">
          <Button size="sm" icon={<ChevronLeft aria-hidden="true" />} aria-label="Hai tuần trước" onClick={() => setWeekStart(addDays(weekStart, -14))} />
          <strong>{formatDate(weekStart)} – {formatDate(addDays(weekStart, 13))}</strong>
          <Button size="sm" icon={<ChevronRight aria-hidden="true" />} aria-label="Hai tuần sau" onClick={() => setWeekStart(addDays(weekStart, 14))} />
        </div>
      }
    >
      <ErrorNotice error={sessions.error} onReload={() => void sessions.reload()} />
      {!sessions.data ? (
        <SkeletonRows rows={5} columns={3} />
      ) : sessions.data.length === 0 ? (
        <EmptyState icon={<CalendarDays aria-hidden="true" />} title="Không có buổi học trong khoảng này" />
      ) : (
        <div className="agenda">
          {days.map((day) => {
            const items = sessions.data!.filter((item) => isSameLocalDay(new Date(item.startUtc), day));
            // Cancelled and not-held sessions stay listed with their reason.
            if (!items.length) return null;
            return (
              <section className="agenda-day" key={day.toISOString()}>
                <h3><span>{isSameLocalDay(day, today) ? "Hôm nay" : formatWeekday(day)}</span><small>{formatDayMonth(day)}</small></h3>
                <ul>
                  {items.map((item) => (
                    <li key={item.id} className={item.status && item.status !== "Scheduled" ? "is-cancelled" : ""}>
                      <time>{formatTimeRange(item.startUtc, item.endUtc)}</time>
                      <div>
                        <strong>{item.className ?? names.get(item.classId)?.name ?? "Lớp"}</strong>
                        <span>{[item.teacherName, item.roomName].filter(Boolean).join(" · ")}</span>
                        {item.statusReason && item.status !== "Scheduled" && <span className="entry-note">Lý do: {item.statusReason}</span>}
                        {item.isRescheduled && item.rescheduleReason && item.status === "Scheduled" && <span className="entry-note">Đã dời · {item.rescheduleReason}</span>}
                      </div>
                      <div className="entry-tags">
                        {item.status === "Cancelled" && <Badge tone="danger">Đã hủy</Badge>}
                        {item.status === "NotHeld" && <Badge tone="warning">Không diễn ra</Badge>}
                        {item.isRescheduled && item.status === "Scheduled" && <Badge tone="info">Đã đổi</Badge>}
                        {item.isMakeup && <Badge tone="brand">Học bù</Badge>}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
