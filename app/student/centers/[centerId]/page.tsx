import { StudentCenter } from "@/components/student/student";

export default async function StudentCenterPage({ params }: PageProps<"/student/centers/[centerId]">) {
  const { centerId } = await params;
  return <StudentCenter centerId={centerId} />;
}
