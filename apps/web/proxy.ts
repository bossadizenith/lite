import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const LOGIN_PATH = "/auth/login";

function normalizePathname(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function isPublicRoute(pathname: string) {
  return pathname.startsWith("/auth");
}

export default async function proxy(request: NextRequest) {
  const pathname = normalizePathname(request.nextUrl.pathname);
  const sessionCookie = getSessionCookie(request);

  if (sessionCookie) {
    if (isPublicRoute(pathname)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
};
