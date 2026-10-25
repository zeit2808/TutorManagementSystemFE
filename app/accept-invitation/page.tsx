import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { InvitationAcceptance } from "@/components/auth/invitation-acceptance";

export default async function AcceptInvitationPage({ searchParams }: PageProps<"/accept-invitation">) {
  const params = await searchParams;
  return (
    <AuthShell
      title="Nhận lời mời tham gia trung tâm"
      description="Lời mời có hiệu lực 48 giờ và chỉ dùng một lần. Một tài khoản dùng chung cho mọi trung tâm bạn tham gia."
      footer={<>Đã có tài khoản? <Link className="text-link" href="/login">Đăng nhập</Link></>}
    >
      <InvitationAcceptance initialToken={typeof params.token === "string" ? params.token : ""} />
    </AuthShell>
  );
}
