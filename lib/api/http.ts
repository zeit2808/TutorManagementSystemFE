import { errorMessages, isConcurrencyCode } from "./errors";
import type { ApiEnvelope, ApiFieldError, TokenResponse } from "./types";

const configuredBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";
export const API_ROOT = `${configuredBase}/api/v1`;

type AuthMode = "none" | "optional" | "required";

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  auth?: AuthMode;
  body?: unknown;
  retryAuth?: boolean;
  idempotencyKey?: string;
  query?: Record<string, string | number | boolean | null | undefined>;
}

interface AccessSession {
  token: string;
  expiresAt: number;
}

let session: AccessSession | null = null;
let refreshInFlight: Promise<TokenResponse> | null = null;

/** A request that hangs (API stalled, proxy dropped the response) must not leave a button spinning forever. */
const REQUEST_TIMEOUT_MS = 30_000;

function withTimeout(signal?: AbortSignal | null) {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

export class ApiError extends Error {
  readonly status: number;
  readonly errors: ApiFieldError[];
  readonly traceId?: string;
  readonly retryAfterSeconds?: number;
  /** Payload sent with some failures, e.g. the clashing sessions of a 409 student_schedule_conflict. */
  readonly data?: unknown;

  constructor(input: {
    message: string;
    status: number;
    errors?: ApiFieldError[] | null;
    traceId?: string;
    retryAfterSeconds?: number;
    data?: unknown;
  }) {
    super(input.message);
    this.name = "ApiError";
    this.status = input.status;
    this.errors = input.errors ?? [];
    this.traceId = input.traceId;
    this.retryAfterSeconds = input.retryAfterSeconds;
    this.data = input.data ?? undefined;
  }

  get code(): string | undefined {
    return this.errors[0]?.code;
  }

  get isConcurrency(): boolean {
    return this.status === 409 && this.errors.some((error) => isConcurrencyCode(error.code));
  }

  hasCode(code: string): boolean {
    return this.errors.some((error) => error.code === code);
  }

  fieldMessage(field: string): string | undefined {
    const match = this.errors.find((error) => error.field?.toLowerCase() === field.toLowerCase());
    if (!match) return undefined;
    return errorMessages[match.code] ?? match.message;
  }
}

function notifySession() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("tm:session", { detail: { authenticated: Boolean(session) } }));
  }
}

export function setAccessToken(tokens: TokenResponse) {
  session = {
    token: tokens.accessToken,
    expiresAt: Date.now() + Math.max(1, tokens.expiresIn - 15) * 1000,
  };
  notifySession();
}

export function clearAccessToken() {
  session = null;
  notifySession();
}

export function hasLiveAccessToken() {
  return Boolean(session && session.expiresAt > Date.now());
}

function makeUrl(path: string, query?: ApiRequestOptions["query"]) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${API_ROOT}${normalized}`, typeof window === "undefined" ? "http://localhost" : window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return configuredBase ? url.toString() : `${url.pathname}${url.search}`;
}

async function readEnvelope<T>(response: Response): Promise<ApiEnvelope<T> | null> {
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) return null;
  return (await response.json()) as ApiEnvelope<T>;
}

function errorFrom(response: Response, envelope: ApiEnvelope<unknown> | null) {
  const retryHeader = response.headers.get("retry-after");
  const retryAfterSeconds = retryHeader ? Number.parseInt(retryHeader, 10) : undefined;
  return new ApiError({
    status: response.status,
    message: envelope?.message || `Yêu cầu thất bại (${response.status}).`,
    errors: envelope?.errors,
    traceId: envelope?.traceId,
    retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined,
    data: envelope?.data,
  });
}

export async function refreshAccessToken(): Promise<TokenResponse> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const response = await fetch(makeUrl("/auth/refresh-token"), {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: withTimeout(),
    });
    const envelope = await readEnvelope<TokenResponse>(response);
    if (!response.ok || !envelope?.success || !envelope.data) {
      clearAccessToken();
      throw errorFrom(response, envelope);
    }
    setAccessToken(envelope.data);
    return envelope.data;
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const {
    auth = "required",
    body,
    retryAuth = true,
    idempotencyKey,
    query,
    headers: suppliedHeaders,
    signal,
    ...fetchOptions
  } = options;

  if (auth === "required" && !hasLiveAccessToken()) {
    await refreshAccessToken();
  }

  const headers = new Headers(suppliedHeaders);
  headers.set("Accept", "application/json");
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
  if (auth !== "none" && session?.token) headers.set("Authorization", `Bearer ${session.token}`);

  const response = await fetch(makeUrl(path, query), {
    ...fetchOptions,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "include",
    cache: "no-store",
    signal: withTimeout(signal),
  });
  const envelope = await readEnvelope<T>(response);

  if (response.status === 401 && auth !== "none" && retryAuth) {
    await refreshAccessToken();
    return apiRequest<T>(path, { ...options, retryAuth: false });
  }

  if (!response.ok || (envelope && !envelope.success)) throw errorFrom(response, envelope);
  return (envelope?.data ?? undefined) as T;
}

export function getApiErrorMessage(error: unknown, fallback = "Không thể xử lý yêu cầu. Vui lòng thử lại.") {
  if (!(error instanceof ApiError)) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return "Máy chủ phản hồi quá lâu. Tải lại trang để kiểm tra thao tác đã được lưu chưa rồi thử lại.";
    }
    if (error instanceof TypeError) return "Không kết nối được máy chủ. Kiểm tra mạng hoặc trạng thái API.";
    return fallback;
  }
  if (error.status === 429) {
    return error.retryAfterSeconds
      ? `Bạn thao tác quá nhanh. Thử lại sau ${error.retryAfterSeconds} giây.`
      : errorMessages.rate_limit_exceeded;
  }
  const translated = error.errors.map((item) => errorMessages[item.code]).find(Boolean);
  if (translated) return translated;
  const validation = error.errors.filter((item) => item.code === "validation_error");
  if (validation.length) return validation.map((item) => item.message).join(" ");
  if (error.status === 403) return "Bạn không có quyền thực hiện thao tác này trong trung tâm hiện tại.";
  if (error.status === 404) return "Không tìm thấy dữ liệu, có thể đã bị xoá hoặc thuộc trung tâm khác.";
  if (error.status >= 500) return "Máy chủ gặp lỗi. Hãy thử lại sau ít phút.";
  return error.message || fallback;
}

export function currentAccessToken(): string | null {
  return session && session.expiresAt > Date.now() ? session.token : null;
}
