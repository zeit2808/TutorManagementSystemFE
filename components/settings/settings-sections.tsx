"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CheckCircle2,
  ExternalLink,
  GraduationCap,
  KeyRound,
  Link2,
  LoaderCircle,
  LogOut,
  Mail,
  MailCheck,
  Monitor,
  MonitorSmartphone,
  Moon,
  Palette,
  Save,
  ShieldAlert,
  ShieldCheck,
  Sun,
  UserRound,
} from "lucide-react";
import { authApi, identityApi, type CurrentUser, type EmailChangeStarted } from "@/lib/api";
import { accountName, clearAccount, setAccount, useAccount } from "@/lib/auth/account";
import { useSessionUser, type SessionUser } from "@/lib/auth/session";
import { useLogout } from "@/lib/auth/use-logout";
import { forgetWorkspace } from "@/lib/auth/workspace";
import { useAction } from "@/lib/hooks/use-resource";
import { useNow } from "@/lib/hooks/use-now";
import { formatPhone, initials } from "@/lib/format";
import { roleLabel } from "@/lib/labels";
import { themeOptions, useTheme, type ThemePreference } from "@/lib/theme";
import { isStrongPassword, validateEmail, validateVietnamMobile } from "@/lib/validation";
import { Badge, Button, ErrorNotice, Field, Notice } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/reason-dialog";
import { GoogleButton } from "@/components/auth/google-login-button";
import { PasswordChecklist } from "@/components/auth/password-checklist";
import { SettingsCard, SettingsPanel, settingsGroups } from "./settings-frame";

/** Waits for the shared account; explains a failed load in place. */
function useLoadedAccount() {
  const { user } = useSessionUser();
  const { account, error, reload } = useAccount(Boolean(user));
  const gate = account ? null : error ? (
    <ErrorNotice error={error} onReload={() => void reload()} />
  ) : (
    <p className="col-muted inline-status"><LoaderCircle className="spin" aria-hidden="true" />Đang tải tài khoản…</p>
  );
  return { user, account, gate };
}

/* ───────── Overview (/settings) ───────── */

export function SettingsHome() {
  const { user, account } = useLoadedAccount();
  const { preference } = useTheme();
  const name = accountName(account, user);
  const summaries: Record<string, string> = {
    "/settings/profile": account ? (account.phoneNumber ? formatPhone(account.phoneNumber) : "Chưa có số điện thoại") : "…",
    "/settings/email": account ? `${account.email}${account.emailVerified ? " · đã xác minh" : " · chưa xác minh"}` : "…",
    "/settings/password": account ? (account.hasPassword ? "Đã đặt mật khẩu" : "Đăng nhập bằng Google") : "…",
    "/settings/google": account ? (account.hasGoogle ? "Đã liên kết" : "Chưa liên kết") : "…",
    "/settings/sessions": "Thiết bị này và các thiết bị khác",
    "/settings/appearance": themeOptions.find((option) => option.value === preference)?.label ?? "Theo thiết bị",
  };
  return (
    <div className="settings-overview">
      <div className="settings-welcome">
        <span className="account-avatar settings-welcome-avatar" aria-hidden="true">{initials(name)}</span>
        <div>
          <h2>Xin chào, {name}</h2>
          <p>Quản lý thông tin cá nhân, bảo mật và giao diện của tài khoản. Thay đổi áp dụng cho mọi trung tâm bạn tham gia.</p>
          {user && user.roles.length > 0 && <p className="settings-welcome-roles">{user.roles.map((role) => <Badge key={role} tone="brand">{roleLabel(role)}</Badge>)}</p>}
        </div>
      </div>
      {settingsGroups.map((group) => (
        <section key={group.label} className="settings-overview-group" aria-label={group.label}>
          <h3>{group.label}</h3>
          <div className="settings-tiles">
            {group.items.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="settings-tile">
                <span className="settings-nav-icon"><Icon aria-hidden="true" /></span>
                <span><strong>{label}</strong><small>{summaries[href]}</small></span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ───────── Profile ───────── */

export function ProfileSettings() {
  const { user, account, gate } = useLoadedAccount();
  return (
    <SettingsPanel icon={UserRound} title="Hồ sơ cá nhân" description="Tên và số điện thoại mọi trung tâm bạn tham gia nhìn thấy.">
      {gate ?? (account && user && <ProfileForm key={account.id} account={account} user={user} />)}
    </SettingsPanel>
  );
}

function ProfileForm({ account, user }: { account: CurrentUser; user: SessionUser }) {
  const [displayName, setDisplayName] = useState(account.displayName ?? "");
  const [phone, setPhone] = useState(account.phoneNumber ? formatPhone(account.phoneNumber).replace(/\s/g, "") : "");
  const [touched, setTouched] = useState(false);
  const [saved, setSaved] = useState(false);
  const save = useAction();
  const phoneRequired = !user.isStudent;

  const errors = {
    displayName: displayName.trim().length > 100 ? "Họ tên tối đa 100 ký tự." : null,
    phone: !phone.trim() ? (phoneRequired ? "Tài khoản nhân sự cần số điện thoại để trung tâm liên hệ." : null) : validateVietnamMobile(phone, true),
  };
  const initialPhone = account.phoneNumber ? formatPhone(account.phoneNumber).replace(/\s/g, "") : "";
  const dirty = displayName.trim() !== (account.displayName ?? "") || phone.replace(/[\s.()-]/g, "") !== initialPhone;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    setSaved(false);
    if (errors.displayName || errors.phone || !dirty) return;
    const next = await save.run(() => identityApi.updateProfile({
      displayName: displayName.trim() || null,
      phoneNumber: phone.trim() || null,
    }));
    if (next) {
      // Show what the server stored (trimmed name, +84 phone) so the form is clean again.
      setDisplayName(next.displayName ?? "");
      setPhone(next.phoneNumber ? formatPhone(next.phoneNumber).replace(/\s/g, "") : "");
      setTouched(false);
      setAccount(next);
      setSaved(true);
    }
  }

  const name = accountName({ ...account, displayName: displayName.trim() || null }, user);
  return (
    <>
      {saved && <Notice tone="success" onDismiss={() => setSaved(false)}>Đã lưu hồ sơ. Tên mới hiện ngay ở góc trên màn hình.</Notice>}
      <SettingsCard>
        <div className="profile-preview">
          <span className="account-avatar profile-preview-avatar" aria-hidden="true">{initials(name)}</span>
          <div>
            <strong>{name}</strong>
            <small>{account.username ? `@${account.username}` : account.email}</small>
          </div>
        </div>
        <form onSubmit={submit} noValidate>
          <div className="settings-body">
            <Field label="Họ tên hiển thị" hint="Để trống thì hiện tên đăng nhập. Tối đa 100 ký tự." error={touched ? errors.displayName : null}>
              {(id, describedBy) => (
                <input id={id} aria-describedby={describedBy} autoComplete="name" maxLength={120} value={displayName} placeholder={account.username ?? "Ví dụ: Nguyễn Văn An"} onChange={(event) => setDisplayName(event.target.value)} />
              )}
            </Field>
            <Field label="Số điện thoại" required={phoneRequired} hint="Số di động Việt Nam. Mỗi số chỉ dùng cho một tài khoản." error={touched ? errors.phone : null}>
              {(id, describedBy) => (
                <input id={id} aria-describedby={describedBy} type="tel" inputMode="tel" autoComplete="tel" value={phone} placeholder="0912345678" onChange={(event) => setPhone(event.target.value)} />
              )}
            </Field>
            <div className="settings-pair">
              <ReadOnlyRow label="Tên đăng nhập" value={account.username ?? "Không có (đăng nhập bằng Google)"} hint="Dùng để đăng nhập, không đổi được." />
              <ReadOnlyRow label="Email đăng nhập" value={account.email} hint={<Link href="/settings/email">Đổi email</Link>} />
            </div>
            <ErrorNotice error={save.error} />
          </div>
          <footer className="settings-footer">
            {dirty && (
              <Button onClick={() => { setDisplayName(account.displayName ?? ""); setPhone(initialPhone); setTouched(false); }} disabled={save.pending}>Huỷ thay đổi</Button>
            )}
            <Button type="submit" variant="primary" icon={<Save aria-hidden="true" />} pending={save.pending} status={save.status} disabled={!dirty}>Lưu hồ sơ</Button>
          </footer>
        </form>
      </SettingsCard>
    </>
  );
}

function ReadOnlyRow({ label, value, hint }: { label: string; value: string; hint?: React.ReactNode }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <p className="readonly-value">{value}</p>
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

/* ───────── Email ───────── */

export function EmailSettings() {
  const { account, gate } = useLoadedAccount();
  return (
    <SettingsPanel icon={Mail} title="Email đăng nhập" description="Email nhận thư hệ thống, mã đặt lại mật khẩu và lời mời. Đổi email cần xác nhận bằng mã gửi tới địa chỉ mới.">
      {gate ?? (account && <EmailChange account={account} />)}
    </SettingsPanel>
  );
}

function EmailChange({ account }: { account: CurrentUser }) {
  const now = useNow(1000);
  const [editing, setEditing] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [touched, setTouched] = useState(false);
  const [started, setStarted] = useState<EmailChangeStarted | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const request = useAction({ redirectOnUnauthorized: false });
  const confirm = useAction({ redirectOnUnauthorized: false });

  const current = (
    <div className="settings-status">
      {account.emailVerified ? <BadgeCheck aria-hidden="true" /> : <ShieldAlert className="tone-text-warning" aria-hidden="true" />}
      <div>
        <strong className="break-anywhere">{account.email}</strong>
        <p>{account.emailVerified ? "Đã xác minh" : "Chưa xác minh"}{account.hasGoogle ? " · đăng nhập Google vẫn vào đúng tài khoản này dù đổi email" : ""}</p>
      </div>
      {account.hasPassword && !editing && <Button onClick={() => { setEditing(true); setDone(null); }}>Đổi email</Button>}
    </div>
  );

  if (!account.hasPassword) {
    return (
      <SettingsCard>
        {current}
        <div className="settings-body">
          <Notice tone="info" title="Email đi theo tài khoản Google">Tài khoản này đăng nhập bằng Google nên dùng chính email của tài khoản Google, không đổi ở đây được.</Notice>
        </div>
      </SettingsCard>
    );
  }

  function reset() {
    setEditing(false);
    setStarted(null);
    setNewEmail("");
    setPassword("");
    setOtp("");
    setTouched(false);
    request.clearError();
    confirm.clearError();
  }

  const step1Errors = {
    email: validateEmail(newEmail) ?? (newEmail.trim().toLowerCase() === account.email.toLowerCase() ? "Đây đang là email đăng nhập hiện tại." : null),
    password: password ? null : "Nhập mật khẩu hiện tại để xác nhận là bạn.",
  };

  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    setTouched(true);
    if (step1Errors.email || step1Errors.password) return;
    const result = await request.run(() => identityApi.requestEmailChange(newEmail.trim(), password));
    if (result) {
      setStarted(result);
      setOtp("");
      setTouched(false);
    }
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!started || !/^\d{8}$/.test(otp)) return;
    const next = await confirm.run(() => identityApi.confirmEmailChange(started.newEmail, otp));
    if (next) {
      setAccount(next);
      setDone(next.email);
      reset();
    }
  }

  const resendIn = started ? Math.max(0, Math.ceil((Date.parse(started.resendAvailableAtUtc) - now) / 1000)) : 0;
  const expired = started ? Date.parse(started.expiresAtUtc) <= now : false;

  return (
    <>
      {done && <Notice tone="success" onDismiss={() => setDone(null)}>Đã đổi email đăng nhập thành {done}. Email cũ nhận được thư báo về thay đổi này.</Notice>}
      <SettingsCard>
        {current}
        {editing && !started && (
          <form onSubmit={sendCode} noValidate>
            <div className="settings-body">
              <ol className="settings-stepper" aria-label="Các bước đổi email">
                <li aria-current="step">1. Email mới</li>
                <li>2. Nhập mã xác nhận</li>
              </ol>
              <div className="settings-pair">
                <Field label="Email mới" required error={touched ? step1Errors.email : null}>
                  {(id, describedBy) => <input id={id} aria-describedby={describedBy} type="email" inputMode="email" autoComplete="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} />}
                </Field>
                <Field label="Mật khẩu hiện tại" required error={touched ? step1Errors.password : null}>
                  {(id, describedBy) => <input id={id} aria-describedby={describedBy} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />}
                </Field>
              </div>
              <p className="col-muted">Mã 8 số sẽ được gửi tới email mới và có hiệu lực 10 phút. Email chỉ đổi sau khi bạn nhập đúng mã.</p>
              <ErrorNotice error={request.error} />
            </div>
            <footer className="settings-footer">
              <Button onClick={reset} disabled={request.pending}>Huỷ</Button>
              <Button type="submit" variant="primary" icon={<Mail aria-hidden="true" />} pending={request.pending} status={request.status}>Gửi mã xác nhận</Button>
            </footer>
          </form>
        )}
        {editing && started && (
          <form onSubmit={submitCode} noValidate>
            <div className="settings-body">
              <ol className="settings-stepper" aria-label="Các bước đổi email">
                <li>1. Email mới</li>
                <li aria-current="step">2. Nhập mã xác nhận</li>
              </ol>
              <Notice tone="info" title="Kiểm tra hộp thư">Đã gửi mã 8 số tới <strong className="break-anywhere">{started.newEmail}</strong>. Nếu không thấy, hãy xem thư mục Spam.</Notice>
              <Field label="Mã xác nhận" required error={touched && !/^\d{8}$/.test(otp) ? "Mã gồm 8 chữ số." : null} hint={expired ? "Mã đã hết hạn, hãy gửi mã mới." : undefined}>
                {(id, describedBy) => (
                  <input id={id} aria-describedby={describedBy} className="otp-input" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 8))} />
                )}
              </Field>
              <ErrorNotice error={confirm.error ?? request.error} />
            </div>
            <footer className="settings-footer">
              <Button onClick={() => void sendCode()} disabled={resendIn > 0 || request.pending} pending={request.pending}>
                {resendIn > 0 ? `Gửi lại mã (${resendIn}s)` : "Gửi lại mã"}
              </Button>
              <Button onClick={reset} disabled={confirm.pending}>Huỷ</Button>
              <Button type="submit" variant="primary" icon={<MailCheck aria-hidden="true" />} pending={confirm.pending} status={confirm.status}>Xác nhận đổi email</Button>
            </footer>
          </form>
        )}
      </SettingsCard>
    </>
  );
}

/* ───────── Password ───────── */

export function PasswordSettings() {
  const { account, gate } = useLoadedAccount();
  return (
    <SettingsPanel icon={KeyRound} title="Mật khẩu" description="Đổi mật khẩu giữ lại phiên đang dùng và đăng xuất mọi thiết bị khác.">
      {gate ?? (account && (account.hasPassword ? <ChangePasswordForm /> : <GoogleOnlyNotice />))}
    </SettingsPanel>
  );
}

function GoogleOnlyNotice() {
  return (
    <SettingsCard>
      <div className="settings-status">
        <ShieldCheck aria-hidden="true" />
        <div>
          <strong>Đăng nhập bằng Google, không có mật khẩu riêng</strong>
          <p>Tài khoản này được tạo khi đăng nhập Google nên hệ thống không lưu mật khẩu nào. Mật khẩu và xác minh 2 bước do Google quản lý.</p>
        </div>
        <a className="btn btn-secondary" href="https://myaccount.google.com/security" target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" />Bảo mật Google</a>
      </div>
    </SettingsCard>
  );
}

/** Change password for an account with a local password. Keeps this session and rotates its tokens. */
export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const change = useAction({ redirectOnUnauthorized: false });

  const errors = {
    current: current ? null : "Nhập mật khẩu hiện tại.",
    next: !isStrongPassword(next) ? "Mật khẩu mới chưa đạt đủ yêu cầu." : next === current ? "Mật khẩu mới phải khác mật khẩu hiện tại." : null,
    confirm: confirm === next ? null : "Hai mật khẩu chưa trùng khớp.",
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    setMessage(null);
    if (Object.values(errors).some(Boolean)) return;
    const ok = await change.run(async () => {
      await authApi.changePassword({ currentPassword: current, newPassword: next, confirmPassword: confirm });
      return true;
    });
    if (ok) {
      setCurrent("");
      setNext("");
      setConfirm("");
      setTouched(false);
      setMessage("Đã đổi mật khẩu. Phiên này được giữ lại, mọi phiên khác đã bị thu hồi.");
    }
  }

  return (
    <SettingsCard>
      <form onSubmit={submit} noValidate>
        <div className="settings-body">
          {message && <Notice tone="success" onDismiss={() => setMessage(null)}>{message}</Notice>}
          <Field label="Mật khẩu hiện tại" required error={touched ? errors.current : null} hint={<Link href="/forgot-password">Quên mật khẩu?</Link>}>
            {(id, describedBy) => <input id={id} aria-describedby={describedBy} type="password" autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} />}
          </Field>
          <div className="settings-pair">
            <Field label="Mật khẩu mới" required error={touched ? errors.next : null}>
              {(id, describedBy) => <input id={id} aria-describedby={describedBy} type="password" autoComplete="new-password" value={next} onChange={(event) => setNext(event.target.value)} />}
            </Field>
            <Field label="Nhập lại mật khẩu mới" required error={touched ? errors.confirm : null}>
              {(id, describedBy) => <input id={id} aria-describedby={describedBy} type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />}
            </Field>
          </div>
          <PasswordChecklist password={next} />
          <ErrorNotice error={change.error} />
        </div>
        <footer className="settings-footer">
          <Button type="submit" variant="primary" icon={<KeyRound aria-hidden="true" />} pending={change.pending} status={change.status}>Đổi mật khẩu</Button>
        </footer>
      </form>
    </SettingsCard>
  );
}

/* ───────── Google ───────── */

export function GoogleSettings() {
  const { user, account, gate } = useLoadedAccount();
  return (
    <SettingsPanel icon={Link2} title="Đăng nhập Google" description="Liên kết Google để đăng nhập nhanh vào chính tài khoản này. Liên kết không đổi vai trò; hệ thống không tự gộp hai tài khoản trùng email.">
      {gate ?? (account && user && <GoogleLink account={account} user={user} />)}
    </SettingsPanel>
  );
}

function GoogleLink({ account, user }: { account: CurrentUser; user: SessionUser }) {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const link = useAction({ redirectOnUnauthorized: false });
  const { reload } = useAccount(false);

  if (user.isStudent) {
    return (
      <SettingsCard>
        <div className="settings-status">
          <CheckCircle2 aria-hidden="true" />
          <div>
            <strong>Tài khoản học sinh</strong>
            <p>Đăng nhập bằng Google. Tài khoản học sinh chỉ dùng cổng học sinh và không thể làm thành viên trung tâm.</p>
          </div>
          <Link className="btn btn-secondary" href="/student"><GraduationCap aria-hidden="true" />Cổng học sinh</Link>
        </div>
      </SettingsCard>
    );
  }
  if (account.hasGoogle) {
    return (
      <SettingsCard>
        {message && <div className="settings-body"><Notice tone="success" onDismiss={() => setMessage(null)}>{message}</Notice></div>}
        <div className="settings-status">
          <CheckCircle2 aria-hidden="true" />
          <div>
            <strong>Đã liên kết Google</strong>
            <p>Đăng nhập bằng mật khẩu hoặc Google đều vào cùng tài khoản này, với cùng vai trò.</p>
          </div>
        </div>
      </SettingsCard>
    );
  }

  async function linkGoogle(idToken: string) {
    if (!password) return;
    const ok = await link.run(async () => {
      await authApi.linkGoogle(idToken, password);
      return true;
    });
    if (ok) {
      setPassword("");
      setMessage("Đã liên kết Google. Lần sau bạn có thể bấm đăng nhập bằng Google để vào chính tài khoản này.");
      await reload();
    }
  }

  return (
    <SettingsCard>
      <div className="settings-body">
        <div className="settings-steps">
          <Field label="1. Xác nhận mật khẩu hiện tại" required>
            {(id) => <input id={id} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />}
          </Field>
          <div className="field">
            <span className="field-label">2. Chọn tài khoản Google</span>
            {password ? <GoogleButton text="signin_with" onCredential={(token) => void linkGoogle(token)} /> : <p className="settings-placeholder">Nhập mật khẩu ở bước 1 trước</p>}
          </div>
        </div>
        {link.pending && <p className="col-muted inline-status"><LoaderCircle className="spin" aria-hidden="true" />Đang liên kết…</p>}
        <ErrorNotice error={link.error} />
      </div>
    </SettingsCard>
  );
}

/* ───────── Sessions ───────── */

export function SessionsSettings() {
  const router = useRouter();
  const { logout, pending } = useLogout();
  const [confirmAll, setConfirmAll] = useState(false);
  return (
    <SettingsPanel icon={MonitorSmartphone} title="Phiên đăng nhập" description="Dùng khi nghi ngờ tài khoản bị lộ hoặc quên đăng xuất trên máy khác.">
      <SettingsCard>
        <div className="settings-status">
          <LogOut aria-hidden="true" />
          <div>
            <strong>Đăng xuất khỏi thiết bị này</strong>
            <p>Kết thúc phiên trên trình duyệt này. Các thiết bị khác vẫn đăng nhập.</p>
          </div>
          <Button onClick={() => void logout()} pending={pending}>Đăng xuất</Button>
        </div>
      </SettingsCard>
      <SettingsCard tone="danger">
        <div className="settings-status">
          <ShieldAlert aria-hidden="true" />
          <div>
            <strong>Đăng xuất khỏi mọi thiết bị</strong>
            <p>Thu hồi tất cả phiên đăng nhập, kể cả trình duyệt này. Bạn sẽ phải đăng nhập lại ở mọi nơi.</p>
          </div>
          <Button variant="danger" onClick={() => setConfirmAll(true)}>Đăng xuất mọi nơi</Button>
        </div>
      </SettingsCard>
      <ConfirmDialog
        open={confirmAll}
        title="Đăng xuất khỏi mọi thiết bị?"
        confirmLabel="Đăng xuất mọi nơi"
        variant="danger"
        onClose={() => setConfirmAll(false)}
        onConfirm={async () => {
          await authApi.logoutAll();
          clearAccount();
          forgetWorkspace();
          router.replace("/login");
        }}
      >
        <p>Bạn sẽ cần đăng nhập lại trên tất cả thiết bị.</p>
      </ConfirmDialog>
    </SettingsPanel>
  );
}

/* ───────── Appearance ───────── */

const themeIcons: Record<ThemePreference, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };

export function AppearanceSettings() {
  const { preference, resolved, setPreference } = useTheme();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 0);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <SettingsPanel icon={Palette} title="Giao diện" description="Chọn nền sáng hoặc tối. Lựa chọn được lưu trên trình duyệt này.">
      <SettingsCard>
        <fieldset className="theme-picker">
          <legend className="sr-only">Chế độ giao diện</legend>
          {themeOptions.map((option) => {
            const Icon = themeIcons[option.value];
            return (
              <label key={option.value} className="theme-choice" data-checked={ready && preference === option.value ? "true" : undefined}>
                <input type="radio" name="theme" value={option.value} checked={ready && preference === option.value} onChange={() => setPreference(option.value)} />
                <span className={`theme-preview theme-preview-${option.value}`} aria-hidden="true">
                  <span className="theme-preview-bar" />
                  <span className="theme-preview-line" />
                  <span className="theme-preview-line is-short" />
                </span>
                <span className="theme-choice-text">
                  <strong><Icon aria-hidden="true" />{option.label}</strong>
                  <small>{option.description}</small>
                </span>
              </label>
            );
          })}
        </fieldset>
        <p className="settings-card-foot">Đang hiển thị: <strong>{ready ? (resolved === "dark" ? "Tối" : "Sáng") : "…"}</strong>. Bản in (biên nhận) luôn dùng nền trắng.</p>
      </SettingsCard>
    </SettingsPanel>
  );
}
