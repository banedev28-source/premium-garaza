import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 50));

  const auctions = await prisma.auction.findMany({
    where: {
      winnerId: session.user.id,
      status: "ENDED",
    },
    select: {
      id: true,
      currency: true,
      finalPrice: true,
      endTime: true,
      vehicle: { select: { name: true, images: true } },
    },
    orderBy: { endTime: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });

  return NextResponse.json(auctions);
}
