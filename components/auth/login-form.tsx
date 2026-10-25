"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { authApi } from "@/lib/api";
import { resolveLandingPath } from "@/lib/auth/session";
import { useAction } from "@/lib/hooks/use-resource";
import { Button, ErrorNotice, Field } from "@/components/ui/primitives";

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(false);
  const action = useAction({ redirectOnUnauthorized: false });

  const usernameError = username.trim().length < 3 || username.trim().length > 50 ? "Tên đăng nhập cần 3–50 ký tự." : null;
  const passwordError = password.length < 8 || password.length > 128 ? "Mật khẩu cần 8–128 ký tự." : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (usernameError || passwordError) return;
    const ok = await action.run(async () => {
      await authApi.login({ username: username.trim(), password });
      return true;
    });
    if (ok) router.replace(await resolveLandingPath(nextPath));
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <Field label="Tên đăng nhập" required error={touched ? usernameError : null}>
        {(id) => <input id={id} name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={(event) => setUsername(event.target.value)} />}
      </Field>
      <Field label="Mật khẩu" required error={touched ? passwordError : null}>
        {(id) => (
          <div className="input-affix">
            <input id={id} name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            <button type="button" className="icon-button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>
              {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </button>
          </div>
        )}
      </Field>
      <div className="row-between">
        <Link className="text-link" href="/forgot-password">Quên mật khẩu?</Link>
      </div>
      <ErrorNotice error={action.error} />
      <Button type="submit" variant="primary" className="btn-block" icon={<LogIn aria-hidden="true" />} pending={action.pending}>Đăng nhập</Button>
    </form>
  );
}
