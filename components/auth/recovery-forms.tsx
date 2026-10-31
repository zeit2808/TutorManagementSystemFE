"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, MailCheck, Send } from "lucide-react";
import { authApi } from "@/lib/api";
import { useAction } from "@/lib/hooks/use-resource";
import { isStrongPassword, validateEmail, validateUsername, validateVietnamMobile } from "@/lib/validation";
import { Button, ErrorNotice, Field, Notice } from "@/components/ui/primitives";
import { PasswordChecklist } from "./password-checklist";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState(false);
  const action = useAction({ redirectOnUnauthorized: false });
  const error = validateEmail(email);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (error) return;
    const ok = await action.run(async () => {
      await authApi.forgotPassword(email.trim());
      return true;
    });
    if (ok) setSent(true);
  }

  if (sent) {
    return (
      <div className="stack">
        <Notice tone="success" title="Đã ghi nhận yêu cầu">
          Nếu email thuộc một tài khoản, mã OTP 8 chữ số sẽ được gửi tới hộp thư. Hệ thống luôn trả lời giống nhau để không lộ tài khoản nào tồn tại.
        </Notice>
        <Link className="btn btn-primary btn-block" href={`/reset-password?email=${encodeURIComponent(email.trim())}`}>Nhập mã OTP <ArrowRight aria-hidden="true" /></Link>
      </div>
    );
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <Field label="Email tài khoản" required error={touched ? error : null}>
        {(id) => <input id={id} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />}
      </Field>
      <ErrorNotice error={action.error} />
      <Button type="submit" variant="primary" className="btn-block" icon={<Send aria-hidden="true" />} pending={action.pending} status={action.status}>Gửi mã khôi phục</Button>
    </form>
  );
}

export function ResetPasswordForm({ initialEmail = "" }: { initialEmail?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const action = useAction({ redirectOnUnauthorized: false });

  const errors = {
    email: validateEmail(email),
    otp: /^\d{8}$/.test(otp) ? null : "OTP gồm đúng 8 chữ số.",
    password: isStrongPassword(password) ? null : "Mật khẩu chưa đạt đủ các yêu cầu bên dưới.",
    confirm: confirm === password ? null : "Hai mật khẩu chưa trùng khớp.",
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (Object.values(errors).some(Boolean)) return;
    const ok = await action.run(async () => {
      await authApi.resetPassword({ email: email.trim(), otp, newPassword: password, confirmPassword: confirm });
      return true;
    });
    if (ok) router.replace("/login?reset=success");
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <Field label="Email" required error={touched ? errors.email : null}>
        {(id) => <input id={id} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />}
      </Field>
      <Field label="Mã OTP" required error={touched ? errors.otp : null} hint="Mã dùng một lần, có hạn và giới hạn số lần thử.">
        {(id, describedBy) => <input id={id} aria-describedby={describedBy} inputMode="numeric" autoComplete="one-time-code" maxLength={8} className="input-otp" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} />}
      </Field>
      <Field label="Mật khẩu mới" required error={touched ? errors.password : null}>
        {(id) => <input id={id} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />}
      </Field>
      <PasswordChecklist password={password} />
      <Field label="Nhập lại mật khẩu mới" required error={touched ? errors.confirm : null}>
        {(id) => <input id={id} type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />}
      </Field>
      <Notice tone="info">Sau khi đặt lại, mọi phiên đăng nhập bị thu hồi và bạn cần đăng nhập lại.</Notice>
      <ErrorNotice error={action.error} />
      <Button type="submit" variant="primary" className="btn-block" pending={action.pending} status={action.status}>Đặt lại mật khẩu</Button>
    </form>
  );
}

export function VerifyEmailForm({ initialToken = "" }: { initialToken?: string }) {
  const [token, setToken] = useState(initialToken);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const verify = useAction({ redirectOnUnauthorized: false });
  const resend = useAction({ redirectOnUnauthorized: false });

  async function submitVerify(event: React.FormEvent) {
    event.preventDefault();
    if (!token.trim()) return;
    const ok = await verify.run(async () => {
      await authApi.verifyEmail(token.trim());
      return true;
    });
    if (ok) setMessage("Email đã được xác minh. Bạn có thể đăng nhập.");
  }

  async function submitResend() {
    if (validateEmail(email)) return;
    const ok = await resend.run(async () => {
      await authApi.resendVerificationEmail(email.trim());
      return true;
    });
    if (ok) setMessage("Nếu tài khoản phù hợp và chưa xác minh, email xác minh mới đã được gửi.");
  }

  return (
    <div className="stack">
      {message && <Notice tone="success" action={<Link className="btn btn-sm btn-secondary" href="/login">Đăng nhập</Link>}>{message}</Notice>}
      <form className="stack" onSubmit={submitVerify} noValidate>
        <Field label="Mã xác minh">
          {(id) => <input id={id} value={token} onChange={(event) => setToken(event.target.value)} />}
        </Field>
        <ErrorNotice error={verify.error} />
        <Button type="submit" variant="primary" className="btn-block" icon={<MailCheck aria-hidden="true" />} pending={verify.pending} status={verify.status} disabled={!token.trim()}>Xác minh email</Button>
      </form>
      <div className="divider"><span>hoặc gửi lại email xác minh</span></div>
      <div className="stack">
        <Field label="Email tài khoản">
          {(id) => <input id={id} type="email" value={email} onChange={(event) => setEmail(event.target.value)} />}
        </Field>
        <ErrorNotice error={resend.error} />
        <Button onClick={() => void submitResend()} pending={resend.pending} status={resend.status} disabled={Boolean(validateEmail(email))}>Gửi lại</Button>
      </div>
    </div>
  );
}

export function AcceptInvitationForm({ initialToken = "" }: { initialToken?: string }) {
  const router = useRouter();
  const [token, setToken] = useState(initialToken);
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const action = useAction({ redirectOnUnauthorized: false });

  const errors = {
    token: token.trim() ? null : "Thiếu mã lời mời trong email.",
    username: validateUsername(username),
    phone: validateVietnamMobile(phone, true),
    password: isStrongPassword(password) ? null : "Mật khẩu chưa đạt đủ các yêu cầu bên dưới.",
    confirm: confirm === password ? null : "Hai mật khẩu chưa trùng khớp.",
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (Object.values(errors).some(Boolean)) return;
    const ok = await action.run(async () => {
      await authApi.acceptInvitation({ token: token.trim(), username: username.trim(), password, phoneNumber: phone.replace(/[\s.()-]/g, "") });
      return true;
    });
    if (ok) router.replace("/login?invitation=accepted");
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      {!initialToken && (
        <Field label="Mã lời mời" required error={touched ? errors.token : null} hint="Có trong đường dẫn của email mời.">
          {(id, describedBy) => <input id={id} aria-describedby={describedBy} value={token} onChange={(event) => setToken(event.target.value)} />}
        </Field>
      )}
      {initialToken && touched && errors.token && <p className="field-error">{errors.token}</p>}
      <Field label="Tên đăng nhập" required error={touched ? errors.username : null} hint="4–50 ký tự: chữ không dấu, số, dấu chấm, gạch dưới, gạch nối.">
        {(id, describedBy) => <input id={id} aria-describedby={describedBy} autoComplete="username" autoCapitalize="none" value={username} onChange={(event) => setUsername(event.target.value)} />}
      </Field>
      <Field label="Số điện thoại di động" required error={touched ? errors.phone : null}>
        {(id) => <input id={id} type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0901234567" />}
      </Field>
      <Field label="Mật khẩu" required error={touched ? errors.password : null}>
        {(id) => <input id={id} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />}
      </Field>
      <PasswordChecklist password={password} />
      <Field label="Nhập lại mật khẩu" required error={touched ? errors.confirm : null}>
        {(id) => <input id={id} type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />}
      </Field>
      <ErrorNotice error={action.error} />
      <Button type="submit" variant="primary" className="btn-block" pending={action.pending} status={action.status}>Tạo tài khoản và tham gia</Button>
    </form>
  );
}
