import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isValidSession } from "@/lib/auth";

// Everything requires a session except public short links, the login page, the legal
// pages required by Meta/TikTok, the cron endpoint (checks CRON_SECRET) and media
// upload (checks the session itself).
export function proxy(request: NextRequest) {
  if (isValidSession(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!go/|login|legal/|api/cron|api/media/upload|_next/|favicon.ico).*)"],
};
