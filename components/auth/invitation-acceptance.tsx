"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Building2, LogIn, LogOut } from "lucide-react";
import { authApi, identityApi } from "@/lib/api";
import { useSessionUser } from "@/lib/auth/session";
import { useAction, useResource } from "@/lib/hooks/use-resource";
import { formatDateTime } from "@/lib/format";
import { roleLabel } from "@/lib/labels";
import { Button, ButtonLink, ErrorNotice, Field, Notice, SkeletonRows } from "@/components/ui/primitives";
import { AcceptInvitationForm } from "./recovery-forms";

/**
 * One page for every invitation. The preview says which center, role and email it is for; an email
 * that already has an account signs in and accepts (no second login), a new email creates its account.
 */
export function InvitationAcceptance({ initialToken }: { initialToken: string }) {
  const [token, setToken] = useState(initialToken);
  const [entered, setEntered] = useState(initialToken);

  if (!entered) {
    return (
      <form className="stack" onSubmit={(event) => { event.preventDefault(); setEntered(token.trim()); }}>
        <Field label="Mã lời mời" required hint="Có trong email mời.">
          {(id, describedBy) => <input id={id} aria-describedby={describedBy} value={token} onChange={(event) => setToken(event.target.value)} />}
        </Field>
        <Button type="submit" variant="primary" className="btn-block" disabled={!token.trim()}>Xem lời mời</Button>
      </form>
    );
  }
  return <InvitationDetails token={entered} />;
}

function InvitationDetails({ token }: { token: string }) {
  const router = useRouter();
  const preview = useResource(() => identityApi.previewInvitation(token), [token]);
  const { user, status } = useSessionUser();
  const accept = useAction({ redirectOnUnauthorized: false });

  if (!preview.data) {
    return preview.error ? <ErrorNotice error={preview.error} /> : <SkeletonRows rows={3} columns={1} />;
  }
  const invitation = preview.data;
  const here = `/accept-invitation?token=${encodeURIComponent(token)}`;

  async function acceptSignedIn() {
    const result = await accept.run(() => identityApi.acceptInvitationAsMember(token));
    if (result) router.replace(`/centers/${result.centerId}`);
  }

  async function switchAccount() {
    await authApi.logout();
    router.replace(`/login?next=${encodeURIComponent(here)}`);
  }

  return (
    <div className="invitation-card">
      <Notice tone="info" title={invitation.centerName}>
        <Building2 aria-hidden="true" /> Bạn được mời làm <strong>{roleLabel(invitation.role).toLowerCase()}</strong>.
      </Notice>
      <dl>
        <dt>Email nhận lời mời</dt><dd>{invitation.email}</dd>
        <dt>Hết hạn</dt><dd>{formatDateTime(invitation.expiresAtUtc)}</dd>
      </dl>

      {invitation.accountExists ? (
        status === "loading" ? (
          <SkeletonRows rows={1} columns={1} />
        ) : user ? (
          <>
            <p className="col-muted">Đang đăng nhập: <strong>{user.username ?? "tài khoản hiện tại"}</strong>. Lời mời chỉ nhận được bằng tài khoản có email {invitation.email}.</p>
            <ErrorNotice error={accept.error} />
            <Button variant="primary" className="btn-block" icon={<ArrowRight aria-hidden="true" />} pending={accept.pending} onClick={() => void acceptSignedIn()}>
              Chấp nhận và vào trung tâm
            </Button>
            <Button variant="ghost" className="btn-block" icon={<LogOut aria-hidden="true" />} onClick={() => void switchAccount()}>Đăng nhập tài khoản khác</Button>
          </>
        ) : (
          <>
            <p className="col-muted">Email này đã có tài khoản. Đăng nhập bằng tài khoản đó (mật khẩu hoặc Google), bạn sẽ quay lại đây để chấp nhận.</p>
            <ButtonLink href={`/login?next=${encodeURIComponent(here)}`} variant="primary" icon={<LogIn aria-hidden="true" />}>Đăng nhập để chấp nhận</ButtonLink>
          </>
        )
      ) : (
        <>
          <p className="col-muted">Tạo tài khoản cho email này. Lần sau bạn dùng chính tài khoản này cho mọi trung tâm mình tham gia.</p>
          <AcceptInvitationForm initialToken={token} />
          <p className="col-muted">Đã có tài khoản với email khác? Nhờ trung tâm mời lại đúng email đó, rồi <Link className="text-link" href={`/login?next=${encodeURIComponent(here)}`}>đăng nhập</Link>.</p>
        </>
      )}
    </div>
  );
}
