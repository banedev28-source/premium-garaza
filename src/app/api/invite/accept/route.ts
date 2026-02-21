import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { setPasswordSchema } from "@/lib/validations";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = setPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { token, password, name } = parsed.data;

  const user = await prisma.user.findFirst({
    where: {
      inviteToken: token,
      inviteTokenExpiry: { gt: new Date() },
      status: "PENDING",
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 404 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name,
      passwordHash,
      status: "ACTIVE",
      inviteToken: null,
      inviteTokenExpiry: null,
    },
  });

  return NextResponse.json({ success: true });
}
