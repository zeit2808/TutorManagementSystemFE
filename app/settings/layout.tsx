import type { Metadata } from "next";
import { SettingsFrame } from "@/components/settings/settings-frame";

export const metadata: Metadata = { title: "Cài đặt" };

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return <SettingsFrame>{children}</SettingsFrame>;
}
