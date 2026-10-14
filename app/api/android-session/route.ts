import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import {
  androidSettings,
  androidSessionId,
  androidService,
  authenticate,
  b64,
  noStore,
} from "@/lib/android-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let settings: ReturnType<typeof androidSettings>;

  try {
    settings = androidSettings();
  } catch {
    return NextResponse.json(
      { error: "SESSION_EXCHANGE_NOT_CONFIGURED" },
      { status: 503, headers: noStore },
    );
  }

  if (
    new URL(req.url).origin !== settings.webOrigin ||
    req.headers.get("origin") !== settings.webOrigin ||
    req.headers.get("x-gtv-native") !== "1" ||
    req.headers
      .get("content-type")
      ?.split(";")[0]
      .trim() !== "application/json"
  ) {
    return NextResponse.json(
      { error: "FORBIDDEN" },
      { status: 403, headers: noStore },
    );
  }

  let body: {
    challenge: string;
    nonce: string;
    audience: string;
    xtreamBaseUrl: string;
  };

  try {
    if (!req.body) throw Error("BODY_MISSING");

    const reader = req.body.getReader();
    const parts: Uint8Array[] = [];
    let size = 0;

    for (;;) {
      const { done, value } = await reader.read();

      if (done) break;

      size += value.length;

      if (size > 2048) {
        await reader.cancel();
        throw Error("BODY_TOO_LARGE");
      }

      parts.push(value);
    }

    body = JSON.parse(
      Buffer.concat(parts).toString("utf8"),
    );

    if (
      !body ||
      Array.isArray(body) ||
      Object.keys(body).some(
        (k) =>
          ![
            "challenge",
            "nonce",
            "audience",
            "xtreamBaseUrl",
          ].includes(k),
      ) ||
      !b64(body.challenge) ||
      !b64(body.nonce) ||
      body.audience !== settings.audience ||
      new URL(body.xtreamBaseUrl).href !==
        settings.xtreamBaseUrl
    ) {
      throw Error("INVALID_BODY");
    }
  } catch {
    return NextResponse.json(
      { error: "INVALID_REQUEST" },
      { status: 400, headers: noStore },
    );
  }

  try {
    let sessionId: string | null;

    try {
      sessionId = await androidSessionId();
    } catch (error) {
      return NextResponse.json(
        {
          error: "ANDROID_SESSION_ID_FAILED",
          reason:
            error instanceof Error
              ? error.message
              : "UNKNOWN_ERROR",
        },
        { status: 500, headers: noStore },
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: "GTV_SESSION_RELOGIN_REQUIRED" },
        { status: 401, headers: noStore },
      );
    }

    let creds;

    try {
      creds = await requireSession();
    } catch (error) {
      return NextResponse.json(
        {
          error: "REQUIRE_SESSION_FAILED",
          reason:
            error instanceof Error
              ? error.message
              : "UNKNOWN_ERROR",
        },
        { status: 401, headers: noStore },
      );
    }

    if (
      typeof creds.username !== "string" ||
      typeof creds.password !== "string"
    ) {
      return NextResponse.json(
        { error: "INVALID_SESSION_CREDS" },
        { status: 401, headers: noStore },
      );
    }

    try {
      await authenticate(
        {
          username: creds.username,
          password: creds.password,
        },
        settings.xtreamBaseUrl,
      );
    } catch (error) {
      return NextResponse.json(
        {
          error: "XTREAM_FAILED",
          reason:
            error instanceof Error
              ? error.message
              : "UNKNOWN_ERROR",
        },
        { status: 401, headers: noStore },
      );
    }

    let ticket: any;

    try {
      ticket = await androidService(
        "/api/session/register",
        {
          ...body,
          sessionId,
          username: creds.username,
          password: creds.password,
        },
      );
    } catch (error) {
      return NextResponse.json(
        {
          error: "REGISTER_FAILED",
          reason:
            error instanceof Error
              ? error.message
              : "UNKNOWN_ERROR",
        },
        { status: 502, headers: noStore },
      );
    }

    try {
      if (
        !ticket ||
        typeof ticket !== "object" ||
        !b64(ticket.code) ||
        ticket.nonce !== body.nonce ||
        ticket.audience !== settings.audience ||
        !Number.isSafeInteger(ticket.expiresAt) ||
        ticket.expiresAt * 1000 <= Date.now() ||
        ticket.expiresAt * 1000 >
          Date.now() + 60000
      ) {
        return NextResponse.json(
          { error: "TICKET_INVALID" },
          { status: 502, headers: noStore },
        );
      }
    } catch (error) {
      return NextResponse.json(
        {
          error: "TICKET_VALIDATION_EXCEPTION",
          reason:
            error instanceof Error
              ? error.message
              : "UNKNOWN_ERROR",
        },
        { status: 502, headers: noStore },
      );
    }

    return NextResponse.json(ticket, {
      status: 200,
      headers: noStore,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "SESSION_EXCHANGE_DENIED",
        reason:
          error instanceof Error
            ? error.message
            : "UNKNOWN_ERROR",
      },
      {
        status: 401,
        headers: noStore,
      },
    );
  }
}