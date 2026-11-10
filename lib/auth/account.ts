"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { identityApi, type CurrentUser } from "@/lib/api";
import type { SessionUser } from "./session";

interface AccountState {
  data: CurrentUser | undefined;
  error: unknown;
  loading: boolean;
}

/**
 * One shared copy of `GET /me` for the account chip, its menu and the settings pages, so a profile saved in
 * Settings shows up in the chip at once and the menu does not fetch again on every open.
 */
let state: AccountState = { data: undefined, error: null, loading: false };
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit(next: Partial<AccountState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

export function loadAccount(force = false): Promise<void> {
  if (inflight) return inflight;
  if (state.data && !force) return Promise.resolve();
  emit({ loading: true, error: null });
  inflight = identityApi.me()
    .then((data) => emit({ data, loading: false, error: null }))
    .catch((error: unknown) => emit({ loading: false, error }))
    .finally(() => { inflight = null; });
  return inflight;
}

/** Replace the cached account with a fresher copy returned by a mutation. */
export function setAccount(data: CurrentUser) {
  emit({ data, error: null, loading: false });
}

/** Forget the account (sign-out, or another user signed in). */
export function clearAccount() {
  emit({ data: undefined, error: null, loading: false });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const serverState: AccountState = { data: undefined, error: null, loading: true };

/** Reads the shared account, loading it once when `enabled`. Waits for the session so the request carries a token. */
export function useAccount(enabled = true) {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => serverState);
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => void loadAccount(), 0);
    return () => window.clearTimeout(timer);
  }, [enabled]);
  const reload = useCallback(() => loadAccount(true), []);
  return { account: snapshot.data, error: snapshot.error, loading: snapshot.loading || (enabled && !snapshot.data && !snapshot.error), reload };
}

/** The name to show for an account: the chosen display name, then the username, then the email. */
export function accountName(account: CurrentUser | undefined, user: SessionUser | null | undefined) {
  return account?.displayName?.trim() || account?.username || user?.username || account?.email || "Tài khoản";
}
