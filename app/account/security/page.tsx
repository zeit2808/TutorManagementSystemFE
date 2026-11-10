import { redirect } from "next/navigation";

/** The old "Tài khoản & bảo mật" page now lives in Settings. */
export default function AccountSecurityPage() {
  redirect("/settings");
}
