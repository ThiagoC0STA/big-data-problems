/**
 * HTTP error model + small helpers shared by api-client and the resilience layer.
 */

export interface ApiErrorPayload {
  code: string;
  message: string;
  retryable: boolean;
  details?: unknown;
  status?: number;
}

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;
  readonly details: unknown;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message || `HTTP ${status}`);
    this.name = "HttpError";
    this.status = status;
    this.code = payload.code || `http_${status}`;
    this.retryable = payload.retryable ?? isRetryableStatus(status);
    this.details = payload.details;
  }
}

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

export function isRetryableStatus(status: number): boolean {
  return RETRYABLE.has(status);
}

export function apiUrl(path: string): string {
  const base =
    (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_API_URL : undefined) ||
    "/api";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return base.replace(/\/+$/, "") + normalized;
}

export interface FetchOptions extends RequestInit {
  /** Hard ceiling, abort the request after this many ms. */
  timeoutMs?: number;
}

/**
 * `fetch` wrapper that:
 * - resolves API URL
 * - applies AbortController-based timeout
 * - turns non-2xx into `HttpError` carrying the parsed ApiError payload
 * - returns parsed JSON for 2xx responses
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { timeoutMs = 20_000, headers, ...rest } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(apiUrl(path), {
      ...rest,
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        ...headers,
      },
    });
    if (!res.ok) {
      let payload: ApiErrorPayload;
      try {
        payload = (await res.json()) as ApiErrorPayload;
      } catch {
        payload = {
          code: `http_${res.status}`,
          message: res.statusText || `HTTP ${res.status}`,
          retryable: isRetryableStatus(res.status),
        };
      }
      throw new HttpError(res.status, payload);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new HttpError(408, {
        code: "timeout",
        message: `Request timed out after ${timeoutMs}ms`,
        retryable: true,
      });
    }
    throw new HttpError(0, {
      code: "network_error",
      message: err instanceof Error ? err.message : "Network failure",
      retryable: true,
    });
  } finally {
    clearTimeout(timer);
  }
}
