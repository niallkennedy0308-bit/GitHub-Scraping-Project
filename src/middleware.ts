import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

function isUserAllowedPath(pathname: string) {
  if (pathname === "/admin/users") return true;
  if (/^\/admin\/users\/[^/]+$/.test(pathname)) return true;
  if (pathname === "/api/admin/users") return true;
  if (/^\/api\/admin\/users\/[^/]+$/.test(pathname)) return true;
  if (/^\/api\/admin\/users\/[^/]+\/contact$/.test(pathname)) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminPage = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");

  if (!isAdminPage && !isAdminApi) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  });

  if (!token) {
    if (isAdminApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (token.role === "ADMIN") {
    return NextResponse.next();
  }

  if (token.role === "USER") {
    if (pathname === "/admin" || pathname === "/admin/") {
      return NextResponse.redirect(new URL("/admin/users", request.url));
    }
    if (isUserAllowedPath(pathname)) {
      // USER may only read user list/detail and update missing contact fields.
      if (isAdminApi && request.method !== "GET" && !pathname.endsWith("/contact")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (pathname.endsWith("/contact") && request.method !== "PATCH") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.next();
    }
  }

  if (isAdminApi) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.redirect(new URL("/forbidden", request.url));
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
