import type { Metadata } from "next";
import { GoogleSettings } from "@/components/settings/settings-sections";

export const metadata: Metadata = { title: "Đăng nhập Google · Cài đặt" };

export default function Page() {
  return <GoogleSettings />;
}
