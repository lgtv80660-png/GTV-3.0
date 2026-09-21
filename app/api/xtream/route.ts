import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    const creds = await requireSession();
    const { searchParams } = new URL(request.url);

    const action = searchParams.get("action");
    const categoryId = searchParams.get("category_id");
    const seriesId = searchParams.get("series_id");
    const vodId = searchParams.get("vod_id");

    const baseUrl = creds.serverUrl.replace(/\/+$/, "");
    const authParams = `username=${encodeURIComponent(creds.username)}&password=${encodeURIComponent(creds.password)}`;

    // 1. LIVE
    if (action === "get_live_categories") {
      const res = await fetch(`${baseUrl}/player_api.php?${authParams}&action=get_live_categories`, {
        next: { revalidate: 300 },
      });
      const data = await res.json();
      return NextResponse.json(data);
    }

    if (action === "get_live_streams") {
      const url = `${baseUrl}/player_api.php?${authParams}&action=get_live_streams${
        categoryId ? `&category_id=${categoryId}` : ""
      }`;
      const res = await fetch(url, { next: { revalidate: 120 } });
      const data = await res.json();
      return NextResponse.json(data);
    }

    // 2. VOD FILMS
    if (action === "get_vod_categories") {
      const res = await fetch(`${baseUrl}/player_api.php?${authParams}&action=get_vod_categories`, {
        next: { revalidate: 300 },
      });
      const data = await res.json();
      return NextResponse.json(data);
    }

    if (action === "get_vod_streams") {
      const url = `${baseUrl}/player_api.php?${authParams}&action=get_vod_streams${
        categoryId ? `&category_id=${categoryId}` : ""
      }`;
      const res = await fetch(url, { next: { revalidate: 300 } });
      const data = await res.json();
      return NextResponse.json(data);
    }

    if (action === "get_vod_info" && vodId) {
      const url = `${baseUrl}/player_api.php?${authParams}&action=get_vod_info&vod_id=${vodId}`;
      const res = await fetch(url, { next: { revalidate: 300 } });
      const data = await res.json();
      return NextResponse.json(data);
    }

    // 3. SÉRIES
    if (action === "get_series_categories") {
      const res = await fetch(`${baseUrl}/player_api.php?${authParams}&action=get_series_categories`, {
        next: { revalidate: 300 },
      });
      const data = await res.json();
      return NextResponse.json(data);
    }

    if (action === "get_series") {
      const url = `${baseUrl}/player_api.php?${authParams}&action=get_series${
        categoryId ? `&category_id=${categoryId}` : ""
      }`;
      const res = await fetch(url, { next: { revalidate: 300 } });
      const data = await res.json();
      return NextResponse.json(data);
    }

    if (action === "get_series_info" && seriesId) {
      const url = `${baseUrl}/player_api.php?${authParams}&action=get_series_info&series_id=${seriesId}`;
      const res = await fetch(url, { next: { revalidate: 300 } });
      const data = await res.json();
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}