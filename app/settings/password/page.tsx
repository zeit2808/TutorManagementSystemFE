import type { Metadata } from "next";
import { PasswordSettings } from "@/components/settings/settings-sections";

export const metadata: Metadata = { title: "Mật khẩu · Cài đặt" };

export default function Page() {
  return <PasswordSettings />;
}
