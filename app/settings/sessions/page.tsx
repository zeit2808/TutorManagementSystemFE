import type { Metadata } from "next";
import { SessionsSettings } from "@/components/settings/settings-sections";

export const metadata: Metadata = { title: "Phiên đăng nhập · Cài đặt" };

export default function Page() {
  return <SessionsSettings />;
}
