import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/loja" || pathname.startsWith("/loja/")) {
    try {
      const { verifyAccessToken, ACCESS_COOKIE } = await import("@mypet/core/access-session");
      if (!verifyAccessToken(request.cookies.get(ACCESS_COOKIE)?.value)) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    } catch {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/loja", "/loja/:path*"],
};
