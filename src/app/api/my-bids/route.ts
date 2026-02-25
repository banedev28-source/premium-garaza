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

  const bids = await prisma.bid.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      amount: true,
      createdAt: true,
      auction: {
        select: {
          id: true,
          status: true,
          currency: true,
          auctionType: true,
          vehicle: { select: { name: true, images: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });

  return NextResponse.json(bids);
}
