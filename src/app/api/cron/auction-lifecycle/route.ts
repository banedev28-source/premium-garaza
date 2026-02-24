import { prisma } from "@/lib/prisma";
import { pusher } from "@/lib/pusher-server";
import { sendAuctionWonEmail, sendAuctionLostEmail } from "@/lib/email";
import { NextRequest, NextResponse } from "next/server";

// This endpoint is called by Vercel Cron to manage auction lifecycle
// It starts auctions when startTime arrives and ends auctions when endTime arrives

export async function GET(req: NextRequest) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Start DRAFT auctions whose startTime has passed
  const toStart = await prisma.auction.findMany({
    where: {
      status: "DRAFT",
      startTime: { lte: now },
    },
    include: { vehicle: true },
  });

  await Promise.all(
    toStart.map(async (auction) => {
      // Use optimistic lock to prevent double-start race condition
      try {
        await prisma.auction.update({
          where: { id: auction.id, status: "DRAFT" },
          data: { status: "LIVE" },
        });

        await pusher.trigger(`auction-${auction.id}`, "auction-started", {
          auctionId: auction.id,
          status: "LIVE",
        });
      } catch {
        // Status already changed by another process, skip
      }
    })
  );

  // End LIVE auctions whose endTime has passed
  const toEnd = await prisma.auction.findMany({
    where: {
      status: "LIVE",
      endTime: { lte: now },
    },
    include: {
      vehicle: true,
      bids: {
        orderBy: { amount: "desc" },
        take: 1,
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  for (const auction of toEnd) {
    const highestBid = auction.bids[0];
    let winnerId: string | null = null;
    let finalPrice = null;

    // Check if reserve price is met
    if (highestBid) {
      const reserveMet =
        !auction.reservePrice ||
        Number(highestBid.amount) >= Number(auction.reservePrice);

      if (reserveMet) {
        winnerId = highestBid.userId;
        finalPrice = highestBid.amount;
      }
    }

    // Use optimistic lock to prevent double-end race condition
    try {
      await prisma.auction.update({
        where: { id: auction.id, status: "LIVE" },
        data: {
          status: "ENDED",
          winnerId,
          finalPrice,
        },
      });
    } catch {
      // Status already changed by another process (manual end or concurrent cron), skip
      continue;
    }

    // Broadcast auction ended
    await pusher.trigger(`auction-${auction.id}`, "auction-ended", {
      auctionId: auction.id,
      status: "ENDED",
      winnerId,
      finalPrice: finalPrice ? Number(finalPrice) : null,
    });

    // Notify winner (DB + Pusher + email in parallel)
    if (winnerId && highestBid) {
      const wonMessage = `Vasa ponuda od ${finalPrice} ${auction.currency} je pobedila na aukciji za ${auction.vehicle.name}`;
      await Promise.all([
        prisma.notification.create({
          data: {
            userId: winnerId,
            type: "AUCTION_WON",
            title: "Cestitamo! Pobedili ste!",
            message: wonMessage,
            data: { auctionId: auction.id },
          },
        }),
        pusher.trigger(`private-user-${winnerId}`, "notification", {
          type: "AUCTION_WON",
          title: "Cestitamo! Pobedili ste!",
          message: wonMessage,
        }),
        sendAuctionWonEmail(
          highestBid.user.email,
          auction.vehicle.name,
          String(finalPrice),
          auction.currency
        ).catch(() => {}),
      ]);
    }

    // Notify losers (batch DB + parallel Pusher + emails)
    const losingBidders = await prisma.bid.findMany({
      where: {
        auctionId: auction.id,
        userId: winnerId ? { not: winnerId } : undefined,
      },
      select: { userId: true },
      distinct: ["userId"],
      // Need email for sending lost emails
    });

    if (losingBidders.length > 0) {
      const lostMessage = `Nazalost, niste pobedili na aukciji za ${auction.vehicle.name}`;

      await Promise.all([
        prisma.notification.createMany({
          data: losingBidders.map((bidder) => ({
            userId: bidder.userId,
            type: "AUCTION_LOST" as const,
            title: "Aukcija zavrsena",
            message: lostMessage,
            data: { auctionId: auction.id },
          })),
        }),
        ...losingBidders.map((bidder) =>
          pusher.trigger(`private-user-${bidder.userId}`, "notification", {
            type: "AUCTION_LOST",
            title: "Aukcija zavrsena",
            message: lostMessage,
          })
        ),
      ]);
    }
  }

  return NextResponse.json({
    started: toStart.length,
    ended: toEnd.length,
  });
}
