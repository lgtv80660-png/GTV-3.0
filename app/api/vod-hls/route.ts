import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND =
  process.env.GTV_VOD_TEST_BACKEND_URL ||
  process.env.RAILWAY_BACKEND_URL ||
  "";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const target = new URL("/api/vod-hls", BACKEND);

  url.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value);
  });

  const res = await fetch(target.toString(), {
    headers: {
      cookie: req.headers.get("cookie") || "",
      range: req.headers.get("range") || "",
    },
    redirect: "manual",
  });

  const headers = new Headers(res.headers);

  return new Response(res.body, {
    status: res.status,
    headers,
  });
}

export async function HEAD(req: NextRequest) {
  return GET(req);
}