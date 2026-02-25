import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextRequest, NextResponse } from "next/server";
import { loginLimiter, checkRateLimit } from "@/lib/rate-limit";

const { auth } = NextAuth(authConfig);

interface UserWithRole {
  role?: string;
  [key: string]: unknown;
}

function getIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "127.0.0.1";
}

function csrfCheck(req: NextRequest): NextResponse | null {
  const method = req.method;
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return null;

  const { pathname } = req.nextUrl;

  // Exempt paths: cron (uses Bearer token), NextAuth internal
  if (pathname.startsWith("/api/cron") || pathname.startsWith("/api/auth")) {
    return null;
  }

  const origin = req.headers.get("origin");
  if (!origin) {
    return NextResponse.json({ error: "Forbidden - missing origin" }, { status: 403 });
  }

  const allowed = new URL(req.url).origin;
  if (origin !== allowed) {
    return NextResponse.json({ error: "Forbidden - origin mismatch" }, { status: 403 });
  }

  return null;
}

export default auth(async (req) => {
  // CSRF check on all mutating requests
  const csrfResponse = csrfCheck(req);
  if (csrfResponse) return csrfResponse;

  const { pathname } = req.nextUrl;

  // Rate limit login attempts (POST to /api/auth/callback/credentials)
  if (
    req.method === "POST" &&
    pathname.startsWith("/api/auth/callback/credentials")
  ) {
    const ip = getIp(req);
    const rlResponse = await checkRateLimit(loginLimiter, ip);
    if (rlResponse) return rlResponse;
  }

  const user = req.auth?.user as UserWithRole | undefined;

  // Public routes
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/offline") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/invite")
  ) {
    if (pathname.startsWith("/login") && user) {
      const redirectUrl = user.role === "ADMIN" ? "/admin/dashboard" : "/auctions";
      return NextResponse.redirect(new URL(redirectUrl, req.url));
    }
    return NextResponse.next();
  }

  // Protected routes
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Admin routes
  if (pathname.startsWith("/admin") && user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/auctions", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.|manifest\\.json|sw\\.js|icon-|screenshot-|api/pusher|api/cron).*)",
  ],
};
