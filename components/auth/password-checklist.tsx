import { Check, Circle } from "lucide-react";
import { passwordChecks } from "@/lib/validation";

export function PasswordChecklist({ password }: { password: string }) {
  return (
    <ul className="password-checklist" aria-label="Yêu cầu mật khẩu">
      {passwordChecks(password).map((check) => (
        <li key={check.label} className={check.ok ? "ok" : ""}>
          {check.ok ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}
          {check.label}
        </li>
      ))}
    </ul>
  );
}
