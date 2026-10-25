import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/recovery-forms";

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const params = await searchParams;
  return (
    <AuthShell title="Đặt lại mật khẩu" description="Nhập mã OTP vừa nhận và mật khẩu mới." footer={<Link className="text-link" href="/forgot-password">Chưa nhận được mã? Gửi lại</Link>}>
      <ResetPasswordForm initialEmail={typeof params.email === "string" ? params.email : ""} />
    </AuthShell>
  );
}
