import { StudentDashboard } from "@/components/student/my-schedule";

export default async function StudentPage({ searchParams }: PageProps<"/student">) {
  const params = await searchParams;
  return <StudentDashboard joinedClass={typeof params.joined === "string" && params.joined ? params.joined : undefined} />;
}
