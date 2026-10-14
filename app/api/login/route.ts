import { NextRequest } from "next/server";
import * as gateway from "../[...path]/route";
import { attachAndroidIdentity, captureAndroidRevocation, scheduleAndroidRevocation } from "@/lib/android-session";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const context = () => ({ params: Promise.resolve({ path: ["login"] }) });
export async function POST(req: NextRequest) {
  const oldSession = await captureAndroidRevocation();
  // The existing gateway still forwards the exact request to the existing Railway login.
  const response = await gateway.POST(req, context());
  const loggedIn = response.ok && Boolean(response.cookies.get("gtv_session")?.value);
  if (loggedIn) { attachAndroidIdentity(response); scheduleAndroidRevocation(oldSession); }
  return response;
}
export const GET = (req: NextRequest) => gateway.GET(req, context());
export const PUT = (req: NextRequest) => gateway.PUT(req, context());
export const PATCH = (req: NextRequest) => gateway.PATCH(req, context());
export const DELETE = (req: NextRequest) => gateway.DELETE(req, context());
export const HEAD = (req: NextRequest) => gateway.HEAD(req, context());
export const OPTIONS = (req: NextRequest) => gateway.OPTIONS(req, context());
