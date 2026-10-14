import { NextRequest, NextResponse } from "next/server";
import * as gateway from "../[...path]/route";
import { attachAndroidIdentity, captureAndroidRevocation, clearAndroidCookie, scheduleAndroidRevocation } from "@/lib/android-session";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const context = () => ({ params: Promise.resolve({ path: ["auth"] }) });
export async function POST(req: NextRequest) {
  const oldSession = await captureAndroidRevocation();
  const response = await gateway.POST(req, context());
  if (response.ok && response.cookies.get("gtv_session")?.value) { attachAndroidIdentity(response); scheduleAndroidRevocation(oldSession); }
  return response;
}
export {POST as DELETE} from '../logout/route';
export const GET = (req: NextRequest) => gateway.GET(req, context());
export const PUT = (req: NextRequest) => gateway.PUT(req, context());
export const PATCH = (req: NextRequest) => gateway.PATCH(req, context());
export const HEAD = (req: NextRequest) => gateway.HEAD(req, context());
export const OPTIONS = (req: NextRequest) => gateway.OPTIONS(req, context());
