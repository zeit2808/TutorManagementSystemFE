"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, Building2, CheckCircle2, ExternalLink, GraduationCap, KeyRound, LoaderCircle, LogOut, ShieldCheck } from "lucide-react";
import { authApi, identityApi } from "@/lib/api";
import { useSessionUser } from "@/lib/auth/session";
import { useAction, useResource } from "@/lib/hooks/use-resource";
import { isStrongPassword } from "@/lib/validation";
import { roleLabel } from "@/lib/labels";
import { initials } from "@/lib/format";
import { Badge, Button, ErrorNotice, Field, Notice, BackButton } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/reason-dialog";
import { GoogleButton } from "./google-login-button";
import { PasswordChecklist } from "./password-checklist";

/** One settings row: what the section is on the left, the controls on the right. */
function SettingsSection({ id, title, description, children, tone }: { id: string; title: string; description: ReactNode; children: ReactNode; tone?: "danger" }) {
  return (
    <section className="settings-section" aria-labelledby={id}>
      <header className="settings-intro">
        <h2 id={id}>{title}</h2>
        <p>{description}</p>
      </header>
      <div className={`settings-card${tone === "danger" ? " settings-card-danger" : ""}`}>{children}</div>
    </section>
  );
}

export function SecuritySettings() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, status, reload } = useSessionUser();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);
  const [linkPassword, setLinkPassword] = useState("");
  const [logoutAll, setLogoutAll] = useState(false);
  const change = useAction({ redirectOnUnauthorized: false });
  const link = useAction({ redirectOnUnauthorized: false });
  // Sign-in methods are not in the access token; read them so a Google-only account is not offered a password form.
  const account = useResource(() => identityApi.me(), [user?.userId]);
  const hasPassword = account.data?.hasPassword;

  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [pathname, router, status]);

  const errors = {
    current: current ? null : "Nhập mật khẩu hiện tại.",
    next: !isStrongPassword(next) ? "Mật khẩu mới chưa đạt đủ yêu cầu." : next === current ? "Mật khẩu mới phải khác mật khẩu hiện tại." : null,
    confirm: confirm === next ? null : "Hai mật khẩu chưa trùng khớp.",
  };

  async function submitChange(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    setPasswordMessage(null);
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
      setPasswordMessage("Đã đổi mật khẩu. Phiên này được giữ lại, mọi phiên khác đã bị thu hồi.");
    }
  }

  async function linkGoogle(idToken: string) {
    if (!linkPassword) return;
    const ok = await link.run(async () => {
      await authApi.linkGoogle(idToken, linkPassword);
      return true;
    });
    if (ok) {
      setLinkPassword("");
      setLinkMessage("Đã liên kết Google. Lần sau bạn có thể bấm đăng nhập bằng Google để vào chính tài khoản này.");
      await Promise.all([reload(), account.reload()]);
    }
  }

  async function logout() {
    await authApi.logout();
    router.replace("/login");
  }

  if (status !== "ready" || !user) {
    return <main className="standalone-state"><LoaderCircle className="spin" aria-hidden="true" /><h1>Đang tải tài khoản</h1></main>;
  }

  const displayName = user.username ?? account.data?.email ?? "Tài khoản Google";
  // Student accounts (created by Google sign-in) and staff accounts are separate kinds; each has its own home.
  const home = user.isStudent ? "/student" : "/select-center";

  return (
    <div className="select-page">
      <header className="select-bar">
        <Link className="brand brand-dark" href={home}><span className="brand-mark"><BookOpen aria-hidden="true" /></span><strong>Quản Lý Dạy Thêm</strong></Link>
        <nav>
          <button type="button" onClick={() => void logout()}><LogOut aria-hidden="true" /><span>Đăng xuất</span></button>
        </nav>
      </header>

      <main className="settings-page">
        <BackButton href={home}>{user.isStudent ? "Cổng học sinh" : "Nơi làm việc"}</BackButton>

        <div className="settings-hero">
          <span className="settings-avatar" aria-hidden="true">{initials(displayName)}</span>
          <div>
            <h1>Tài khoản &amp; bảo mật</h1>
            <p>
              <strong>{displayName}</strong>
              {user.roles.length > 0 ? user.roles.map((role) => <Badge key={role} tone="brand">{roleLabel(role)}</Badge>) : <span className="col-muted">Vai trò được gán theo từng trung tâm</span>}
            </p>
          </div>
        </div>

        <SettingsSection id="password" title="Mật khẩu" description="Đổi mật khẩu giữ lại phiên đang dùng và thu hồi mọi phiên khác. Chỉ áp dụng cho tài khoản có mật khẩu cục bộ.">
          {hasPassword === undefined ? (
            <div className="settings-body">
              <ErrorNotice error={account.error} onReload={() => void account.reload()} />
              {!account.error && <p className="col-muted inline-status"><LoaderCircle className="spin" aria-hidden="true" />Đang kiểm tra cách đăng nhập…</p>}
            </div>
          ) : !hasPassword ? (
            <div className="settings-status">
              <ShieldCheck aria-hidden="true" />
              <div>
                <strong>Đăng nhập bằng Google, không có mật khẩu riêng</strong>
                <p>Tài khoản này được tạo khi đăng nhập Google nên hệ thống không lưu mật khẩu nào. Mật khẩu và xác minh 2 bước do Google quản lý.</p>
              </div>
              <a className="btn btn-secondary" href="https://myaccount.google.com/security" target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" />Bảo mật Google</a>
            </div>
          ) : (
          <form onSubmit={submitChange} noValidate>
            <div className="settings-body">
              {passwordMessage && <Notice tone="success" onDismiss={() => setPasswordMessage(null)}>{passwordMessage}</Notice>}
              <Field label="Mật khẩu hiện tại" required error={touched ? errors.current : null}>
                {(id) => <input id={id} type="password" autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} />}
              </Field>
              <div className="settings-pair">
                <Field label="Mật khẩu mới" required error={touched ? errors.next : null}>
                  {(id) => <input id={id} type="password" autoComplete="new-password" value={next} onChange={(event) => setNext(event.target.value)} />}
                </Field>
                <Field label="Nhập lại mật khẩu mới" required error={touched ? errors.confirm : null}>
                  {(id) => <input id={id} type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />}
                </Field>
              </div>
              <PasswordChecklist password={next} />
              <ErrorNotice error={change.error} />
            </div>
            <footer className="settings-footer">
              <Button type="submit" variant="primary" icon={<KeyRound aria-hidden="true" />} pending={change.pending} status={change.status}>Đổi mật khẩu</Button>
            </footer>
          </form>
          )}
        </SettingsSection>

        <SettingsSection id="google" title="Đăng nhập Google" description={user.isStudent
          ? "Tài khoản học sinh được tạo và đăng nhập bằng Google."
          : "Liên kết Google để đăng nhập nhanh vào chính tài khoản này. Liên kết không thay đổi vai trò; hệ thống không tự gộp hai tài khoản trùng email."}>
          {user.isStudent ? (
            <div className="settings-status">
              <CheckCircle2 aria-hidden="true" />
              <div>
                <strong>Tài khoản học sinh</strong>
                <p>Đăng nhập bằng Google. Tài khoản học sinh chỉ dùng cổng học sinh và không thể làm thành viên trung tâm.</p>
              </div>
              <Link className="btn btn-secondary" href="/student"><GraduationCap aria-hidden="true" />Cổng học sinh</Link>
            </div>
          ) : account.data?.hasGoogle ? (
            <div className="settings-status">
              <CheckCircle2 aria-hidden="true" />
              <div>
                <strong>Đã liên kết Google</strong>
                <p>Đăng nhập bằng mật khẩu hoặc Google đều vào cùng tài khoản này, với cùng vai trò.</p>
              </div>
            </div>
          ) : (
            <div className="settings-body">
              {linkMessage && <Notice tone="success" onDismiss={() => setLinkMessage(null)}>{linkMessage}</Notice>}
              <div className="settings-steps">
                <Field label="1. Xác nhận mật khẩu hiện tại" required>
                  {(id) => <input id={id} type="password" autoComplete="current-password" value={linkPassword} onChange={(event) => setLinkPassword(event.target.value)} />}
                </Field>
                <div className="field">
                  <span className="field-label">2. Chọn tài khoản Google</span>
                  {linkPassword ? (
                    <GoogleButton text="signin_with" onCredential={(token) => void linkGoogle(token)} />
                  ) : (
                    <p className="settings-placeholder">Nhập mật khẩu ở bước 1 trước</p>
                  )}
                </div>
              </div>
              {link.pending && <p className="col-muted inline-status"><LoaderCircle className="spin" aria-hidden="true" />Đang liên kết…</p>}
              <ErrorNotice error={link.error} />
            </div>
          )}
        </SettingsSection>

        {user.isStudent ? (
          <SettingsSection id="workspaces" title="Nơi học" description="Một tài khoản học sinh dùng cho mọi trung tâm em đăng ký học.">
            <ul className="settings-links">
              <li><Link href="/student"><GraduationCap aria-hidden="true" /><span><strong>Cổng học sinh</strong><small>Đăng ký lớp và xem lịch học</small></span></Link></li>
            </ul>
          </SettingsSection>
        ) : (
          <SettingsSection id="workspaces" title="Nơi làm việc" description="Vai trò toàn hệ thống mở thêm khu vực riêng; vai trò trong trung tâm được gán theo từng trung tâm.">
            <ul className="settings-links">
              <li><Link href="/select-center"><Building2 aria-hidden="true" /><span><strong>Trung tâm của tôi</strong><small>Chọn trung tâm để làm việc</small></span></Link></li>
              {user.isPlatformAdmin && <li><Link href="/platform"><ShieldCheck aria-hidden="true" /><span><strong>Quản trị nền tảng</strong><small>Duyệt trung tâm và yêu cầu đổi hồ sơ</small></span></Link></li>}
            </ul>
          </SettingsSection>
        )}

        <SettingsSection id="sessions" title="Phiên đăng nhập" description="Dùng khi nghi ngờ tài khoản bị lộ hoặc quên đăng xuất trên máy khác." tone="danger">
          <div className="settings-status">
            <LogOut aria-hidden="true" />
            <div>
              <strong>Đăng xuất khỏi mọi thiết bị</strong>
              <p>Thu hồi tất cả phiên đăng nhập, kể cả trình duyệt này.</p>
            </div>
            <Button variant="danger" onClick={() => setLogoutAll(true)}>Đăng xuất mọi nơi</Button>
          </div>
        </SettingsSection>
      </main>

      <ConfirmDialog
        open={logoutAll}
        title="Đăng xuất khỏi mọi thiết bị?"
        confirmLabel="Đăng xuất mọi nơi"
        variant="danger"
        onClose={() => setLogoutAll(false)}
        onConfirm={async () => {
          await authApi.logoutAll();
          router.replace("/login");
        }}
      >
        <p>Bạn sẽ cần đăng nhập lại trên tất cả thiết bị.</p>
      </ConfirmDialog>
    </div>
  );
}
