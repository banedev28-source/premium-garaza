import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { inviteUserSchema } from "@/lib/validations";
import { sendInviteEmail } from "@/lib/email";
import { audit, getClientIp } from "@/lib/audit";
import { inviteLimiter, checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 10 invites per hour per admin
  const rlResponse = await checkRateLimit(inviteLimiter, session.user.id);
  if (rlResponse) return rlResponse;

  const body = await req.json();
  const parsed = inviteUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { email, role } = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Korisnik sa ovom email adresom vec postoji" },
      { status: 400 }
    );
  }

  const inviteToken = randomBytes(32).toString("hex");
  const inviteTokenExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

  const user = await prisma.user.create({
    data: {
      email,
      role,
      status: "PENDING",
      inviteToken,
      inviteTokenExpiry,
      invitedById: session.user.id,
    },
  });

  try {
    await sendInviteEmail(email, inviteToken, session.user.name || "Admin");
  } catch {
    // Email sending failed, but user is created
    // They can still use the invite link
  }

  const ip = await getClientIp();
  audit({ action: "USER_INVITED", userId: session.user.id, targetId: user.id, metadata: { email, role }, ip });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const inviteLink = `${appUrl}/invite/${inviteToken}`;

  return NextResponse.json({
    id: user.id,
    email: user.email,
    inviteLink,
  });
}
