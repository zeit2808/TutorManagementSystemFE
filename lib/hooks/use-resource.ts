"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";

export interface Resource<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  reload: () => Promise<void>;
  setData: (updater: T | ((current: T | undefined) => T)) => void;
}

/**
 * Loads data for a client screen. A 401 that survives the silent refresh
 * sends the visitor back to sign-in with a return path; every other error is
 * kept for the screen to explain in place.
 */
export function useResource<T>(loader: () => Promise<T>, deps: unknown[]): Resource<T> {
  const router = useRouter();
  const [data, setDataState] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const sequence = useRef(0);
  // Callers pass primitive dependencies; serialising them gives a stable key for the effect.
  const depsKey = JSON.stringify(deps);
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });

  const run = useCallback(async () => {
    const ticket = ++sequence.current;
    setLoading(true);
    setError(null);
    try {
      const result = await loaderRef.current();
      if (ticket === sequence.current) setDataState(result);
    } catch (caught) {
      if (ticket !== sequence.current) return;
      if (caught instanceof ApiError && caught.status === 401) {
        const next = `${window.location.pathname}${window.location.search}`;
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }
      setError(caught);
    } finally {
      if (ticket === sequence.current) setLoading(false);
    }
    // depsKey stands in for the caller's dependency list; the loader itself is read from a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, depsKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => void run(), 0);
    return () => window.clearTimeout(timer);
  }, [run]);

  const setData = useCallback((updater: T | ((current: T | undefined) => T)) => {
    setDataState((current) =>
      typeof updater === "function" ? (updater as (value: T | undefined) => T)(current) : updater,
    );
  }, []);

  return { data, error, loading, reload: run, setData };
}

export type ActionStatus = "idle" | "pending" | "success" | "error";

/** How long a button keeps its success/error face after the request settles. */
const OUTCOME_MS = { success: 1600, error: 2200 } as const;

/**
 * Wraps a mutation with pending/error state and the same 401 handling. `status`
 * briefly holds the outcome after the request settles so the triggering button
 * can confirm success or flag the failure in place.
 */
export function useAction(options: { redirectOnUnauthorized?: boolean } = {}) {
  const redirectOnUnauthorized = options.redirectOnUnauthorized ?? true;
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [outcome, setOutcome] = useState<"success" | "error" | null>(null);
  const outcomeTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(outcomeTimer.current), []);

  const settle = useCallback((next: "success" | "error") => {
    window.clearTimeout(outcomeTimer.current);
    setOutcome(next);
    outcomeTimer.current = window.setTimeout(() => setOutcome(null), OUTCOME_MS[next]);
  }, []);

  const run = useCallback(
    async <R,>(action: () => Promise<R>): Promise<R | undefined> => {
      window.clearTimeout(outcomeTimer.current);
      setOutcome(null);
      setPending(true);
      setError(null);
      try {
        const result = await action();
        settle("success");
        return result;
      } catch (caught) {
        if (redirectOnUnauthorized && caught instanceof ApiError && caught.status === 401) {
          const next = `${window.location.pathname}${window.location.search}`;
          router.replace(`/login?next=${encodeURIComponent(next)}`);
          return undefined;
        }
        setError(caught);
        settle("error");
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [router, redirectOnUnauthorized, settle],
  );

  const status: ActionStatus = pending ? "pending" : outcome ?? "idle";
  return { pending, status, error, run, clearError: () => setError(null) };
}
