"use client";

import { useState } from "react";
import { Ban, Check, Copy, KeyRound, Link2, RefreshCcw, Shuffle, Ticket, UserCheck } from "lucide-react";
import { academicsApi, type ActivationLink, type ClassInvite, type Student, type TeachingClass } from "@/lib/api";
import { useAction, useResource } from "@/lib/hooks/use-resource";
import { formatDateTime } from "@/lib/format";
import { Badge, Button, Dialog, EmptyState, ErrorNotice, Field, Notice, Panel, SkeletonRows } from "@/components/ui/primitives";
import { useCenter } from "./center-frame";

/** Full URL of a student-facing page on this site (links are opened by students, not by the API). */
export function siteUrl(path: string) {
  return typeof window === "undefined" ? path : `${window.location.origin}${path}`;
}

export const activationUrl = (token: string) => siteUrl(`/activate/${token}`);
export const inviteUrl = (token: string) => siteUrl(`/join/${token}`);

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function CopyButton({ text, label = "Chép" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      icon={done ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      onClick={() => void copyText(text).then((ok) => {
        setDone(ok);
        if (ok) window.setTimeout(() => setDone(false), 1500);
      })}
    >
      {done ? "Đã chép" : label}
    </Button>
  );
}

// ---------------- Students list: account column, activation link, unlink, merge ----------------

/** "Tài khoản" column of the students list: activated or not, the latest link, and duplicate warnings. */
export function StudentAccountCell({ item }: { item: Student }) {
  return (
    <span className="stack-tight">
      {item.hasAccount ? (
        <Badge tone="success">Đã kích hoạt</Badge>
      ) : item.activation?.state === "Active" ? (
        <Badge tone="info">Đã gửi link · hạn {formatDateTime(item.activation.expiresAtUtc)}</Badge>
      ) : item.activation?.state === "Declined" ? (
        <Badge tone="warning">Người mở link báo “không phải tôi”</Badge>
      ) : (
        <span className="col-muted">Chưa kích hoạt</span>
      )}
      {item.duplicateCandidateId && (
        <Badge tone={item.duplicateReason === "SameAccount" ? "danger" : "warning"}>
          {item.duplicateReason === "SameAccount" ? "Cùng một học sinh với " : "Có thể trùng "}
          {item.duplicateCandidateCode ?? ""} {item.duplicateCandidateName ?? ""}
        </Badge>
      )}
      {item.mergedIntoStudentId && <Badge tone="neutral">Đã gộp vào hồ sơ khác</Badge>}
    </span>
  );
}

/** Row buttons for managers: activation link / unlink / merge. */
export function StudentAccessActions({ item, onChanged, notify, reload }: {
  item: Student;
  onChanged: (student: Student) => void;
  notify: (message: string) => void;
  reload: () => void;
}) {
  const [open, setOpen] = useState<"link" | "unlink" | "merge" | null>(null);
  if (!item.isActive || item.mergedIntoStudentId) return null;
  return (
    <>
      {item.hasAccount ? (
        <Button size="sm" variant="ghost" icon={<Ban aria-hidden="true" />} onClick={() => setOpen("unlink")}>Gỡ tài khoản</Button>
      ) : (
        <Button size="sm" variant="ghost" icon={<Link2 aria-hidden="true" />} onClick={() => setOpen("link")}>Link kích hoạt</Button>
      )}
      {item.duplicateCandidateId && (
        <Button size="sm" variant="ghost" icon={<Shuffle aria-hidden="true" />} onClick={() => setOpen("merge")}>Gộp / bỏ qua</Button>
      )}
      {open === "link" && <ActivationLinkDialog student={item} onClose={() => { setOpen(null); reload(); }} />}
      {open === "unlink" && (
        <UnlinkDialog
          student={item}
          onClose={() => setOpen(null)}
          onDone={(updated) => {
            setOpen(null);
            onChanged(updated);
            notify(`Đã gỡ tài khoản khỏi ${updated.fullName}. Có thể phát link kích hoạt mới cho đúng người.`);
          }}
        />
      )}
      {open === "merge" && (
        <MergeDialog
          student={item}
          onClose={() => setOpen(null)}
          onDone={(message) => {
            setOpen(null);
            notify(message);
            reload();
          }}
        />
      )}
    </>
  );
}

function ActivationLinkDialog({ student, onClose }: { student: Student; onClose: () => void }) {
  const { centerId } = useCenter();
  const action = useAction();
  const [link, setLink] = useState<ActivationLink | null>(null);
  const hasActive = student.activation?.state === "Active";

  async function create() {
    const created = await action.run(() => academicsApi.createActivationLink(centerId, student.id));
    if (created) setLink(created);
  }

  async function revoke() {
    if (await action.run(() => academicsApi.revokeActivationLink(centerId, student.id))) onClose();
  }

  return (
    <Dialog
      open
      size="md"
      title={`Link kích hoạt · ${student.fullName}`}
      description="Gửi link này riêng cho em hoặc phụ huynh (Zalo, tin nhắn). Ai mở link và đăng nhập Google sẽ được gắn vào đúng hồ sơ này, sau khi xác nhận tên. Link dùng một lần, hạn 14 ngày."
      onClose={onClose}
      footer={<Button onClick={onClose}>Đóng</Button>}
    >
      {link ? (
        <div className="stack">
          <Notice tone="success" title="Đã tạo link mới">Chép link ngay: vì lý do bảo mật, link không xem lại được. Mọi link cũ của hồ sơ này đã ngừng hoạt động.</Notice>
          <div className="copy-row">
            <code className="code copy-value">{activationUrl(link.token)}</code>
            <CopyButton text={activationUrl(link.token)} />
          </div>
          <p className="cell-note">Hết hạn: {formatDateTime(link.expiresAtUtc)}</p>
        </div>
      ) : (
        <div className="stack">
          {hasActive && student.activation && (
            <Notice tone="info">Hồ sơ đang có một link còn hạn tới {formatDateTime(student.activation.expiresAtUtc)}. Tạo link mới sẽ làm link cũ ngừng hoạt động.</Notice>
          )}
          {student.activation?.state === "Declined" && (
            <Notice tone="warning">Lần trước người mở link đã báo “không phải tôi”. Hãy kiểm tra lại người nhận trước khi gửi link mới.</Notice>
          )}
          <div className="inline-action">
            <Button variant="primary" icon={<KeyRound aria-hidden="true" />} pending={action.pending} onClick={() => void create()}>Tạo link kích hoạt</Button>
            {hasActive && <Button variant="ghost" onClick={() => void revoke()} disabled={action.pending}>Thu hồi link hiện tại</Button>}
          </div>
        </div>
      )}
      <ErrorNotice error={action.error} onDismiss={action.clearError} />
    </Dialog>
  );
}

function UnlinkDialog({ student, onClose, onDone }: { student: Student; onClose: () => void; onDone: (student: Student) => void }) {
  const { centerId } = useCenter();
  const action = useAction();
  async function confirm() {
    const updated = await action.run(() => academicsApi.unlinkStudentAccount(centerId, student.id, student.version));
    if (updated) onDone(updated);
  }
  return (
    <Dialog
      open
      size="sm"
      title={`Gỡ tài khoản khỏi ${student.fullName}?`}
      description="Tài khoản Google đó không còn thấy lịch, thông báo của hồ sơ này. Lớp, điểm danh và lịch sử vẫn ở nguyên hồ sơ. Dùng khi gắn nhầm người, hoặc trước khi gộp hai hồ sơ."
      onClose={onClose}
      onSubmit={() => void confirm()}
      footer={<><Button onClick={onClose} disabled={action.pending}>Hủy</Button><Button type="submit" variant="danger" pending={action.pending}>Gỡ tài khoản</Button></>}
    >
      <ErrorNotice error={action.error} onDismiss={action.clearError} />
    </Dialog>
  );
}

function MergeDialog({ student, onClose, onDone }: { student: Student; onClose: () => void; onDone: (message: string) => void }) {
  const { centerId } = useCenter();
  const action = useAction();
  const otherId = student.duplicateCandidateId!;
  const other = useResource(() => academicsApi.getStudent(centerId, otherId), [centerId, otherId]);
  // Keep the profile the center made by hand (it has the history) unless only the other one is active.
  const [keep, setKeep] = useState<"this" | "other">(student.hasAccount ? "other" : "this");

  async function merge() {
    const target = keep === "this" ? student.id : otherId;
    const source = keep === "this" ? otherId : student.id;
    const result = await action.run(() => academicsApi.mergeStudents(centerId, target, source));
    if (result) {
      const kept = keep === "this" ? student : other.data;
      onDone(`Đã gộp: ${result.movedEnrollments} lớp và ${result.movedAttendance} lượt điểm danh chuyển sang ${kept?.code ?? ""} ${kept?.fullName ?? ""}. Hồ sơ còn lại đã được lưu trữ.`);
    }
  }

  async function dismiss() {
    if (await action.run(() => academicsApi.dismissStudentDuplicate(centerId, student.id, student.version)))
      onDone(`Đã bỏ cảnh báo trùng của ${student.fullName}.`);
  }

  const card = (value: Student | undefined, label: string, which: "this" | "other") => (
    <label className={`choice-card${keep === which ? " is-selected" : ""}`}>
      <input type="radio" name="keep" checked={keep === which} onChange={() => setKeep(which)} />
      <span>
        <strong>{value ? `${value.code} · ${value.fullName}` : "…"}</strong>
        <small>{label}{value?.hasAccount ? " · đã gắn tài khoản" : " · chưa có tài khoản"}{value?.parentPhone ? ` · PH ${value.parentName ?? ""}` : ""}</small>
      </span>
    </label>
  );

  return (
    <Dialog
      open
      size="md"
      title="Hai hồ sơ có phải cùng một học sinh?"
      description={student.duplicateReason === "SameAccount"
        ? "Người giữ link kích hoạt của một hồ sơ đang đăng nhập bằng tài khoản của hồ sơ kia — gần như chắc chắn là một em. Hãy kiểm tra tên trước khi gộp (anh chị em dùng chung Gmail cũng gây ra tình huống này)."
        : "Chỉ trùng tên. Hãy kiểm tra phụ huynh và lớp học trước khi gộp."}
      onClose={onClose}
      footer={
        <>
          <Button onClick={() => void dismiss()} disabled={action.pending}>Không phải một người</Button>
          <Button variant="primary" icon={<UserCheck aria-hidden="true" />} pending={action.pending} onClick={() => void merge()} disabled={!other.data}>Gộp vào hồ sơ đã chọn</Button>
        </>
      }
    >
      <ErrorNotice error={other.error} onReload={() => void other.reload()} />
      <fieldset className="stack">
        <legend className="field-label">Giữ lại hồ sơ nào?</legend>
        {card(student, "Hồ sơ này", "this")}
        {card(other.data, "Hồ sơ kia", "other")}
      </fieldset>
      <p className="cell-note">Lớp, điểm danh, yêu cầu và tài khoản của hồ sơ còn lại được chuyển sang hồ sơ giữ lại; hồ sơ còn lại được lưu trữ. Không gộp được khi hai hồ sơ cùng đang học một lớp.</p>
      <ErrorNotice error={action.error} onDismiss={action.clearError} />
    </Dialog>
  );
}

// ---------------- Class page: invite links + activation links for the whole class ----------------

const VALID_DAYS: Array<{ value: 1 | 7 | 30; label: string }> = [
  { value: 1, label: "1 ngày" },
  { value: 7, label: "7 ngày" },
  { value: 30, label: "30 ngày" },
];

export function ClassInvitesPanel({ teachingClass }: { teachingClass: TeachingClass }) {
  const { centerId } = useCenter();
  const invites = useResource(() => academicsApi.listClassInvites(centerId, teachingClass.id), [centerId, teachingClass.id]);
  const joins = useResource(() => academicsApi.listClassInviteJoins(centerId, teachingClass.id), [centerId, teachingClass.id]);
  const action = useAction();
  const [validDays, setValidDays] = useState<1 | 7 | 30>(7);
  const [maxUses, setMaxUses] = useState("");
  const [classLinks, setClassLinks] = useState<ActivationLink[] | null>(null);
  const active = (invites.data ?? []).filter((x) => x.isActive);

  async function create() {
    const uses = maxUses.trim() ? Number(maxUses) : null;
    if (await action.run(() => academicsApi.createClassInvite(centerId, teachingClass.id, { validDays, maxUses: uses }))) {
      setMaxUses("");
      void invites.reload();
    }
  }

  async function change(invite: ClassInvite, kind: "revoke" | "recode") {
    const done = await action.run(() => kind === "revoke"
      ? academicsApi.revokeClassInvite(centerId, invite.id)
      : academicsApi.recodeClassInvite(centerId, invite.id));
    if (done) void invites.reload();
  }

  async function activationForClass() {
    const links = await action.run(() => academicsApi.createClassActivationLinks(centerId, teachingClass.id));
    if (links) setClassLinks(links);
  }

  return (
    <Panel
      title={<span className="title-with-count"><Ticket aria-hidden="true" />Mời vào lớp bằng link</span>}
      description="Cho học sinh MỚI: gửi link và mã vào nhóm Zalo; em đăng nhập Google, nhập mã là vào lớp ngay, không cần duyệt. Học sinh đã có hồ sơ ở trung tâm thì dùng link kích hoạt riêng."
      actions={<Button size="sm" variant="ghost" icon={<RefreshCcw aria-hidden="true" />} aria-label="Làm mới" onClick={() => { void invites.reload(); void joins.reload(); }} />}
    >
      <div className="panel-body stack">
        <ErrorNotice error={invites.error ?? action.error} onReload={() => void invites.reload()} onDismiss={action.clearError} />
        {!invites.data ? (
          <SkeletonRows rows={2} columns={2} />
        ) : active.length === 0 ? (
          <p className="col-muted">Chưa có link mời nào đang hoạt động.</p>
        ) : (
          <ul className="invite-list">
            {active.map((invite) => (
              <li key={invite.id}>
                <div className="copy-row">
                  <code className="code copy-value">{inviteUrl(invite.token)}</code>
                  <CopyButton text={inviteUrl(invite.token)} label="Chép link" />
                </div>
                <div className="copy-row">
                  <span>Mã lớp: <strong className="invite-code">{invite.code}</strong></span>
                  <CopyButton text={invite.code} label="Chép mã" />
                  <CopyButton text={`Đăng ký lớp ${teachingClass.name}: ${inviteUrl(invite.token)} — Mã: ${invite.code}`} label="Chép cả hai" />
                </div>
                <p className="cell-note">
                  Hạn {formatDateTime(invite.expiresAtUtc)} · Đã dùng {invite.useCount}{invite.maxUses ? `/${invite.maxUses}` : ""} lượt
                </p>
                <div className="inline-action">
                  <Button size="sm" variant="ghost" icon={<Shuffle aria-hidden="true" />} disabled={action.pending} onClick={() => void change(invite, "recode")}>Đổi mã</Button>
                  <Button size="sm" variant="ghost" icon={<Ban aria-hidden="true" />} disabled={action.pending} onClick={() => void change(invite, "revoke")}>Thu hồi</Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {teachingClass.isActive && (
          <div className="invite-create">
            <Field label="Hiệu lực">
              {(id) => (
                <select id={id} value={validDays} onChange={(event) => setValidDays(Number(event.target.value) as 1 | 7 | 30)}>
                  {VALID_DAYS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              )}
            </Field>
            <Field label="Số lượt tối đa" hint="Để trống: không giới hạn (vẫn không vượt sĩ số).">
              {(id, describedBy) => (
                <input id={id} aria-describedby={describedBy} inputMode="numeric" value={maxUses} placeholder="Không giới hạn"
                  onChange={(event) => setMaxUses(event.target.value.replace(/\D/g, "").slice(0, 3))} />
              )}
            </Field>
            <Button variant="primary" icon={<Link2 aria-hidden="true" />} pending={action.pending} onClick={() => void create()}>Tạo link mời</Button>
          </div>
        )}

        <div className="inline-action">
          <div>
            <strong>Học sinh đã có hồ sơ trong lớp</strong>
            <p>Tạo link kích hoạt riêng cho mọi em trong lớp chưa có tài khoản, để gửi cho từng gia đình.</p>
          </div>
          <Button icon={<KeyRound aria-hidden="true" />} pending={action.pending} onClick={() => void activationForClass()}>Link kích hoạt cho cả lớp</Button>
        </div>

        <div>
          <strong>Vào lớp bằng link gần đây</strong>
          {!joins.data ? (
            <SkeletonRows rows={1} columns={2} />
          ) : joins.data.length === 0 ? (
            <p className="col-muted">Chưa có ai vào lớp bằng link.</p>
          ) : (
            <ul className="plain-list">
              {joins.data.slice(0, 10).map((join) => (
                <li key={join.id}>
                  <code className="code">{join.studentCode}</code> {join.fullName}
                  <span className="col-muted"> · {formatDateTime(join.joinedAtUtc)}</span>
                  {join.createdProfile && <Badge tone="info">Hồ sơ mới</Badge>}
                  {join.hadConflicts && <Badge tone="warning">Có trùng lịch</Badge>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {classLinks && (
        <Dialog
          open
          size="lg"
          title={`Link kích hoạt · ${teachingClass.name}`}
          description="Mỗi em một link riêng, dùng một lần, hạn 14 ngày. Gửi đúng link cho đúng gia đình. Link không xem lại được sau khi đóng hộp này; tạo lại sẽ làm các link cũ ngừng hoạt động."
          onClose={() => setClassLinks(null)}
          footer={
            <>
              {classLinks.length > 0 && <CopyButton text={classLinks.map((x) => `${x.studentCode} ${x.fullName}: ${activationUrl(x.token)}`).join("\n")} label="Chép tất cả" />}
              <Button onClick={() => setClassLinks(null)}>Đóng</Button>
            </>
          }
        >
          {classLinks.length === 0 ? (
            <EmptyState icon={<UserCheck aria-hidden="true" />} title="Mọi học sinh trong lớp đều đã có tài khoản">Không cần phát link kích hoạt.</EmptyState>
          ) : (
            <ul className="invite-list">
              {classLinks.map((link) => (
                <li key={link.studentId}>
                  <strong>{link.studentCode} · {link.fullName}</strong>
                  <div className="copy-row">
                    <code className="code copy-value">{activationUrl(link.token)}</code>
                    <CopyButton text={activationUrl(link.token)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Dialog>
      )}
    </Panel>
  );
}
