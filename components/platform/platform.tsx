"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { NavLink } from "@/components/ui/nav-link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, BookOpen, Building2, Check, Coins, FileClock, Inbox, LoaderCircle, LogOut, Mail, MailPlus, Pause, Pencil, Play, Plus, RefreshCcw, Search, Send, ShieldAlert, UserCog, X } from "lucide-react";
import { ApiError, authApi, identityApi, organizationsApi, type Center, type CenterChangeRequest, type CenterInvitation, type ChangeQueueStatus, type MemberInvitation } from "@/lib/api";
import { useSessionUser } from "@/lib/auth/session";
import { useAction, useResource } from "@/lib/hooks/use-resource";
import { useNow } from "@/lib/hooks/use-now";
import { formatDateTime } from "@/lib/format";
import { centerStatus, roleLabel } from "@/lib/labels";
import { validateEmail, validateOptional, validateRequired, validateTaxCode, validateVietnamMobile } from "@/lib/validation";
import { Badge, Button, Dialog, UserChip, EmptyState, ErrorNotice, Field, Notice, PageHeader, Pagination, Panel, Segmented, SkeletonRows, BackButton, ButtonLink } from "@/components/ui/primitives";
import { ConfirmDialog, ReasonDialog } from "@/components/ui/reason-dialog";
import { ChangeRequestCard, ProfileFacts, StatusHistory, centerLifecycle } from "@/components/center/profile";
import { PayrollConfigPanel } from "./payroll-config";

export function PlatformFrame({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, status } = useSessionUser();

  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [pathname, router, status]);

  if (status === "loading" || status === "anonymous") {
    return <main className="standalone-state"><LoaderCircle className="spin" aria-hidden="true" /><h1>Đang kiểm tra quyền quản trị</h1></main>;
  }
  if (!user?.isPlatformAdmin) {
    return (
      <main className="standalone-state">
        <ShieldAlert aria-hidden="true" />
        <h1>Khu vực dành cho quản trị nền tảng</h1>
        <p>Tài khoản {user?.username ?? "hiện tại"} không có vai trò PlatformAdmin.</p>
        <Link className="btn btn-primary" href="/select-center">Về danh sách trung tâm</Link>
      </main>
    );
  }

  async function logout() {
    await authApi.logout();
    router.replace("/login");
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <Link className="brand" href="/platform">
          <span className="brand-mark"><BookOpen aria-hidden="true" /></span>
          <span><strong>Quản Lý Dạy Thêm</strong><small>Quản trị nền tảng</small></span>
        </Link>
        <nav className="side-nav" aria-label="Điều hướng nền tảng">
          <div className="side-nav-group">
            <span className="side-nav-label">Nền tảng</span>
            <NavLink href="/platform" active={pathname.startsWith("/platform") && !pathname.startsWith("/platform/changes") && !pathname.startsWith("/platform/email") && !pathname.startsWith("/platform/payroll")} icon={<Building2 aria-hidden="true" />}>Trung tâm</NavLink>
            <NavLink href="/platform/changes" active={pathname.startsWith("/platform/changes")} icon={<FileClock aria-hidden="true" />}>Yêu cầu thay đổi</NavLink>
            <NavLink href="/platform/payroll" active={pathname.startsWith("/platform/payroll")} icon={<Coins aria-hidden="true" />}>Lương & thu nhập</NavLink>
            <NavLink href="/platform/email" active={pathname.startsWith("/platform/email")} icon={<Mail aria-hidden="true" />}>Email hệ thống</NavLink>
            <Link className="side-nav-item" href="/select-center"><Inbox aria-hidden="true" /><span>Trung tâm tôi là thành viên</span></Link>
          </div>
        </nav>
        <div className="sidebar-footer">
          <Link href="/account/security"><UserCog aria-hidden="true" />Tài khoản & bảo mật</Link>
          <button type="button" onClick={() => void logout()}><LogOut aria-hidden="true" />Đăng xuất</button>
        </div>
      </aside>
      <div className="content">
        <header className="topbar">
          <span className="topbar-center"><ShieldAlert aria-hidden="true" />Phạm vi toàn nền tảng</span>
          <UserChip name={user.username ?? "Quản trị"} role="Quản trị nền tảng" />
        </header>
        <main className="workspace">{children}</main>
      </div>
    </div>
  );
}

type StatusFilter = "all" | "PendingApproval" | "Approved" | "Suspended" | "Rejected";

const PLATFORM_PAGE_SIZE = 25;

export function PlatformCenters() {
  const [filter, setFilter] = useState<StatusFilter>("PendingApproval");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(query.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const centers = useResource(
    () => organizationsApi.platformListCenters({ status: filter === "all" ? undefined : filter, search: search || undefined, page, pageSize: PLATFORM_PAGE_SIZE }),
    [filter, search, page],
  );
  const summary = useResource(() => organizationsApi.platformCenterCounts(), []);
  const counts = {
    all: summary.data?.total,
    PendingApproval: summary.data?.pendingApproval,
    Approved: summary.data?.approved,
    Suspended: summary.data?.suspended,
    Rejected: summary.data?.rejected,
  };
  const rows = centers.data?.items;
  const reload = () => { void centers.reload(); void summary.reload(); };

  return (
    <>
      <PageHeader
        title="Trung tâm trên nền tảng"
        description="Tạo hồ sơ, duyệt hoặc từ chối, đình chỉ và khôi phục; mời chủ trung tâm sau khi duyệt."
        actions={
          <>
            <Button icon={<RefreshCcw aria-hidden="true" />} onClick={reload} pending={centers.loading && Boolean(centers.data)}>Làm mới</Button>
            <Button variant="primary" icon={<Plus aria-hidden="true" />} onClick={() => setCreating(true)}>Tạo trung tâm</Button>
          </>
        }
      />
      {notice && <Notice tone="success" onDismiss={() => setNotice(null)}>{notice}</Notice>}
      <ErrorNotice error={centers.error ?? summary.error} onReload={reload} />

      <Panel flush>
        <div className="toolbar">
          <Segmented
            label="Lọc theo trạng thái"
            value={filter}
            onChange={(value) => { setFilter(value); setPage(1); }}
            options={[
              { value: "PendingApproval", label: "Chờ duyệt", count: counts.PendingApproval },
              { value: "Approved", label: "Đã duyệt", count: counts.Approved },
              { value: "Suspended", label: "Đình chỉ", count: counts.Suspended },
              { value: "Rejected", label: "Từ chối", count: counts.Rejected },
              { value: "all", label: "Tất cả", count: counts.all },
            ]}
          />
          <label className="search">
            <Search aria-hidden="true" />
            <span className="sr-only">Tìm trung tâm</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tên hoặc mã số thuế…" />
          </label>
        </div>
        {!rows ? (
          <SkeletonRows rows={6} columns={5} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<Building2 aria-hidden="true" />} title={query ? "Không có trung tâm phù hợp" : "Không có trung tâm ở trạng thái này"} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Trung tâm</th><th>Mã số thuế</th><th>Liên hệ</th><th>Tạo lúc</th><th>Trạng thái</th><th className="col-actions"><span className="sr-only">Mở</span></th></tr></thead>
              <tbody>
                {rows.map((row) => {
                  const status = centerStatus[row.status] ?? { label: row.status, tone: "neutral" as const };
                  return (
                    <tr key={row.id}>
                      <td><Link className="row-link" href={`/platform/centers/${row.id}`}>{row.displayName}</Link><br /><span className="col-muted">{row.legalName}</span></td>
                      <td><code className="code">{row.taxCode}</code></td>
                      <td className="col-muted">{row.contactEmail}<br />{row.contactPhone}</td>
                      <td className="col-muted">{formatDateTime(row.createdAtUtc)}</td>
                      <td><Badge tone={status.tone}>{status.label}</Badge></td>
                      <td className="col-actions"><ButtonLink size="sm" variant="soft" href={`/platform/centers/${row.id}`} trailing={<ArrowRight aria-hidden="true" />}>Xử lý</ButtonLink></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {centers.data && <Pagination page={page} pageSize={centers.data.pageSize} total={centers.data.totalCount} onChange={setPage} />}
      </Panel>

      {creating && (
        <CreateCenterDialog
          onClose={() => setCreating(false)}
          onCreated={(center) => {
            setCreating(false);
            setFilter("PendingApproval");
            setNotice(`Đã tạo ${center.displayName} ở trạng thái chờ duyệt.`);
            reload();
          }}
        />
      )}
    </>
  );
}

function CreateCenterDialog({ onClose, onCreated, resubmit }: { onClose: () => void; onCreated: (center: Center) => void; resubmit?: Center }) {
  const [values, setValues] = useState({
    legalName: resubmit?.legalName ?? "",
    displayName: resubmit?.displayName ?? "",
    taxCode: resubmit?.taxCode ?? "",
    businessRegistrationNumber: resubmit?.businessRegistrationNumber ?? "",
    address: resubmit?.address ?? "",
    contactEmail: resubmit?.contactEmail ?? "",
    contactPhone: resubmit?.contactPhone ?? "",
    note: "",
  });
  const [touched, setTouched] = useState(false);
  const action = useAction();
  const errors: Record<string, string | null> = {
    legalName: validateRequired(values.legalName, 200, "Tên pháp lý"),
    displayName: validateRequired(values.displayName, 150, "Tên hiển thị"),
    taxCode: validateTaxCode(values.taxCode),
    businessRegistrationNumber: validateOptional(values.businessRegistrationNumber, 50, "Số ĐKKD"),
    address: validateRequired(values.address, 500, "Địa chỉ"),
    contactEmail: validateEmail(values.contactEmail),
    contactPhone: validateVietnamMobile(values.contactPhone),
    note: validateOptional(values.note, 1000, "Ghi chú"),
  };
  const invalid = Object.values(errors).some(Boolean);

  async function submit() {
    setTouched(true);
    if (invalid) return;
    const details = {
      legalName: values.legalName.trim(),
      displayName: values.displayName.trim(),
      taxCode: values.taxCode.trim(),
      businessRegistrationNumber: values.businessRegistrationNumber.trim() || null,
      address: values.address.trim(),
      contactEmail: values.contactEmail.trim(),
      contactPhone: values.contactPhone.replace(/[\s.()-]/g, ""),
    };
    const created = await action.run(() =>
      resubmit
        ? organizationsApi.platformResubmitCenter(resubmit.id, { ...details, note: values.note.trim() || null })
        : organizationsApi.platformCreateCenter(details),
    );
    if (created) onCreated(created);
  }

  const input = (key: keyof typeof values, label: string, opts: { span?: boolean; hint?: string; required?: boolean; type?: string } = {}) => (
    <Field key={key} label={label} required={opts.required ?? true} hint={opts.hint} error={touched ? errors[key] : null} className={opts.span ? "span-2" : undefined}>
      {(id, describedBy) => <input id={id} aria-describedby={describedBy} type={opts.type ?? "text"} value={values[key]} onChange={(event) => setValues({ ...values, [key]: event.target.value })} />}
    </Field>
  );

  return (
    <Dialog open size="lg"
      title={resubmit ? "Sửa và gửi duyệt lại" : "Tạo hồ sơ trung tâm"}
      description={resubmit
        ? `Lý do từ chối trước: ${resubmit.reviewNote ?? "—"}. Sau khi gửi, hồ sơ trở về trạng thái chờ duyệt; lần từ chối vẫn lưu trong lịch sử.`
        : "Trung tâm mới ở trạng thái chờ duyệt. Mã số thuế là duy nhất trên toàn nền tảng."}
      onClose={onClose} onSubmit={submit}
      footer={<><Button onClick={onClose} disabled={action.pending}>Đóng</Button><Button type="submit" variant="primary" pending={action.pending} status={action.status}>{resubmit ? "Gửi duyệt lại" : "Tạo trung tâm"}</Button></>}>
      <div className="form-grid">
        {input("legalName", "Tên pháp lý", { span: true })}
        {input("displayName", "Tên hiển thị")}
        {input("taxCode", "Mã số thuế", { hint: "10 số, có thể kèm -XXX." })}
        {input("businessRegistrationNumber", "Số ĐKKD", { required: false })}
        {input("contactPhone", "Điện thoại liên hệ", { type: "tel" })}
        {input("address", "Địa chỉ", { span: true })}
        {input("contactEmail", "Email liên hệ", { span: true, type: "email" })}
        {resubmit && input("note", "Ghi chú sửa đổi", { span: true, required: false, hint: "Đã sửa gì so với lần trước." })}
      </div>
      <ErrorNotice error={action.error} />
    </Dialog>
  );
}

type Transition = "reject" | "suspend" | "reinstate";

export function PlatformCenterDetail({ centerId }: { centerId: string }) {
  const [transition, setTransition] = useState<Transition | null>(null);
  const [approving, setApproving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [review, setReview] = useState<{ request: CenterChangeRequest; approve: boolean } | null>(null);
  const [resubmitting, setResubmitting] = useState(false);
  const [notice, setNotice] = useState<ReactNode>(null);

  const centerResource = useResource(() => organizationsApi.platformGetCenter(centerId), [centerId]);
  const changes = useResource(() => organizationsApi.platformListCenterChanges(centerId), [centerId]);
  const history = useResource(() => organizationsApi.platformCenterHistory(centerId), [centerId]);
  const invitations = useResource(() => identityApi.platformListInvitations(centerId), [centerId]);
  const center = centerResource.data ?? undefined;
  const notFound = centerResource.error instanceof ApiError && centerResource.error.status === 404;
  const centers = { reload: async () => { await Promise.all([centerResource.reload(), history.reload()]); } };

  const transitionCopy: Record<Transition, { title: string; label: string; confirm: string; variant: "primary" | "danger"; text: string }> = {
    reject: { title: "Từ chối trung tâm", label: "Lý do từ chối", confirm: "Từ chối", variant: "danger", text: "Chỉ áp dụng cho trung tâm đang chờ duyệt." },
    suspend: { title: "Đình chỉ trung tâm", label: "Lý do đình chỉ", confirm: "Đình chỉ", variant: "danger", text: "Mọi thành viên mất quyền truy cập ngay lập tức; trung tâm vẫn hiện trong danh sách của họ với trạng thái tạm dừng." },
    reinstate: { title: "Khôi phục trung tâm", label: "Lý do khôi phục", confirm: "Khôi phục", variant: "primary", text: "Thành viên có thể vào lại trung tâm ngay sau khi khôi phục." },
  };

  return (
    <>
      <BackButton href="/platform">Tất cả trung tâm</BackButton>
      <PageHeader
        title={center?.displayName ?? "Trung tâm"}
        description={center?.legalName}
        meta={center && centerLifecycle(center.status)}
        actions={
          center && (
            <>
              {center.status === "PendingApproval" && (
                <>
                  <Button icon={<X aria-hidden="true" />} onClick={() => setTransition("reject")}>Từ chối</Button>
                  <Button variant="primary" icon={<Check aria-hidden="true" />} onClick={() => setApproving(true)}>Duyệt</Button>
                </>
              )}
              {center.status === "Rejected" && <Button variant="primary" icon={<Pencil aria-hidden="true" />} onClick={() => setResubmitting(true)}>Sửa & gửi duyệt lại</Button>}
              {center.status === "Approved" && (
                <>
                  <Button icon={<Pause aria-hidden="true" />} onClick={() => setTransition("suspend")}>Đình chỉ</Button>
                  <Button variant="primary" icon={<MailPlus aria-hidden="true" />} onClick={() => setInviting(true)}>Mời chủ trung tâm</Button>
                </>
              )}
              {center.status === "Suspended" && <Button variant="primary" icon={<Play aria-hidden="true" />} onClick={() => setTransition("reinstate")}>Khôi phục</Button>}
            </>
          )
        }
      />
      {notice && <Notice tone="success" onDismiss={() => setNotice(null)}>{notice}</Notice>}
      {!notFound && <ErrorNotice error={centerResource.error} onReload={() => void centers.reload()} />}
      {notFound && <Notice tone="danger">Không tìm thấy trung tâm này trên nền tảng.</Notice>}

      <div className="detail-grid">
        <Panel title="Hồ sơ pháp lý">{center ? <div className="panel-body"><ProfileFacts center={center} /></div> : notFound ? <EmptyState icon={<Building2 aria-hidden="true" />} title="Không có dữ liệu" /> : <SkeletonRows rows={6} columns={2} />}</Panel>
        {center && (center.status === "Approved" || center.status === "Suspended") && <PayrollConfigPanel centerId={centerId} centerName={center.displayName} />}
        <Panel title="Yêu cầu thay đổi hồ sơ" description="Duyệt áp dụng toàn bộ trường đề xuất trong một lần; bị chặn nếu hồ sơ gốc đã đổi." flush>
          <ErrorNotice error={changes.error} onReload={() => void changes.reload()} />
          {!changes.data ? (
            <SkeletonRows rows={3} columns={2} />
          ) : changes.data.length === 0 ? (
            <EmptyState icon={<Inbox aria-hidden="true" />} title="Chưa có yêu cầu thay đổi" />
          ) : (
            <ul className="change-list">
              {changes.data.map((request) => (
                <ChangeRequestCard
                  key={request.id}
                  request={request}
                  actions={request.status === "Pending" && (
                    <>
                      <Button size="sm" icon={<X aria-hidden="true" />} onClick={() => setReview({ request, approve: false })}>Từ chối</Button>
                      <Button size="sm" variant="primary" icon={<Check aria-hidden="true" />} onClick={() => setReview({ request, approve: true })}>Duyệt & áp dụng</Button>
                    </>
                  )}
                />
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Lịch sử trạng thái" flush>
          <ErrorNotice error={history.error} onReload={() => void history.reload()} />
          {!history.data ? <SkeletonRows rows={3} columns={2} /> : <StatusHistory items={history.data} />}
        </Panel>
        <Panel title="Lời mời đang mở" description="Quản trị nền tảng gửi lại hoặc thu hồi lời mời chủ trung tâm; lời mời thành viên do chủ trung tâm quản lý." flush>
          <ErrorNotice error={invitations.error} onReload={() => void invitations.reload()} />
          {!invitations.data ? (
            <SkeletonRows rows={2} columns={3} />
          ) : invitations.data.length === 0 ? (
            <p className="panel-empty">Không có lời mời nào đang mở.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Email</th><th>Vai trò</th><th>Hết hạn</th><th className="col-actions"><span className="sr-only">Thao tác</span></th></tr></thead>
                <tbody>
                  {invitations.data.map((item) => (
                    <PlatformInvitationRow key={item.id} centerId={centerId} item={item} onChanged={(message) => { setNotice(message); void invitations.reload(); }} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {resubmitting && center && (
        <CreateCenterDialog
          resubmit={center}
          onClose={() => setResubmitting(false)}
          onCreated={() => {
            setResubmitting(false);
            setNotice("Đã gửi lại hồ sơ. Trung tâm trở về trạng thái chờ duyệt.");
            void centers.reload();
          }}
        />
      )}

      <ConfirmDialog
        open={approving}
        title="Duyệt trung tâm?"
        confirmLabel="Duyệt trung tâm"
        onClose={() => setApproving(false)}
        onConfirm={async () => {
          await organizationsApi.platformApproveCenter(centerId);
          setNotice("Đã duyệt trung tâm. Bước tiếp theo: mời chủ trung tâm.");
          await centers.reload();
        }}
      >
        <p>Trung tâm được phép hoạt động và có thể nhận lời mời chủ trung tâm.</p>
      </ConfirmDialog>

      {transition && (
        <ReasonDialog
          open
          title={transitionCopy[transition].title}
          label={transitionCopy[transition].label}
          confirmLabel={transitionCopy[transition].confirm}
          variant={transitionCopy[transition].variant}
          description={transitionCopy[transition].text}
          onClose={() => setTransition(null)}
          onConfirm={async (reason) => {
            if (transition === "reject") await organizationsApi.platformRejectCenter(centerId, reason);
            if (transition === "suspend") await organizationsApi.platformSuspendCenter(centerId, reason);
            if (transition === "reinstate") await organizationsApi.platformReinstateCenter(centerId, reason);
            setNotice(`${transitionCopy[transition].confirm} thành công.`);
            await centers.reload();
          }}
        />
      )}

      {review && (
        <ReasonDialog
          open
          title={review.approve ? "Duyệt và áp dụng thay đổi" : "Từ chối yêu cầu thay đổi"}
          label="Ghi chú duyệt"
          confirmLabel={review.approve ? "Duyệt & áp dụng" : "Từ chối"}
          variant={review.approve ? "primary" : "danger"}
          description={review.approve ? "Mọi trường đề xuất được áp dụng cùng lúc. Nếu đổi email liên hệ, trạng thái xác minh email liên hệ bị đặt lại." : "Hồ sơ hiện hành được giữ nguyên."}
          onClose={() => setReview(null)}
          onConfirm={async (note) => {
            if (review.approve) await organizationsApi.platformApproveCenterChange(centerId, review.request.id, note);
            else await organizationsApi.platformRejectCenterChange(centerId, review.request.id, note);
            setNotice(review.approve ? "Đã áp dụng thay đổi hồ sơ." : "Đã từ chối yêu cầu thay đổi.");
            await Promise.all([changes.reload(), centers.reload()]);
          }}
        />
      )}

      {inviting && center && (
        <InviteOwnerDialog
          center={center}
          onClose={() => setInviting(false)}
          onInvited={(invitation) => {
            setInviting(false);
            setNotice(<>Đã xếp hàng gửi lời mời tới <strong>{invitation.email}</strong>. Lời mời hết hạn lúc {formatDateTime(invitation.expiresAtUtc)}; mã chỉ có trong email.</>);
            void invitations.reload();
          }}
        />
      )}
    </>
  );
}

function InviteOwnerDialog({ center, onClose, onInvited }: { center: Center; onClose: () => void; onInvited: (invitation: CenterInvitation) => void }) {
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const action = useAction();
  const error = validateEmail(email);
  async function submit() {
    setTouched(true);
    if (error) return;
    const invitation = await action.run(() => authApi.inviteCenterOwner(center.id, email.trim()));
    if (invitation) onInvited(invitation);
  }
  return (
    <Dialog open size="sm" title={`Mời chủ trung tâm ${center.displayName}`} description="Lời mời gửi qua email, hiệu lực 48 giờ, dùng một lần. Email chưa được dùng cho tài khoản nào." onClose={onClose} onSubmit={submit}
      footer={<><Button onClick={onClose} disabled={action.pending}>Hủy</Button><Button type="submit" variant="primary" pending={action.pending} status={action.status}>Gửi lời mời</Button></>}>
      <Field label="Email người nhận" required error={touched ? error : null}>
        {(id) => <input id={id} type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} />}
      </Field>
      <ErrorNotice error={action.error} />
    </Dialog>
  );
}

function PlatformInvitationRow({ centerId, item, onChanged }: { centerId: string; item: MemberInvitation; onChanged: (message: string) => void }) {
  const resend = useAction();
  const revoke = useAction();
  const busy = resend.pending || revoke.pending;
  const now = useNow();
  const expired = new Date(item.expiresAtUtc).getTime() <= now;
  const owner = item.role === "CenterOwner";
  return (
    <tr>
      <td><strong>{item.email}</strong>{resend.error || revoke.error ? <p className="field-error">Không thực hiện được, hãy làm mới.</p> : null}</td>
      <td><Badge tone={owner ? "brand" : "neutral"}>{roleLabel(item.role)}</Badge></td>
      <td className="col-muted">{expired ? <Badge tone="warning">Đã hết hạn</Badge> : formatDateTime(item.expiresAtUtc)}</td>
      <td className="col-actions">
        {owner && (
          <>
            <Button size="sm" variant="ghost" icon={<Send aria-hidden="true" />} status={resend.status} disabled={busy} onClick={async () => {
              const sent = await resend.run(() => identityApi.platformResendInvitation(centerId, item.id));
              if (sent) onChanged(`Đã gửi lại lời mời tới ${item.email}; đường dẫn cũ hết hiệu lực.`);
            }}>Gửi lại</Button>
            <Button size="sm" variant="ghost" icon={<X aria-hidden="true" />} status={revoke.status} disabled={busy} onClick={async () => {
              const revoked = await revoke.run(() => identityApi.platformRevokeInvitation(centerId, item.id));
              if (revoked) onChanged(`Đã thu hồi lời mời gửi ${item.email}.`);
            }}>Thu hồi</Button>
          </>
        )}
      </td>
    </tr>
  );
}

const queueFilters: Array<{ value: ChangeQueueStatus; label: string }> = [
  { value: "Pending", label: "Chờ duyệt" },
  { value: "Approved", label: "Đã áp dụng" },
  { value: "Rejected", label: "Bị từ chối" },
  { value: "Withdrawn", label: "Đã rút" },
  { value: "All", label: "Tất cả" },
];

/** Change requests across all centers, oldest first, so the queue is worked in order. */
export function PlatformChangeQueue() {
  const [status, setStatus] = useState<ChangeQueueStatus>("Pending");
  const [page, setPage] = useState(1);
  const queue = useResource(() => organizationsApi.platformChangeQueue({ status, page, pageSize: 20 }), [status, page]);
  return (
    <>
      <PageHeader
        title="Yêu cầu thay đổi hồ sơ"
        description="Tất cả trung tâm, cũ nhất trước. Mở trung tâm để duyệt hoặc từ chối."
        actions={<Button icon={<RefreshCcw aria-hidden="true" />} onClick={() => void queue.reload()} pending={queue.loading && Boolean(queue.data)}>Làm mới</Button>}
      />
      <ErrorNotice error={queue.error} onReload={() => void queue.reload()} />
      <Panel flush>
        <div className="toolbar">
          <Segmented label="Lọc theo trạng thái" value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={queueFilters} />
        </div>
        {!queue.data ? (
          <SkeletonRows rows={4} columns={3} />
        ) : queue.data.items.length === 0 ? (
          <EmptyState icon={<Inbox aria-hidden="true" />} title="Không có yêu cầu nào" />
        ) : (
          <ul className="change-list">
            {queue.data.items.map((request) => (
              <ChangeRequestCard
                key={request.id}
                request={request}
                actions={request.centerId && (
                  <ButtonLink size="sm" variant="soft" href={`/platform/centers/${request.centerId}`} trailing={<ArrowRight aria-hidden="true" />}>{request.centerName ?? "Mở trung tâm"}</ButtonLink>
                )}
              />
            ))}
          </ul>
        )}
        {queue.data && <Pagination page={page} pageSize={queue.data.pageSize} total={queue.data.totalCount} onChange={setPage} />}
      </Panel>
    </>
  );
}
