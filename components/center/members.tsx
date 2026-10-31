"use client";

import { useId, useRef, useState } from "react";
import { AtSign, Clock3, MailPlus, RefreshCcw, Send, ShieldOff, ShieldCheck, UsersRound, X } from "lucide-react";
import { identityApi, type AssignableMemberRole, type CenterMember, type MemberInvitation } from "@/lib/api";
import { useAction, useResource } from "@/lib/hooks/use-resource";
import { useSessionUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { roleLabel } from "@/lib/labels";
import { validateEmail } from "@/lib/validation";
import { Badge, Button, EmptyState, ErrorNotice, Field, Notice, PageHeader, Panel, Segmented, SkeletonRows } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/reason-dialog";
import { RoleGate, useCenter } from "./center-frame";

const assignable: Array<{ value: AssignableMemberRole; hint: string }> = [
  { value: "Teacher", hint: "Xem lịch, tự điểm danh buổi mình dạy trong ngày khi được gắn hồ sơ giáo viên." },
  { value: "Staff", hint: "Xem dữ liệu vận hành, không duyệt đơn hay điểm danh." },
  { value: "CenterAdmin", hint: "Toàn quyền vận hành: lớp, lịch, đơn, điểm danh, hiệu chỉnh." },
];

export function MembersWorkspace() {
  return (
    <RoleGate need="manage">
      <Members />
    </RoleGate>
  );
}

function Members() {
  const { centerId, isOwner } = useCenter();
  const { user } = useSessionUser();
  const members = useResource(() => identityApi.listMembers(centerId), [centerId]);
  const invitations = useResource(() => identityApi.listMemberInvitations(centerId), [centerId]);
  const [notice, setNotice] = useState<string | null>(null);
  const [toggling, setToggling] = useState<CenterMember | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);
  const roleChange = useAction();

  function replaceMember(next: CenterMember) {
    members.setData((current) => (current ?? []).map((item) => (item.membershipId === next.membershipId ? next : item)));
  }

  async function changeRole(member: CenterMember, role: AssignableMemberRole) {
    const updated = await roleChange.run(() => identityApi.changeMemberRole(centerId, member.membershipId, role));
    if (updated) {
      replaceMember(updated);
      setNotice(`${displayName(updated)} giờ là ${roleLabel(updated.role).toLowerCase()}.`);
    }
  }

  return (
    <>
      <PageHeader
        title="Thành viên & phân quyền"
        description="Mỗi người dùng một tài khoản cho mọi trung tâm. Chỉ chủ trung tâm mời người, đổi vai trò và ngừng quyền; quản lý chỉ xem."
        actions={<Button icon={<RefreshCcw aria-hidden="true" />} pending={(members.loading && Boolean(members.data)) || (invitations.loading && Boolean(invitations.data))} onClick={() => { void members.reload(); void invitations.reload(); }}>Làm mới</Button>}
      />
      {notice && <Notice tone="success" onDismiss={() => setNotice(null)}>{notice}</Notice>}

      <Panel
        title="Lời mời"
        description={isOwner
          ? "Gửi tới email người đó dùng để đăng nhập. Email đã có tài khoản (kể cả Google) chỉ cần đăng nhập rồi chấp nhận."
          : "Chỉ chủ trung tâm gửi, gửi lại hoặc thu hồi lời mời."}
        actions={invitations.data && invitations.data.length > 0 ? <Badge tone="brand">{invitations.data.length} đang chờ</Badge> : undefined}
        flush
      >
        {isOwner && <InviteComposer onInvited={(invitation) => {
          invitations.setData((current) => [invitation, ...(current ?? []).filter((row) => row.id !== invitation.id)]);
          setFreshId(invitation.id);
          setNotice(invitation.accountExists
            ? `Đã gửi lời mời tới ${invitation.email}. Email này đã có tài khoản: người nhận đăng nhập rồi bấm chấp nhận trong email.`
            : `Đã gửi lời mời tới ${invitation.email}. Người nhận tạo tài khoản từ đường dẫn trong email (hiệu lực 48 giờ).`);
        }} />}
        <ErrorNotice error={invitations.error} onReload={() => void invitations.reload()} />
        {!invitations.data ? (
          <SkeletonRows rows={2} columns={4} />
        ) : invitations.data.length === 0 ? (
          <p className="invite-empty"><Clock3 aria-hidden="true" />Không có lời mời nào đang chờ. Lời mời hết hạn sau 48 giờ nếu chưa được chấp nhận.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Đang chờ chấp nhận</th><th>Vai trò</th><th>Tài khoản</th><th>Hết hạn</th>{isOwner && <th className="col-actions"><span className="sr-only">Thao tác</span></th>}</tr></thead>
              <tbody>
                {invitations.data.map((item) => (
                  <InvitationRow key={item.id} item={item} fresh={item.id === freshId} canRevoke={isOwner} onRevoked={() => {
                    invitations.setData((current) => (current ?? []).filter((row) => row.id !== item.id));
                    setNotice(`Đã thu hồi lời mời gửi ${item.email}.`);
                  }} onResent={(next) => {
                    invitations.setData((current) => (current ?? []).map((row) => (row.id === next.id ? next : row)));
                    setNotice(`Đã gửi lại lời mời tới ${next.email}; đường dẫn cũ hết hiệu lực, hạn mới ${formatDateTime(next.expiresAtUtc)}.`);
                  }} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Thành viên" actions={members.data ? <Badge>{members.data.filter((member) => member.isActive).length} đang hoạt động</Badge> : undefined} flush>
        <ErrorNotice error={members.error ?? roleChange.error} onReload={() => void members.reload()} onDismiss={roleChange.clearError} />
        {!members.data ? (
          <SkeletonRows rows={4} columns={5} />
        ) : members.data.length === 0 ? (
          <EmptyState icon={<UsersRound aria-hidden="true" />} title="Chưa có thành viên" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Thành viên</th><th>Vai trò</th><th>Trạng thái</th><th>Tham gia</th>{isOwner && <th className="col-actions"><span className="sr-only">Thao tác</span></th>}</tr></thead>
              <tbody>
                {members.data.map((member) => {
                  const locked = !isOwner || member.role === "CenterOwner" || member.userId === user?.userId;
                  return (
                    <tr key={member.membershipId} className={member.isActive ? "" : "is-archived"}>
                      <td><strong>{displayName(member)}</strong>{member.username && <><br /><span className="col-muted">{member.email}</span></>}</td>
                      <td>
                        {locked ? (
                          <Badge tone={member.role === "CenterOwner" ? "brand" : "neutral"}>{roleLabel(member.role)}</Badge>
                        ) : (
                          <label className="inline-select">
                            <span className="sr-only">Vai trò của {displayName(member)}</span>
                            <select value={member.role} disabled={roleChange.pending} onChange={(event) => void changeRole(member, event.target.value as AssignableMemberRole)}>
                              {assignable.map((option) => <option key={option.value} value={option.value}>{roleLabel(option.value)}</option>)}
                            </select>
                          </label>
                        )}
                      </td>
                      <td>{member.isActive ? <Badge tone="success">Đang hoạt động</Badge> : <Badge tone="neutral">Đã ngừng quyền</Badge>}</td>
                      <td className="col-muted">{formatDateTime(member.joinedAtUtc)}</td>
                      {isOwner && (
                        <td className="col-actions">
                          {!locked && (member.isActive ? (
                            <Button size="sm" variant="ghost" icon={<ShieldOff aria-hidden="true" />} onClick={() => setToggling(member)}>Ngừng quyền</Button>
                          ) : (
                            <Button size="sm" variant="ghost" icon={<ShieldCheck aria-hidden="true" />} onClick={() => setToggling(member)}>Khôi phục</Button>
                          ))}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <ConfirmDialog
        open={Boolean(toggling)}
        title={toggling?.isActive ? "Ngừng quyền thành viên?" : "Khôi phục quyền thành viên?"}
        confirmLabel={toggling?.isActive ? "Ngừng quyền" : "Khôi phục"}
        variant={toggling?.isActive ? "danger" : "primary"}
        onClose={() => setToggling(null)}
        onConfirm={async () => {
          if (!toggling) return;
          const updated = await identityApi.setMemberActive(centerId, toggling.membershipId, !toggling.isActive);
          replaceMember(updated);
          setNotice(updated.isActive ? `Đã khôi phục quyền cho ${displayName(updated)}.` : `${displayName(updated)} không còn vào được trung tâm.`);
        }}
      >
        {toggling && (toggling.isActive
          ? <p><strong>{displayName(toggling)}</strong> mất quyền vào trung tâm ngay ở lần thao tác tiếp theo. Lịch sử điểm danh và hồ sơ giáo viên vẫn được giữ.</p>
          : <p><strong>{displayName(toggling)}</strong> vào lại được trung tâm với vai trò {roleLabel(toggling.role).toLowerCase()}.</p>)}
      </ConfirmDialog>
    </>
  );
}

/**
 * One-line composer: email, role and send sit on a shared baseline (subgrid rows: label, control, message),
 * so the button always lines up with the inputs whatever error or hint appears below them.
 */
function InviteComposer({ onInvited }: { onInvited: (invitation: MemberInvitation) => void }) {
  const { centerId } = useCenter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableMemberRole>("Teacher");
  const [touched, setTouched] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const action = useAction();
  const error = validateEmail(email);
  const roleHintId = useId();
  const selected = assignable.find((option) => option.value === role) ?? assignable[0];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (error) {
      emailRef.current?.focus();
      return;
    }
    const invitation = await action.run(() => identityApi.inviteMember(centerId, email.trim(), role));
    if (invitation) {
      setEmail("");
      setTouched(false);
      onInvited(invitation);
      // Ready for the next person straight away; the role stays as chosen since invites usually come in batches.
      emailRef.current?.focus();
    }
  }

  return (
    <div className="invite-composer">
      <form className="invite-row" onSubmit={submit} noValidate>
        <Field label="Email người được mời" required error={touched ? error : null} className="invite-email">
          {(id, describedBy) => (
            <span className="input-icon">
              <AtSign aria-hidden="true" />
              <input ref={emailRef} id={id} type="email" inputMode="email" autoComplete="off" spellCheck={false} aria-describedby={describedBy} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="giaovien@example.com" />
            </span>
          )}
        </Field>
        <div className="field invite-role">
          <span className="field-label" aria-hidden="true">Vai trò</span>
          <Segmented label="Vai trò được mời" value={role} onChange={setRole} options={assignable.map((option) => ({ value: option.value, label: roleLabel(option.value) }))} />
          <p className="field-hint" id={roleHintId} aria-live="polite">{selected.hint}</p>
        </div>
        <div className="invite-submit">
          <Button type="submit" variant="primary" icon={<MailPlus aria-hidden="true" />} pending={action.pending} status={action.status} aria-describedby={roleHintId}>Gửi lời mời</Button>
        </div>
      </form>
      <ErrorNotice error={action.error} onDismiss={action.clearError} />
    </div>
  );
}

function InvitationRow({ item, fresh, canRevoke, onRevoked, onResent }: { item: MemberInvitation; fresh: boolean; canRevoke: boolean; onRevoked: () => void; onResent: (next: MemberInvitation) => void }) {
  const { centerId } = useCenter();
  const resend = useAction();
  const revoke = useAction();
  const busy = resend.pending || revoke.pending;
  return (
    <tr className={fresh ? "is-fresh" : undefined}>
      <td><strong>{item.email}</strong>{resend.error || revoke.error ? <p className="field-error">Không thực hiện được, hãy làm mới.</p> : null}</td>
      <td><Badge>{roleLabel(item.role)}</Badge></td>
      <td className="col-muted">{item.accountExists ? "Đã có — đăng nhập rồi chấp nhận" : "Chưa có — tạo khi nhận lời mời"}</td>
      <td className="col-muted">{formatDateTime(item.expiresAtUtc)}</td>
      {canRevoke && (
        <td className="col-actions">
          <Button size="sm" variant="ghost" icon={<Send aria-hidden="true" />} status={resend.status} disabled={busy} onClick={async () => {
            const next = await resend.run(() => identityApi.resendMemberInvitation(centerId, item.id));
            if (next) onResent(next);
          }}>Gửi lại</Button>
          <Button size="sm" variant="ghost" icon={<X aria-hidden="true" />} status={revoke.status} disabled={busy} onClick={async () => {
            if (await revoke.run(() => identityApi.revokeMemberInvitation(centerId, item.id))) onRevoked();
          }}>Thu hồi</Button>
        </td>
      )}
    </tr>
  );
}

function displayName(member: CenterMember) {
  return member.username ?? member.email;
}

