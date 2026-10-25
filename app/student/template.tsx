/** Remounts on each navigation inside the shell so page content eases in while the shell stays put. */
import { PageTransition } from "@/components/ui/page-transition";

export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
