"use client";

/** Default matches Next.js proxy when env is unset (demo-safe). */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "/api/v1";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE_URL) throw new Error("API base URL is not configured.");

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Request failed: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`);
  }

  return (await res.json()) as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  return requestJson<T>(path, { method: "GET" });
}

export async function apiPost<T, B = unknown>(path: string, body: B): Promise<T> {
  return requestJson<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export async function apiPatch<T, B = unknown>(path: string, body: B): Promise<T> {
  return requestJson<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

