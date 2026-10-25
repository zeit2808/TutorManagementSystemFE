import { AuthShell } from "@/components/auth/auth-shell";
import { JoinClassPage } from "@/components/student/student-links";

export default async function Page({ params }: PageProps<"/join/[token]">) {
  const { token } = await params;
  return (
    <AuthShell
      title="Đăng ký vào lớp"
      description="Đăng nhập bằng Google, nhập mã lớp trung tâm gửi kèm link là vào lớp ngay."
    >
      <JoinClassPage token={token} />
    </AuthShell>
  );
}
