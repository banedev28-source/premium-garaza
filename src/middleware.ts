import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

interface UserWithRole {
  role?: string;
  [key: string]: unknown;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const user = req.auth?.user as UserWithRole | undefined;

  // Public routes
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/invite") ||
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
    "/((?!_next/static|_next/image|favicon.ico|api/pusher|api/cron).*)",
  ],
};
