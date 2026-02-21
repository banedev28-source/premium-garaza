import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
      invitedBy: {
        select: { name: true, email: true },
      },
      _count: {
        select: { bids: true, wonAuctions: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(users);
}
