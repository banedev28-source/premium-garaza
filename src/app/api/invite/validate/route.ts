import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
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
