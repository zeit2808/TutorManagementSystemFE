import { BackButton } from "@/components/ui/primitives";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/recovery-forms";

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Quên mật khẩu" description="Nhận mã OTP 8 chữ số qua email để đặt mật khẩu mới." footer={<BackButton href="/login">Đăng nhập</BackButton>}>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
