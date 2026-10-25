import { Suspense } from "react";
import { AttendanceWorkspace } from "@/components/center/attendance";
import { SkeletonRows } from "@/components/ui/primitives";

export default function AttendancePage() {
  return (
    <Suspense fallback={<SkeletonRows rows={8} columns={3} />}>
      <AttendanceWorkspace />
    </Suspense>
  );
}
