/** Client-side mirrors of backend rules so users see problems before submitting. */

const collapse = (value: string) => value.trim().split(/\s+/).filter(Boolean).join(" ");

export function validateCode(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return "Nhập mã.";
  if (normalized.length < 2 || normalized.length > 20) return "Mã cần 2–20 ký tự.";
  if (!/^[A-Z0-9_-]+$/.test(normalized)) return "Mã chỉ gồm chữ không dấu, số, gạch nối (-) hoặc gạch dưới (_).";
  return null;
}

export function validateName(value: string, label = "Tên"): string | null {
  const normalized = collapse(value);
  if (!normalized) return `Nhập ${label.toLowerCase()}.`;
  if (normalized.length < 2 || normalized.length > 100) return `${label} cần 2–100 ký tự.`;
  return null;
}

export function validateOptional(value: string, max: number, label: string): string | null {
  return value.trim().length > max ? `${label} tối đa ${max} ký tự.` : null;
}

export function validateRequired(value: string, max: number, label: string): string | null {
  if (!value.trim()) return `Nhập ${label.toLowerCase()}.`;
  return value.trim().length > max ? `${label} tối đa ${max} ký tự.` : null;
}

export function validateEmail(value: string): string | null {
  if (!value.trim()) return "Nhập email.";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? null : "Email chưa đúng định dạng.";
}

export function validateVietnamMobile(value: string, allowBare84 = false): string | null {
  const compact = value.replace(/[\s.()-]/g, "");
  if (!compact) return "Nhập số điện thoại.";
  const pattern = allowBare84 ? /^(?:\+84|84|0)(?:3|5|7|8|9)\d{8}$/ : /^(?:\+84|0)(?:3|5|7|8|9)\d{8}$/;
  return pattern.test(compact) ? null : "Số di động Việt Nam gồm 10 số, bắt đầu bằng 03/05/07/08/09 hoặc +84.";
}

export function validateTaxCode(value: string): string | null {
  if (!value.trim()) return "Nhập mã số thuế.";
  return /^\d{10}(?:-\d{3})?$/.test(value.trim()) ? null : "Mã số thuế gồm 10 số, có thể kèm hậu tố chi nhánh -XXX.";
}

export function validateUsername(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < 4 || trimmed.length > 50) return "Tên đăng nhập cần 4–50 ký tự.";
  return /^[a-zA-Z0-9._-]+$/.test(trimmed) ? null : "Chỉ dùng chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch nối.";
}

const forbiddenFragments = ["password", "123456", "qwerty", "admin123"];

export interface PasswordCheck {
  label: string;
  ok: boolean;
}

/** Mirrors PasswordPolicy: 12–128 chars, upper, lower, digit, symbol, no common fragments. */
export function passwordChecks(password: string): PasswordCheck[] {
  return [
    { label: "12–128 ký tự", ok: password.length >= 12 && password.length <= 128 },
    { label: "Có chữ hoa và chữ thường", ok: /\p{Lu}/u.test(password) && /\p{Ll}/u.test(password) },
    { label: "Có chữ số", ok: /\d/.test(password) },
    { label: "Có ký tự đặc biệt", ok: /[^\p{L}\p{N}]/u.test(password) },
    {
      label: "Không chứa chuỗi dễ đoán (password, 123456, qwerty…)",
      ok: password.length > 0 && !forbiddenFragments.some((fragment) => password.toLowerCase().includes(fragment)),
    },
  ];
}

export function isStrongPassword(password: string) {
  return passwordChecks(password).every((check) => check.ok);
}
