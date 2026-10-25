import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/recovery-forms";

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Quên mật khẩu" description="Nhận mã OTP 8 chữ số qua email để đặt mật khẩu mới." footer={<Link className="text-link" href="/login">Quay lại đăng nhập</Link>}>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
