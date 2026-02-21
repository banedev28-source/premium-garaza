import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusher } from "@/lib/pusher-server";
import { NextRequest, NextResponse } from "next/server";
import { bidSchema } from "@/lib/validations";
import { Prisma } from "@/generated/prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "BUYER") {
    return NextResponse.json({ error: "Samo kupci mogu licitirati" }, { status: 403 });
  }

  const { id: auctionId } = await params;
  const body = await req.json();
  const parsed = bidSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { amount } = parsed.data;

  try {
    // Use a transaction with serializable isolation for race condition prevention
    const result = await prisma.$transaction(
      async (tx) => {
        // Get auction with lock
        const auction = await tx.auction.findUnique({
          where: { id: auctionId },
          include: {
            vehicle: { select: { name: true } },
          },
        });

        if (!auction) {
          throw new Error("Aukcija nije pronadjena");
        }

        if (auction.status !== "LIVE") {
          throw new Error("Aukcija nije aktivna");
        }

        if (new Date() > auction.endTime) {
          throw new Error("Aukcija je istekla");
        }

        // Check starting price
        if (auction.startingPrice && amount < Number(auction.startingPrice)) {
          throw new Error(`Minimalna ponuda je ${auction.startingPrice} ${auction.currency}`);
        }

        // Get current highest bid
        const highestBid = await tx.bid.findFirst({
          where: { auctionId },
          orderBy: { amount: "desc" },
        });

        // For non-sealed auctions, new bid must be higher than current highest
        if (auction.auctionType !== "SEALED" && highestBid) {
          if (amount <= Number(highestBid.amount)) {
            throw new Error(
              `Ponuda mora biti veca od trenutne najvece: ${highestBid.amount} ${auction.currency}`
            );
          }
        }

        // Create the bid
        const bid = await tx.bid.create({
          data: {
            auctionId,
            userId: session.user.id,
            amount: new Prisma.Decimal(amount),
          },
          include: {
            user: { select: { id: true, name: true } },
          },
        });

        // Get updated bid count
        const bidCount = await tx.bid.count({ where: { auctionId } });

        return { bid, auction, highestBid, bidCount };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    const { bid, auction, bidCount } = result;

    // Broadcast via Pusher based on auction type
    const channelName = `auction-${auctionId}`;
    const bidPlacedPayload = {
      auctionId,
      amount,
      timestamp: bid.createdAt.toISOString(),
    };

    switch (auction.auctionType) {
      case "SEALED":
        // No broadcast - sealed bid auction. Only notify the bidder privately
        await pusher.trigger(`private-user-${session.user.id}`, "bid-placed", bidPlacedPayload);
        break;

      case "OPEN":
        // Broadcast highest bid with bidder info + private bid-placed in parallel
        await Promise.all([
          pusher.trigger(channelName, "new-bid", {
            auctionId,
            highestBid: amount,
            bidCount,
            bidderId: bid.user.id,
            bidderName: bid.user.name,
            timestamp: bid.createdAt.toISOString(),
          }),
          pusher.trigger(`private-user-${session.user.id}`, "bid-placed", bidPlacedPayload),
        ]);
        break;

      case "INDICATOR": {
        // Get all unique bidders + actual highest bid after transaction
        const [bidders, currentHighest] = await Promise.all([
          prisma.bid.findMany({
            where: { auctionId },
            select: { userId: true },
            distinct: ["userId"],
          }),
          prisma.bid.findFirst({
            where: { auctionId },
            orderBy: { amount: "desc" },
          }),
        ]);

        // Send private indicator to each bidder + bid-placed in parallel
        await Promise.all([
          ...bidders.map((bidder) =>
            pusher.trigger(
              `private-user-${bidder.userId}`,
              "bid-indicator",
              {
                auctionId,
                isHighest: currentHighest?.userId === bidder.userId,
                highestBid: Number(currentHighest?.amount),
                bidCount: auction.showBidCount ? bidCount : undefined,
              }
            )
          ),
          pusher.trigger(`private-user-${session.user.id}`, "bid-placed", bidPlacedPayload),
        ]);
        break;
      }

      case "ANONYMOUS":
        // Broadcast highest bid without identity + private indicator + bid-placed in parallel
        await Promise.all([
          pusher.trigger(channelName, "new-bid", {
            auctionId,
            highestBid: amount,
            bidCount,
            timestamp: bid.createdAt.toISOString(),
          }),
          pusher.trigger(`private-user-${session.user.id}`, "bid-indicator", {
            auctionId,
            isHighest: true,
          }),
          pusher.trigger(`private-user-${session.user.id}`, "bid-placed", bidPlacedPayload),
        ]);
        break;
    }

    // Outbid notifications - skip for SEALED auctions
    if (auction.auctionType !== "SEALED") {
      // Get the two highest bids to find previous leader
      const topBids = await prisma.bid.findMany({
        where: { auctionId },
        orderBy: { amount: "desc" },
        take: 2,
        include: { user: { select: { id: true, email: true } } },
      });

      const previousHighest = topBids.length >= 2 ? topBids[1] : null;

      // Only notify if previous highest was a DIFFERENT user
      if (previousHighest && previousHighest.userId !== session.user.id) {
        await Promise.all([
          prisma.notification.create({
            data: {
              userId: previousHighest.userId,
              type: "OUTBID",
              title: "Pretekli su vas!",
              message: `Neko je dao vecu ponudu na aukciji za ${auction.vehicle.name}`,
              data: { auctionId, amount },
            },
          }),
          pusher.trigger(
            `private-user-${previousHighest.userId}`,
            "notification",
            {
              type: "OUTBID",
              title: "Pretekli su vas!",
              message: `Neko je dao vecu ponudu na aukciji za ${auction.vehicle.name}`,
            }
          ),
        ]);
      }
    }

    // Notify all admins about the new bid (batch create + parallel Pusher)
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", status: "ACTIVE" },
      select: { id: true },
    });

    if (admins.length > 0) {
      const adminMessage = `${bid.user.name} je ponudio ${amount} ${auction.currency} za ${auction.vehicle.name}`;

      await Promise.all([
        prisma.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            type: "AUCTION_START" as const,
            title: "Nova ponuda",
            message: adminMessage,
            data: { auctionId, amount },
          })),
        }),
        ...admins.map((admin) =>
          pusher.trigger(`private-user-${admin.id}`, "notification", {
            type: "AUCTION_START",
            title: "Nova ponuda",
            message: adminMessage,
          })
        ),
      ]);
    }

    return NextResponse.json({
      success: true,
      bid: {
        id: bid.id,
        amount: Number(bid.amount),
        createdAt: bid.createdAt.toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Greska pri licitiranju";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
