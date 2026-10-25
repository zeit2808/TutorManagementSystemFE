"use client";

import { ViewTransition, type ReactNode } from "react";

/** Keeps the application shell stable while route content hands off smoothly. */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="workspace-enter" exit="workspace-exit" default="none">
      <div className="route-motion">{children}</div>
    </ViewTransition>
  );
}
