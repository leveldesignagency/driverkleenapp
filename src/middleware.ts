import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { CANONICAL_CONTRACTOR_HOST, LEGACY_CONTRACTOR_HOSTS } from "@/lib/contractor-portal-origin";

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();

  if (host && (LEGACY_CONTRACTOR_HOSTS as readonly string[]).includes(host)) {
    const url = request.nextUrl.clone();
    url.hostname = CANONICAL_CONTRACTOR_HOST;
    url.protocol = "https";
    url.port = "";
    return NextResponse.redirect(url, 308);
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
