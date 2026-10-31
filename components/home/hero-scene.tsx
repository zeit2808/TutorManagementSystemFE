"use client";

import { useEffect, useRef, useState } from "react";

/** Skip the 3D layer where it would cost more than it gives: no WebGL, data saver, or a low-end device. */
function canRunScene() {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  if (nav.connection?.saveData) return false;
  if ((nav.hardwareConcurrency ?? 8) < 4 || (nav.deviceMemory ?? 8) < 4) return false;
  try {
    const probe = document.createElement("canvas");
    return Boolean(probe.getContext("webgl2") ?? probe.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Animated 3D backdrop for the hero. The static navy, dot grid and glows render
 * first and stay as the fallback; three.js is fetched only after the page is idle,
 * and the canvas fades in once its first frame is drawn. Reduced motion gets a
 * single still frame.
 */
export function HeroScene() {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = ref.current;
    if (!container || !canRunScene()) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let dispose: (() => void) | undefined;
    let cancelled = false;

    const load = () => {
      import("./hero-scene-three")
        .then(({ mountHeroScene }) => {
          if (cancelled) return;
          dispose = mountHeroScene(container, { reduced, onReady: () => setReady(true) });
        })
        .catch(() => undefined);
    };
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(load, { timeout: 2000 })
      : window.setTimeout(load, 600);

    return () => {
      cancelled = true;
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      dispose?.();
    };
  }, []);

  return <div ref={ref} className={`hero-scene${ready ? " is-ready" : ""}`} aria-hidden="true" />;
}
