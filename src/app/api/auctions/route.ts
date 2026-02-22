import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { auctionSchema } from "@/lib/validations";
import { Prisma } from "@/generated/prisma/client";
import { audit, getClientIp } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get("status");
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 50));
  const where: Prisma.AuctionWhereInput = {};

  if (status) {
    where.status = status as Prisma.EnumAuctionStatusFilter;
  }

  // Buyers only see LIVE and ENDED auctions (never ARCHIVED)
  if (session.user.role === "BUYER") {
    where.status = { in: ["LIVE", "ENDED"] };
  }

  const auctions = await prisma.auction.findMany({
    where,
    include: {
      vehicle: true,
      _count: { select: { bids: true } },
      createdBy: { select: { name: true } },
      winner: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });

  // For buyers, hide winner/finalPrice on ended auctions they didn't participate in
  if (session.user.role === "BUYER") {
    const endedAuctionIds = auctions
      .filter((a) => a.status === "ENDED")
      .map((a) => a.id);

    let participatedIds = new Set<string>();
    if (endedAuctionIds.length > 0) {
      const userBids = await prisma.bid.findMany({
        where: {
          userId: session.user.id,
          auctionId: { in: endedAuctionIds },
        },
        select: { auctionId: true },
        distinct: ["auctionId"],
      });
      participatedIds = new Set(userBids.map((b) => b.auctionId));
    }

    const filtered = auctions.map((a) => {
      if (a.status === "ENDED" && !participatedIds.has(a.id)) {
        return { ...a, winner: null, winnerId: null, finalPrice: null };
      }
      return a;
    });

    return NextResponse.json(filtered);
  }

  return NextResponse.json(auctions);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = auctionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  // Check if vehicle already has an auction
  const existingAuction = await prisma.auction.findUnique({
    where: { vehicleId: parsed.data.vehicleId },
  });

  if (existingAuction) {
    return NextResponse.json(
      { error: "Vozilo vec ima aukciju" },
      { status: 400 }
    );
  }

  const auction = await prisma.auction.create({
    data: {
      vehicleId: parsed.data.vehicleId,
      createdById: session.user.id,
      startTime: new Date(parsed.data.startTime),
      endTime: new Date(parsed.data.endTime),
      currency: parsed.data.currency,
      startingPrice: parsed.data.startingPrice,
      reservePrice: parsed.data.reservePrice,
      showReservePrice: parsed.data.showReservePrice,
      auctionType: parsed.data.auctionType,
      showBidCount: parsed.data.showBidCount,
      buyNowEnabled: parsed.data.buyNowEnabled,
      buyNowPrice: parsed.data.buyNowPrice,
      status: "DRAFT",
    },
    include: {
      vehicle: true,
    },
  });

  const ip = await getClientIp();
  audit({ action: "AUCTION_CREATED", userId: session.user.id, targetId: auction.id, ip });

  return NextResponse.json(auction, { status: 201 });
}
