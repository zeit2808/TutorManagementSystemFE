import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { LoginForm } from "@/components/auth/login-form";
import { Notice } from "@/components/ui/primitives";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const nextPath = typeof params.next === "string" ? params.next : undefined;
  const success =
    params.reset === "success" ? "Mật khẩu đã được đặt lại. Hãy đăng nhập bằng mật khẩu mới."
    : params.invitation === "accepted" ? "Tài khoản chủ trung tâm đã được tạo. Hãy đăng nhập để tiếp tục."
    : null;
  return (
    <AuthShell
      title="Đăng nhập"
      description="Chủ trung tâm, quản lý và nhân viên dùng tên đăng nhập. Học sinh dùng Google."
      footer={<>Có email mời mở trung tâm? <Link className="text-link" href="/accept-invitation">Tạo tài khoản từ lời mời</Link></>}
    >
      {success && <Notice tone="success">{success}</Notice>}
      <LoginForm nextPath={nextPath} />
      <div className="divider"><span>Học sinh</span></div>
      <GoogleLoginButton nextPath={nextPath} />
    </AuthShell>
  );
}
