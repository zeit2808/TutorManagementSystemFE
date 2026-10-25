import { CenterFrame } from "@/components/center/center-frame";

export default async function CenterLayout({ children, params }: LayoutProps<"/centers/[centerId]">) {
  const { centerId } = await params;
  return <CenterFrame centerId={centerId}>{children}</CenterFrame>;
}
