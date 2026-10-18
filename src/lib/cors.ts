import { NextResponse } from "next/server";

// SDK endpoints are called from customer sites, so they allow any origin.
// They never rely on cookies: workspaces are identified by public key,
// builder calls by a bearer token.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function json(data: unknown, init?: number | ResponseInit) {
  const base = typeof init === "number" ? { status: init } : init ?? {};
  return NextResponse.json(data, { ...base, headers: { ...corsHeaders, ...(base.headers ?? {}) } });
}

export function preflight() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
