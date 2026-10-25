"use client";

import { useCallback, useEffect, useState } from "react";
import { currentAccessToken, identityApi, refreshAccessToken, type CenterContext } from "@/lib/api";

export interface SessionUser {
  userId: string;
  username: string | null;
  roles: string[];
  isPlatformAdmin: boolean;
  isStudent: boolean;
}

function decodePayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Global roles live in the access token's `role` claim; center roles never do. */
export function readSessionUser(): SessionUser | null {
  const token = currentAccessToken();
  if (!token) return null;
  const payload = decodePayload(token);
  if (!payload || typeof payload.sub !== "string") return null;
  const rawRoles = payload.role ?? payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"];
  const roles = Array.isArray(rawRoles) ? rawRoles.map(String) : typeof rawRoles === "string" ? [rawRoles] : [];
  const username = typeof payload.unique_name === "string" ? payload.unique_name : null;
  return {
    userId: payload.sub,
    username,
    roles,
    isPlatformAdmin: roles.includes("PlatformAdmin"),
    isStudent: roles.includes("Student"),
  };
}

/** Restores the in-memory access token from the HttpOnly refresh cookie when needed. */
export async function ensureSession(): Promise<SessionUser> {
  if (!currentAccessToken()) await refreshAccessToken();
  const user = readSessionUser();
  if (!user) throw new Error("Không đọc được phiên đăng nhập.");
  return user;
}

export function useSessionUser() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "anonymous">("loading");

  const load = useCallback(async () => {
    try {
      setUser(await ensureSession());
      setStatus("ready");
    } catch {
      setUser(null);
      setStatus("anonymous");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    const onSession = () => setUser(readSessionUser());
    window.addEventListener("tm:session", onSession);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("tm:session", onSession);
    };
  }, [load]);

  return { user, status, reload: load };
}

/** Decides where a freshly authenticated user should land. */
export async function resolveLandingPath(nextPath?: string | null): Promise<string> {
  if (nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")) return nextPath;
  const user = readSessionUser();
  // A student account never belongs to a center: it always lands in the student portal.
  if (user?.isStudent) return "/student";
  let centers: CenterContext[] = [];
  try {
    centers = await identityApi.myCenters();
  } catch {
    centers = [];
  }
  const accessible = centers.filter((center) => center.canAccess);
  if (centers.length === 0) {
    if (user?.isPlatformAdmin) return "/platform";
    return "/select-center";
  }
  if (accessible.length === 1 && !user?.isPlatformAdmin) {
    return `/centers/${accessible[0].centerId}`;
  }
  return "/select-center";
}
