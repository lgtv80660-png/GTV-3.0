import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE = "https://image.tmdb.org/t/p/w500";

export async function GET(req: NextRequest) {
  try {
    const name =
      req.nextUrl.searchParams.get("name")?.trim();

    if (!name) {
      return NextResponse.json({
        photoUrl: null,
        bio: null,
      });
    }

    const apiKey =
      process.env.TMDB_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        photoUrl: null,
        bio: null,
      });
    }

    /* =========================================
       SEARCH PERSON
    ========================================= */

    const searchRes = await fetch(
      `${TMDB_BASE}/search/person?api_key=${apiKey}` +
        `&query=${encodeURIComponent(name)}` +
        `&language=fr-FR`,
      {
        next: {
          revalidate: 86400,
        },
      }
    );

    if (!searchRes.ok) {
      return NextResponse.json({
        photoUrl: null,
        bio: null,
      });
    }

    const searchData =
      await searchRes.json();

    const person =
      searchData?.results?.[0];

    if (!person?.id) {
      return NextResponse.json({
        photoUrl: null,
        bio: null,
      });
    }

    /* =========================================
       PERSON DETAILS FR
    ========================================= */

    const frRes = await fetch(
      `${TMDB_BASE}/person/${person.id}` +
        `?api_key=${apiKey}` +
        `&language=fr-FR`,
      {
        next: {
          revalidate: 86400,
        },
      }
    );

    const frData =
      frRes.ok
        ? await frRes.json()
        : {};

    /* =========================================
       PERSON DETAILS EN FALLBACK
    ========================================= */

    let enData: any = {};

    if (!frData?.biography?.trim()) {
      const enRes = await fetch(
        `${TMDB_BASE}/person/${person.id}` +
          `?api_key=${apiKey}` +
          `&language=en-US`,
        {
          next: {
            revalidate: 86400,
          },
        }
      );

      if (enRes.ok) {
        enData =
          await enRes.json();
      }
    }

    const profilePath =
      frData?.profile_path ||
      enData?.profile_path ||
      person?.profile_path;

    const bio =
      frData?.biography?.trim() ||
      enData?.biography?.trim() ||
      null;

    return NextResponse.json({
      id: person.id,

      name:
        frData?.name ||
        enData?.name ||
        person?.name ||
        name,

      photoUrl:
        profilePath
          ? `${TMDB_IMAGE}${profilePath}`
          : null,

      bio,

      birthday:
        frData?.birthday ||
        enData?.birthday ||
        null,

      placeOfBirth:
        frData?.place_of_birth ||
        enData?.place_of_birth ||
        null,

      knownFor:
        frData?.known_for_department ||
        enData?.known_for_department ||
        null,
    });
  } catch (error) {
    console.error(
      "[actor-photo]",
      error
    );

    return NextResponse.json({
      photoUrl: null,
      bio: null,
    });
  }
}