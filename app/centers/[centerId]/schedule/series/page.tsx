import { Suspense } from "react";
import { SeriesWorkspace } from "@/components/center/series";
import { SkeletonRows } from "@/components/ui/primitives";

export default function SeriesPage() {
  return (
    <Suspense fallback={<SkeletonRows rows={6} columns={5} />}>
      <SeriesWorkspace />
    </Suspense>
  );
}
