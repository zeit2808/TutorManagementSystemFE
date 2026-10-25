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

/** Wraps a mutation with pending/error state and the same 401 handling. */
export function useAction(options: { redirectOnUnauthorized?: boolean } = {}) {
  const redirectOnUnauthorized = options.redirectOnUnauthorized ?? true;
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const run = useCallback(
    async <R,>(action: () => Promise<R>): Promise<R | undefined> => {
      setPending(true);
      setError(null);
      try {
        return await action();
      } catch (caught) {
        if (redirectOnUnauthorized && caught instanceof ApiError && caught.status === 401) {
          const next = `${window.location.pathname}${window.location.search}`;
          router.replace(`/login?next=${encodeURIComponent(next)}`);
          return undefined;
        }
        setError(caught);
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [router, redirectOnUnauthorized],
  );

  return { pending, error, run, clearError: () => setError(null) };
}
