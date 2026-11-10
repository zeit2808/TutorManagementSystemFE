"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { clearAccount } from "./account";
import { forgetWorkspace } from "./workspace";

/**
 * Signs out of this browser. The access token is always dropped from memory (authApi.logout `finally`), so the
 * visitor always lands on sign-in; when the server could not be reached the login page says the server-side
 * session may still be alive and suggests "sign out everywhere".
 */
export function useLogout() {
  const router = useRouter();
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
    router.replace(partial ? "/login?loggedOut=partial" : "/login");
  }, [router]);

  return { logout, pending };
}
