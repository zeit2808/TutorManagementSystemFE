import { ClassDetail } from "@/components/center/class-detail";

export default async function ClassPage({ params }: PageProps<"/centers/[centerId]/classes/[classId]">) {
  const { classId } = await params;
  return <ClassDetail classId={classId} />;
}
