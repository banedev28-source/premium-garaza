import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { setPasswordSchema } from "@/lib/validations";
import { audit } from "@/lib/audit";
import { publicApiLimiter, checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // Rate limit: 100 per minute per IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "127.0.0.1";
  const rlResponse = await checkRateLimit(publicApiLimiter, ip);
  if (rlResponse) return rlResponse;

  const body = await req.json();
  const parsed = setPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { token, password, name } = parsed.data;

  const passwordHash = await bcrypt.hash(password, 12);

  // Atomic: updateMany with WHERE conditions prevents race condition
  // (two requests accepting same token simultaneously)
  const result = await prisma.user.updateMany({
    where: {
      inviteToken: token,
      inviteTokenExpiry: { gt: new Date() },
      status: "PENDING",
    },
    data: {
      name,
      passwordHash,
      status: "ACTIVE",
      inviteToken: null,
      inviteTokenExpiry: null,
    },
  });

  if (result.count === 0) {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 404 }
    );
  }

  // Get user ID for audit (token already cleared, find by email is not available here)
  const acceptedUser = await prisma.user.findFirst({
    where: { name, passwordHash, status: "ACTIVE" },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
  });

  audit({ action: "INVITE_ACCEPTED", userId: acceptedUser?.id, ip });

  return NextResponse.json({ success: true });
}
