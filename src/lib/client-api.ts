"use client";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export async function api<T>(url: string, init?: { method?: string; body?: unknown; idempotencyKey?: string }): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init?.idempotencyKey) headers["idempotency-key"] = init.idempotencyKey;
  let res: Response;
  try {
    res = await fetch(url, { method: init?.method ?? (init?.body ? "POST" : "GET"), headers, body: init?.body ? JSON.stringify(init.body) : undefined });
  } catch {
    throw new ApiError(0, "network", "We couldn't reach FanPulse. Check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? "server", data.message ?? "Something went wrong. Try again.");
  return data as T;
}

export function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2);
}
