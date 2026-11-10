import type { Metadata } from "next";
import { AppearanceSettings } from "@/components/settings/settings-sections";

export const metadata: Metadata = { title: "Giao diện · Cài đặt" };

export default function Page() {
  return <AppearanceSettings />;
}
