import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyEmailForm } from "@/components/auth/recovery-forms";

export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const params = await searchParams;
  return (
    <AuthShell title="Xác minh email" description="Dành cho tài khoản cũ chưa xác minh. Tài khoản tạo từ lời mời đã được xác minh sẵn.">
      <VerifyEmailForm initialToken={typeof params.token === "string" ? params.token : ""} />
    </AuthShell>
  );
}
