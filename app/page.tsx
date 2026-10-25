import type { Metadata } from "next";
import { Landing } from "@/components/home/landing";

export const metadata: Metadata = {
  title: { absolute: "Quản Lý Dạy Thêm — vận hành trung tâm dạy thêm" },
};

export default function HomePage() {
  return <Landing />;
}
