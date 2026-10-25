import { PlatformCenterDetail } from "@/components/platform/platform";

export default async function PlatformCenterPage({ params }: PageProps<"/platform/centers/[centerId]">) {
  const { centerId } = await params;
  return <PlatformCenterDetail centerId={centerId} />;
}
