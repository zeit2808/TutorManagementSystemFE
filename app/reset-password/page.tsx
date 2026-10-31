import { RotateCcw } from "lucide-react";
import { ButtonLink } from "@/components/ui/primitives";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/recovery-forms";

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const params = await searchParams;
  return (
    <AuthShell title="Đặt lại mật khẩu" description="Nhập mã OTP vừa nhận và mật khẩu mới." footer={<><span>Chưa nhận được mã?</span><ButtonLink size="sm" variant="soft" href="/forgot-password" icon={<RotateCcw aria-hidden="true" />}>Gửi lại mã</ButtonLink></>}>
      <ResetPasswordForm initialEmail={typeof params.email === "string" ? params.email : ""} />
    </AuthShell>
  );
}
