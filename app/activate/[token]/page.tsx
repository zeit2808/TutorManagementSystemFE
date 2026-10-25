import { AuthShell } from "@/components/auth/auth-shell";
import { ActivationPage } from "@/components/student/student-links";

export default async function Page({ params }: PageProps<"/activate/[token]">) {
  const { token } = await params;
  return (
    <AuthShell
      title="Kích hoạt tài khoản học sinh"
      description="Đăng nhập bằng Google rồi xác nhận đúng tên của bạn. Link do trung tâm gửi riêng, chỉ dùng một lần."
    >
      <ActivationPage token={token} />
    </AuthShell>
  );
}
