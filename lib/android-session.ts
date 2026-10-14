import { cookies } from "next/headers";
import { after, NextResponse } from "next/server";
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

// Companion identity bound to the opaque browser session.
const COOKIE = "__Host-gtv_android_sso";
const MAX_AGE = 30 * 86400;

export const noStore = {
  "Cache-Control": "no-store",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
};

export const b64 = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);

const digest = (value: string) =>
  createHash("sha256").update(value).digest("base64url");

const equal = (a: string, b: string) =>
  Buffer.byteLength(a) === Buffer.byteLength(b) &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));

const mac = (key: string, purpose: string, value: string) =>
  createHmac("sha256", key)
    .update(purpose + "\n" + value)
    .digest("base64url");

function serviceKey() {
  const key = process.env.GTV_ANDROID_SSO_SERVICE_KEY;

  if (!key || !/^[A-Za-z0-9_-]{43,}$/.test(key)) {
    throw Error("SSO_UNAVAILABLE");
  }

  return key;
}

function origin(value: string | undefined) {
  const u = new URL(value || "");

  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    u.pathname !== "/" ||
    (u.port && u.port !== "443") ||
    u.hostname === "localhost" ||
    u.hostname.endsWith(".localhost") ||
    u.hostname.includes(":") ||
    /^\d+(\.\d+){3}$/.test(u.hostname)
  ) {
    throw Error("SSO_UNAVAILABLE");
  }

  return u;
}

export function androidSettings() {
  return {
    key: serviceKey(),
    audience: origin(process.env.GTV_ANDROID_API_URL).origin,
    webOrigin: origin(process.env.GTV_ANDROID_WEB_ORIGIN).origin,
    xtreamBaseUrl: origin(
      process.env.GTV_ANDROID_XTREAM_BASE_URL,
    ).href,
  };
}

type Identity = {
  v: number;
  id: string;
  binding: string;
  expiresAt: number;
};

function readIdentity(
  value: string | undefined,
  key: string,
): Identity | null {
  try {
    if (!value || value.length > 1024) {
      return null;
    }

    const parts = value.split(".");

    if (
      parts.length !== 2 ||
      !/^[A-Za-z0-9_-]+$/.test(parts[0]) ||
      !b64(parts[1]) ||
      !equal(
        parts[1],
        mac(key, "android-cookie", parts[0]),
      )
    ) {
      return null;
    }

    const data = JSON.parse(
      Buffer.from(parts[0], "base64url").toString("utf8"),
    );

    if (
      data.v !== 1 ||
      !b64(data.id) ||
      !b64(data.binding) ||
      !Number.isSafeInteger(data.expiresAt) ||
      data.expiresAt <= Date.now() ||
      data.expiresAt > Date.now() + MAX_AGE * 1000
    ) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

function companionHeader(
  value: string,
  maxAge: number,
) {
  return `${COOKIE}=${value}; Path=/; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=Lax`;
}

export function clearAndroidCookie(
  response: NextResponse,
) {
  response.headers.append(
    "Set-Cookie",
    companionHeader("", 0),
  );
}

/**
 * Only called after the existing Railway login
 * has actually returned its session cookie.
 */
export function attachAndroidIdentity(
  response: NextResponse,
): boolean {
  try {
    const raw =
      response.cookies.get("gtv_session")?.value;

    if (!response.ok || !raw) {
      return false;
    }

    if (!/^[A-Za-z0-9_-]{43}$/.test(raw)) return false;

    const key = serviceKey();

    const data: Identity = {
      v: 1,
      id: randomBytes(32).toString("base64url"),
      binding: mac(
        key,
        "web-cookie-binding",
        raw,
      ),
      expiresAt:
        Date.now() + MAX_AGE * 1000,
    };

    const payload = Buffer.from(
      JSON.stringify(data),
    ).toString("base64url");

    // Append preserves the original upstream
    // Set-Cookie bytes and attributes.
    response.headers.append(
      "Set-Cookie",
      companionHeader(
        payload +
          "." +
          mac(
            key,
            "android-cookie",
            payload,
          ),
        MAX_AGE,
      ),
    );

    return true;
  } catch {
    // Android configuration/crypto failure must
    // never fail a successful Web login.
    if (
      response.ok &&
      response.cookies.get("gtv_session")?.value
    ) {
      clearAndroidCookie(response);
    }

    return false;
  }
}

export async function androidSessionId():
  Promise<string | null> {
  const jar = await cookies();
  const key = serviceKey();

  const companion =
    jar.get(COOKIE)?.value;

  const raw =
    jar.get("gtv_session")?.value;

  const data =
    readIdentity(companion, key);

  if (!data || !raw) {
    return null;
  }

  const bindingOk = equal(
    data.binding,
    mac(
      key,
      "web-cookie-binding",
      raw,
    ),
  );

  return bindingOk
    ? data.id
    : null;
}

export async function captureAndroidRevocation():
  Promise<string | null> {
  try {
    return (
      readIdentity(
        (await cookies()).get(COOKIE)?.value,
        serviceKey(),
      )?.id || null
    );
  } catch {
    return null;
  }
}

async function jsonBounded(
  response: Response,
  limit: number,
) {
  if (!response.body) {
    throw Error("INVALID_RESPONSE");
  }

  const reader =
    response.body.getReader();

  const parts: Uint8Array[] = [];
  let size = 0;

  for (;;) {
    const { done, value } =
      await reader.read();

    if (done) {
      break;
    }

    size += value.length;

    if (size > limit) {
      await reader.cancel();
      throw Error("INVALID_RESPONSE");
    }

    parts.push(value);
  }

  return JSON.parse(
    Buffer.concat(parts).toString("utf8"),
  );
}

/**
 * Independent revalidation;
 * no import from the obsolete GTV lib/xtream/client.
 */
export async function authenticate(
  creds: {
    username: string;
    password: string;
  },
  baseUrl: string,
) {
  if (
    !creds.username ||
    !creds.password ||
    creds.username.length > 256 ||
    creds.password.length > 1024 ||
    /[\x00-\x1f]/.test(
      creds.username + creds.password,
    )
  ) {
    throw Error("AUTH_DENIED");
  }

  // baseUrl comes exclusively from validated
  // server configuration, never cookie serverUrl.
  const u = new URL(
    "/player_api.php",
    baseUrl,
  );

  u.searchParams.set(
    "username",
    creds.username,
  );

  u.searchParams.set(
    "password",
    creds.password,
  );

  const response = await fetch(u, {
    method: "GET",
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
    headers: {
      Accept: "application/json",
      "User-Agent":
        "GTV/3.0 Android SSO",
    },
  });

  if (!response.ok) {
    throw Error("AUTH_DENIED");
  }

  const data = await jsonBounded(
    response,
    128 * 1024,
  );

  const user = data?.user_info;

  if (
    Number(user?.auth) !== 1 ||
    user.status !== "Active" ||
    (
      user.exp_date &&
      (
        !Number.isFinite(
          Number(user.exp_date),
        ) ||
        Number(user.exp_date) * 1000 <=
          Date.now()
      )
    )
  ) {
    throw Error("AUTH_DENIED");
  }
}

export async function androidService(
  path:
    | "/api/session/register"
    | "/api/session/revoke",
  body: object,
  timeoutMs = 10000,
) {
  const {
    key,
    audience,
  } = androidSettings();

  const raw =
    JSON.stringify(body);

  const time =
    String(Date.now());

  const id =
    randomBytes(32).toString(
      "base64url",
    );

  const signature =
    createHmac("sha256", key)
      .update(
        [
          "POST",
          path,
          time,
          id,
          digest(raw),
        ].join("\n"),
      )
      .digest("base64url");

  const response = await fetch(
    audience + path,
    {
      method: "POST",
      redirect: "manual",
      cache: "no-store",
      signal:
        AbortSignal.timeout(timeoutMs),

      headers: {
        "Content-Type":
          "application/json",

        "Cache-Control":
          "no-store",

        "X-GTV-Time":
          time,

        "X-GTV-Request":
          id,

        "X-GTV-Signature":
          signature,
      },

      body: raw,
    },
  );

  if (
    !response.ok ||
    !response.headers
      .get("cache-control")
      ?.split(",")
      .some(
        (v) =>
          v.trim().toLowerCase() ===
          "no-store",
      )
  ) {
    throw Error(
      "ANDROID_UNAVAILABLE",
    );
  }

  return jsonBounded(
    response,
    4096,
  );
}

export function scheduleAndroidRevocation(
  sessionId: string | null,
) {
  if (!sessionId) {
    return;
  }

  try {
    after(async () => {
      try {
        await androidService(
          "/api/session/revoke",
          { sessionId },
          1500,
        );
      } catch {
        /*
         * Best effort;
         * never logs credentials
         * or delays Web login/logout.
         */
      }
    });
  } catch {
    /*
     * Even scheduler failure
     * cannot change the Web response.
     */
  }
}