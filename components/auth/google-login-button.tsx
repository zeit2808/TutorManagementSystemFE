"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { LoaderCircle } from "lucide-react";
import { ApiError, authApi } from "@/lib/api";
import { resolveLandingPath } from "@/lib/auth/session";
import { useAction } from "@/lib/hooks/use-resource";
import { ErrorNotice, Notice } from "@/components/ui/primitives";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(input: { client_id: string; callback: (response: { credential: string }) => void }): void;
          renderButton(element: HTMLElement, options: Record<string, unknown>): void;
        };
      };
    };
  }
}

export const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

// Google Identity Services must be initialized once per page load; calling initialize() again (each render, the
// script's onLoad, React strict mode) logs "initialize() is called multiple times". The single callback forwards the
// credential to whichever button is mounted now.
let initializedClientId: string | null = null;
let activeCredentialHandler: ((idToken: string) => void) | null = null;

function ensureGoogleInitialized(clientId: string) {
  if (!window.google || initializedClientId === clientId) return;
  window.google.accounts.id.initialize({ client_id: clientId, callback: (response) => activeCredentialHandler?.(response.credential) });
  initializedClientId = clientId;
}

/** Renders Google Identity Services and hands the ID token to `onCredential`. */
export function GoogleButton({ onCredential, text = "continue_with" }: { onCredential: (idToken: string) => void; text?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const callback = useRef(onCredential);
  useEffect(() => {
    callback.current = onCredential;
  });

  const render = useCallback(() => {
    if (!googleClientId || !ref.current || !window.google) return;
    activeCredentialHandler = (idToken) => callback.current(idToken);
    ensureGoogleInitialized(googleClientId);
    ref.current.replaceChildren();
    window.google.accounts.id.renderButton(ref.current, { type: "standard", theme: "outline", size: "large", width: 340, text, locale: "vi" });
  }, [text]);

  useEffect(() => {
    render();
  }, [render]);

  useEffect(() => () => { activeCredentialHandler = null; }, []);

  if (!googleClientId) {
    return <Notice tone="neutral">Đăng nhập Google chưa được cấu hình (thiếu <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code>).</Notice>;
  }
  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={render} />
      <div className="google-slot" ref={ref} />
    </>
  );
}

export function GoogleLoginButton({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const action = useAction({ redirectOnUnauthorized: false });
  const [linkRequired, setLinkRequired] = useState(false);

  async function signIn(idToken: string) {
    setLinkRequired(false);
    const ok = await action.run(async () => {
      try {
        await authApi.googleLogin(idToken);
      } catch (caught) {
        if (caught instanceof ApiError && caught.hasCode("google_account_link_required")) setLinkRequired(true);
        throw caught;
      }
      return true;
    });
    if (ok) router.replace(await resolveLandingPath(nextPath));
  }

  return (
    <div className="stack">
      <GoogleButton onCredential={(token) => void signIn(token)} />
      {action.pending && <p className="col-muted inline-status"><LoaderCircle className="spin" aria-hidden="true" />Đang xác thực với Google…</p>}
      {linkRequired ? (
        <Notice tone="warning" title="Email này đã thuộc một tài khoản nhân sự">
          Nếu đây là tài khoản của bạn (chủ trung tâm, quản lý, giáo viên): đăng nhập bằng tên đăng nhập và mật khẩu ở trên, rồi vào <strong>Tài khoản &amp; bảo mật → Liên kết Google</strong> để lần sau vào bằng Google. Nếu bạn là học sinh: hãy dùng một tài khoản Google khác.
        </Notice>
      ) : (
        <ErrorNotice error={action.error} />
      )}
    </div>
  );
}
