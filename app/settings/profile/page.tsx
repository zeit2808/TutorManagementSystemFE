import type { Metadata } from "next";
import { ProfileSettings } from "@/components/settings/settings-sections";

export const metadata: Metadata = { title: "Hồ sơ cá nhân · Cài đặt" };

export default function Page() {
  return <ProfileSettings />;
}
