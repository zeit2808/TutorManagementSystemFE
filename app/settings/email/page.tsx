import type { Metadata } from "next";
import { EmailSettings } from "@/components/settings/settings-sections";

export const metadata: Metadata = { title: "Email đăng nhập · Cài đặt" };

export default function Page() {
  return <EmailSettings />;
}
