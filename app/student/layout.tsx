import { StudentFrame } from "@/components/student/student";

export default function StudentLayout({ children }: LayoutProps<"/student">) {
  return <StudentFrame>{children}</StudentFrame>;
}
