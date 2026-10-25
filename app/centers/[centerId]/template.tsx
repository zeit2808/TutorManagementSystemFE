import { PageTransition } from "@/components/ui/page-transition";

/** Remounts on each navigation while the center shell remains the spatial anchor. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
