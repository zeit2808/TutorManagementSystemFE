import { StudentTuitionPage } from "@/components/center/tuition-student";

export default async function StudentTuitionRoute({ params, searchParams }: PageProps<"/centers/[centerId]/tuition/students/[studentId]">) {
  const { studentId } = await params;
  const query = await searchParams;
  return <StudentTuitionPage studentId={studentId} payChargeId={typeof query.pay === "string" ? query.pay : undefined} />;
}
