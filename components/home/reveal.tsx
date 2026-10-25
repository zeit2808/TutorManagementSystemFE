"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Content is visible by default; only after hydration does an off-screen block
 * arm itself and reveal on entry, so a failed script never hides the page.
 */
export function Reveal({ children, className, as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "ol" }) {
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<"idle" | "armed" | "shown">("idle");

  useEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = element.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.9) return;
    const arm = window.setTimeout(() => setState("armed"), 0);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting || entry.boundingClientRect.top < 0) {
          setState("shown");
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    observer.observe(element);
    return () => {
      window.clearTimeout(arm);
      observer.disconnect();
    };
  }, []);

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Tag ref={ref as any} className={[className ?? "", "reveal", `reveal-${state}`].join(" ").trim()}>
      {children}
    </Tag>
  );
}
