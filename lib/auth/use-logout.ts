"use client";

import { useCallback, useRef, useState } from "react";
import { authApi } from "@/lib/api";
import { clearAccount } from "./account";
import { forgetWorkspace } from "./workspace";

/**
 * Signs out of this browser. The access token is always dropped from memory (authApi.logout `finally`), so the
 * visitor always lands on sign-in; when the server could not be reached the login page says the server-side
 * session may still be alive and suggests "sign out everywhere".
 *
 * The move to sign-in is a full page load, not a client-side route change: it cannot get stuck behind a slow
 * or failed route render (the menu used to sit on "Đang đăng xuất…" forever), and it drops every in-memory
 * copy of the previous account (lookups, the account chip) before the next person signs in.
 */
export function useLogout() {
  const [pending, setPending] = useState(false);
  const busy = useRef(false);

  const logout = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    let partial = false;
    try {
      await authApi.logout();
    } catch {
      partial = true;
    }
    clearAccount();
    forgetWorkspace();
    window.location.replace(partial ? "/login?loggedOut=partial" : "/login");
  }, []);

  return { logout, pending };
}
