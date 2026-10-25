import { NextResponse, type NextRequest } from "next/server";

// Com skipTrailingSlashRedirect (ver next.config.ts), a loja mesma tira a barra
// final, mantendo uma URL só por página. As rotas do blog ficam de fora: lá o
// Astro exige a barra.
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/" || !pathname.endsWith("/")) return NextResponse.next();

  // new URL em vez de nextUrl.clone(): o NextURL reformata a barra final.
  const url = new URL(request.url);
  url.pathname = pathname.replace(/\/+$/, "");
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ["/((?!blog|_astro|_next|img|api).*)"],
};
