import { PlatformFrame } from "@/components/platform/platform";

export default function PlatformLayout({ children }: LayoutProps<"/platform">) {
  return <PlatformFrame>{children}</PlatformFrame>;
}
