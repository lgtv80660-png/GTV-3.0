import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const creds: any = await requireSession();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || "";

    const baseUrl = (creds?.baseUrl || creds?.url || creds?.serverUrl || "").replace(/\/+$/, "");
    const username = String(creds?.username || creds?.user || "");
    const password = String(creds?.password || creds?.pass || "");

    if (!baseUrl || !username || !password) {
      return NextResponse.json({ error: "Identifiants incomplets" }, { status: 400 });
    }

    const url = new URL(`${baseUrl}/player_api.php`);
    url.searchParams.set("username", username);
    url.searchParams.set("password", password);
    if (action) url.searchParams.set("action", action);

    searchParams.forEach((value, key) => {
      if (key !== "action") url.searchParams.set(key, value);
    });

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "VLC/3.0.20 LibVLC/3.0.20" },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Erreur IPTV (${res.status})` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erreur serveur" }, { status: 500 });
  }
}
