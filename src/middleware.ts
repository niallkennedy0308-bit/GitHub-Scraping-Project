import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminPage = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");
  const isPortalPage = pathname.startsWith("/portal");
  const isPortalApi = pathname.startsWith("/api/portal");

  if (!isAdminPage && !isAdminApi && !isPortalPage && !isPortalApi) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  });

  if (!token) {
    if (isAdminApi || isPortalApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Regular users use the dedicated portal only.
  if (token.role === "USER") {
    if (isAdminPage || isAdminApi) {
      if (isAdminApi) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/portal/discover", request.url));
    }
    return NextResponse.next();
  }

  if (token.role === "ADMIN") {
    // Admins keep full admin access; portal APIs/pages are also allowed if opened.
    return NextResponse.next();
  }

  if (isAdminApi || isPortalApi) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.redirect(new URL("/forbidden", request.url));
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/portal/:path*", "/api/portal/:path*"],
};
