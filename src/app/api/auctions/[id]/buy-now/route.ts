import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusher } from "@/lib/pusher-server";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { audit, getClientIp } from "@/lib/audit";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "BUYER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: auctionId } = await params;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const auction = await tx.auction.findUnique({
          where: { id: auctionId },
          include: { vehicle: { select: { name: true } } },
        });

        if (!auction) throw new Error("Aukcija nije pronadjena");
        if (auction.status !== "LIVE") throw new Error("Aukcija nije aktivna");
        if (!auction.buyNowEnabled || !auction.buyNowPrice) {
          throw new Error("Buy Now nije omogucen za ovu aukciju");
        }

        // Create the buy now bid
        const bid = await tx.bid.create({
          data: {
            auctionId,
            userId: session.user.id,
            amount: auction.buyNowPrice,
            isBuyNow: true,
          },
        });

        // End the auction immediately
        const updated = await tx.auction.update({
          where: { id: auctionId },
          data: {
            status: "ENDED",
            winnerId: session.user.id,
            finalPrice: auction.buyNowPrice,
          },
          include: { vehicle: true },
        });

        return { bid, auction: updated };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    // Broadcast auction ended via buy now
    await pusher.trigger(`auction-${auctionId}`, "auction-ended", {
      auctionId,
      status: "ENDED",
      winnerId: session.user.id,
      finalPrice: Number(result.auction.finalPrice),
      buyNow: true,
    });

    // Notify all bidders
    const bidders = await prisma.bid.findMany({
      where: { auctionId, userId: { not: session.user.id } },
      select: { userId: true },
      distinct: ["userId"],
    });

    for (const bidder of bidders) {
      await prisma.notification.create({
        data: {
          userId: bidder.userId,
          type: "AUCTION_END",
          title: "Aukcija zavrsena",
          message: `Aukcija za ${result.auction.vehicle.name} je zavrsena - neko je iskoristio Buy Now opciju`,
          data: { auctionId },
        },
      });

      await pusher.trigger(`private-user-${bidder.userId}`, "notification", {
        type: "AUCTION_END",
        title: "Aukcija zavrsena",
        message: `Aukcija za ${result.auction.vehicle.name} je zavrsena`,
      });
    }

    // Notify winner
    await prisma.notification.create({
      data: {
        userId: session.user.id,
        type: "BUY_NOW",
        title: "Kupljeno!",
        message: `Uspesno ste kupili ${result.auction.vehicle.name} za ${result.auction.finalPrice} ${result.auction.currency}`,
        data: { auctionId },
      },
    });

    const ip = await getClientIp();
    audit({
      action: "BUY_NOW",
      userId: session.user.id,
      targetId: auctionId,
      metadata: { price: Number(result.auction.finalPrice) },
      ip,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Greska";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
