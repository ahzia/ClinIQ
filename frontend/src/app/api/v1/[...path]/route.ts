import { NextResponse } from "next/server";

// Frontend-only proxy to avoid browser CORS issues by keeping calls same-origin.
const BACKEND_API_BASE_URL =
  process.env.BACKEND_API_BASE_URL ?? "http://localhost:8000/api/v1";

export async function GET(
  req: Request,
  context: { params: Promise<{ path?: string[] }> }
) {
  const resolved = await context.params;
  return proxy(req, resolved.path ?? []);
}

export async function POST(
  req: Request,
  context: { params: Promise<{ path?: string[] }> }
) {
  const resolved = await context.params;
  return proxy(req, resolved.path ?? []);
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ path?: string[] }> }
) {
  const resolved = await context.params;
  return proxy(req, resolved.path ?? []);
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ path?: string[] }> }
) {
  const resolved = await context.params;
  return proxy(req, resolved.path ?? []);
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ path?: string[] }> }
) {
  const resolved = await context.params;
  return proxy(req, resolved.path ?? []);
}

async function proxy(req: Request, pathParts: string[]) {
  const backendPath = pathParts.join("/");
  const incomingUrl = new URL(req.url);
  const search = incomingUrl.search;

  const targetUrl = `${BACKEND_API_BASE_URL}/${backendPath}${search}`;

  const headers = new Headers(req.headers);
  headers.delete("host");

  // For GET/HEAD there is usually no body; for others we forward raw bytes.
  const methodsWithBody = new Set(["POST", "PUT", "PATCH", "DELETE"]);
  const body = methodsWithBody.has(req.method.toUpperCase())
    ? await req.arrayBuffer()
    : undefined;

  const res = await fetch(targetUrl, {
    method: req.method,
    headers,
    body,
    // Next.js runs this in a Node runtime; disabling cache is fine for API proxying.
    cache: "no-store",
  });

  // Preserve status and headers for the client.
  const responseHeaders = new Headers(res.headers);
  return new NextResponse(res.body, {
    status: res.status,
    headers: responseHeaders,
  });
}

