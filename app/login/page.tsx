import { MailOpen } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { LoginForm } from "@/components/auth/login-form";
import { ButtonLink, Notice } from "@/components/ui/primitives";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const nextPath = typeof params.next === "string" ? params.next : undefined;
  const success =
    params.reset === "success" ? "Mật khẩu đã được đặt lại. Hãy đăng nhập bằng mật khẩu mới."
    : params.invitation === "accepted" ? "Tài khoản chủ trung tâm đã được tạo. Hãy đăng nhập để tiếp tục."
    : null;
  // useLogout: the browser forgot the session but the server could not be told (offline, timeout).
  const partialLogout = params.loggedOut === "partial";
  return (
    <AuthShell
      title="Đăng nhập"
      description="Chủ trung tâm, quản lý và nhân viên dùng tên đăng nhập. Học sinh dùng Google."
      footer={<><span>Có email mời mở trung tâm?</span><ButtonLink size="sm" variant="soft" href="/accept-invitation" icon={<MailOpen aria-hidden="true" />}>Tạo tài khoản từ lời mời</ButtonLink></>}
    >
      {success && <Notice tone="success">{success}</Notice>}
      {partialLogout && (
        <Notice tone="warning" title="Đã đăng xuất trên máy này">
          Máy chủ chưa xác nhận kết thúc phiên do lỗi kết nối. Nếu đây là máy dùng chung, hãy đăng nhập lại rồi chọn Cài đặt → Phiên đăng nhập → Đăng xuất mọi nơi.
        </Notice>
      )}
      <LoginForm nextPath={nextPath} />
      <div className="divider"><span>Học sinh</span></div>
      <GoogleLoginButton nextPath={nextPath} />
    </AuthShell>
  );
}
