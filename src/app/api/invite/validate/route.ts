import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { publicApiLimiter, checkRateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  // Rate limit: 100 per minute per IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "127.0.0.1";
  const rlResponse = await checkRateLimit(publicApiLimiter, ip);
  if (rlResponse) return rlResponse;

  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: {
      inviteToken: token,
      inviteTokenExpiry: { gt: new Date() },
      status: "PENDING",
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 404 });
  }

  return NextResponse.json({ valid: true, email: user.email });
}
