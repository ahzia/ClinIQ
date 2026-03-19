import { NextResponse } from "next/server";

const API_V1_PREFIX = "/api/v1";

/**
 * Backend mounts routers at `settings.api_prefix` (`/api/v1`).
 * Accepts `http://host:port`, `http://host:port/`, or `http://host:port/api/v1`.
 */
function resolveBackendApiV1Base(): string {
  const raw = (
    process.env.BACKEND_API_BASE_URL ?? "http://localhost:8000/api/v1"
  ).trim();
  if (!raw) return "http://localhost:8000/api/v1";
  try {
    const href = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
    const u = new URL(href);
    return `${u.origin}/api/v1`;
  } catch {
    return "http://localhost:8000/api/v1";
  }
}

const BACKEND_API_BASE_URL = resolveBackendApiV1Base();

/**
 * Next.js 16+ may pass `path` as string[] or string; it can also be empty.
 * Fall back to the incoming URL pathname so we always forward e.g. `mapping/hypotheses/...`.
 */
function pathPartsFromRequest(req: Request, paramsPath: string[] | undefined): string[] {
  if (paramsPath?.length) return paramsPath;

  const url = new URL(req.url);
  const pathname = (url.pathname.replace(/\/+$/, "") || "/") as string;

  if (!pathname.startsWith(API_V1_PREFIX)) return [];

  const afterPrefix = pathname.slice(API_V1_PREFIX.length).replace(/^\/+/, "");
  return afterPrefix ? afterPrefix.split("/").filter(Boolean) : [];
}

function paramsToSegments(path: string[] | string | undefined): string[] {
  if (Array.isArray(path)) return path;
  if (typeof path === "string") return path.split("/").filter(Boolean);
  return [];
}

async function forward(
  req: Request,
  context: { params: Promise<{ path?: string[] | string }> }
) {
  const resolved = await context.params;
  const fromParams = paramsToSegments(resolved.path);
  return proxy(req, pathPartsFromRequest(req, fromParams));
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const PUT = forward;
export const DELETE = forward;

async function proxy(req: Request, pathParts: string[]) {
  const base = BACKEND_API_BASE_URL.replace(/\/+$/, "");
  const backendPath = pathParts.map((p) => encodeURIComponent(p)).join("/");
  const incomingUrl = new URL(req.url);
  const search = incomingUrl.search;

  const targetUrl = backendPath ? `${base}/${backendPath}${search}` : `${base}${search}`;

  if (process.env.NODE_ENV === "development" && !backendPath) {
    console.warn(
      "[ClinIQ proxy] Empty path — request:",
      incomingUrl.pathname,
      "→ forwarding to base only (likely 404 on FastAPI)."
    );
  }

  const headers = new Headers(req.headers);
  headers.delete("host");

  const methodsWithBody = new Set(["POST", "PUT", "PATCH", "DELETE"]);
  const body = methodsWithBody.has(req.method.toUpperCase())
    ? await req.arrayBuffer()
    : undefined;

  const res = await fetch(targetUrl, {
    method: req.method,
    headers,
    body,
    cache: "no-store",
  });

  const responseHeaders = new Headers(res.headers);
  if (process.env.NODE_ENV === "development") {
    responseHeaders.set("x-cliniq-proxy-target", targetUrl);
  }

  return new NextResponse(res.body, {
    status: res.status,
    headers: responseHeaders,
  });
}
