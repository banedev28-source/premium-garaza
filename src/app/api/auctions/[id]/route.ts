import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusher } from "@/lib/pusher-server";
import { NextRequest, NextResponse } from "next/server";
import { audit, getClientIp } from "@/lib/audit";
import { sendNewAuctionEmail } from "@/lib/email";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const auction = await prisma.auction.findUnique({
    where: { id },
    include: {
      vehicle: true,
      createdBy: { select: { id: true, name: true, email: true } },
      winner: { select: { id: true, name: true } },
      _count: { select: { bids: true } },
      bids: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { amount: "desc" as const },
      },
    },
  });

  if (!auction) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Admin sees everything without restrictions
  if (session.user.role === "ADMIN") {
    return NextResponse.json({
      ...auction,
      highestBidAmount: null,
      userIsHighest: null,
    });
  }

  // ── BUYER logic ──────────────────────────────────────────────────
  const userHasBid = await prisma.bid.findFirst({
    where: { auctionId: id, userId: session.user.id },
    select: { id: true },
  });
  const userParticipated = !!userHasBid;

  // If auction is ended and user didn't participate, hide bid data
  if (auction.status === "ENDED" && !userParticipated) {
    return NextResponse.json({
      ...auction,
      bids: [],
      winner: null,
      winnerId: null,
      finalPrice: null,
      highestBidAmount: null,
      userIsHighest: null,
      userParticipated: false,
    });
  }

  // Get the overall highest bid
  const highestBid = await prisma.bid.findFirst({
    where: { auctionId: id },
    orderBy: { amount: "desc" },
    select: { amount: true, userId: true },
  });

  let highestBidAmount: number | null = null;
  let userIsHighest: boolean | null = null;

  if (highestBid) {
    highestBidAmount = Number(highestBid.amount);
    if (userHasBid) {
      userIsHighest = highestBid.userId === session.user.id;
    }
  }

  const isEnded = auction.status === "ENDED";

  // SEALED: while LIVE, only own bids and no highest info; after ENDED, reveal all
  if (auction.auctionType === "SEALED" && !isEnded) {
    return NextResponse.json({
      ...auction,
      bids: auction.bids.filter((b) => b.userId === session.user.id),
      highestBidAmount: null,
      userIsHighest: null,
    });
  }

  // INDICATOR: while LIVE, only own bids + indicator; after ENDED, reveal all
  if (auction.auctionType === "INDICATOR" && !isEnded) {
    return NextResponse.json({
      ...auction,
      bids: auction.bids.filter((b) => b.userId === session.user.id),
      highestBidAmount,
      userIsHighest,
    });
  }

  // ANONYMOUS: while LIVE, hide bidder identities; after ENDED, reveal all
  if (auction.auctionType === "ANONYMOUS" && !isEnded) {
    return NextResponse.json({
      ...auction,
      bids: auction.bids.map((b) => ({
        ...b,
        userId: b.userId === session.user.id ? b.userId : "other",
        user: b.userId === session.user.id
          ? (b as Record<string, unknown>).user
          : { id: "other", name: "—" },
      })),
      highestBidAmount,
      userIsHighest,
    });
  }

  // OPEN or any ENDED auction for participants: full transparency
  return NextResponse.json({
    ...auction,
    highestBidAmount,
    userIsHighest,
    userParticipated,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  // Status change
  if (body.status) {
    const auction = await prisma.auction.findUnique({ where: { id } });
    if (!auction) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Validate status transitions (ARCHIVED is terminal - no transitions out)
    const validTransitions: Record<string, string[]> = {
      DRAFT: ["LIVE", "CANCELLED"],
      LIVE: ["ENDED", "CANCELLED"],
      ENDED: ["ARCHIVED"],
      CANCELLED: ["ARCHIVED"],
    };

    if (!validTransitions[auction.status]?.includes(body.status)) {
      return NextResponse.json(
        { error: `Nije moguce promeniti status iz ${auction.status} u ${body.status}` },
        { status: 400 }
      );
    }

    // If ending an auction, determine winner and send notifications
    if (body.status === "ENDED") {
      const highestBid = await prisma.bid.findFirst({
        where: { auctionId: id },
        orderBy: { amount: "desc" },
        include: { user: { select: { id: true, name: true, email: true } } },
      });

      let winnerId: string | null = null;
      let finalPrice = null;

      if (highestBid) {
        const reserveMet =
          !auction.reservePrice ||
          Number(highestBid.amount) >= Number(auction.reservePrice);

        if (reserveMet) {
          winnerId = highestBid.userId;
          finalPrice = highestBid.amount;
        }
      }

      // Use optimistic locking: only update if status hasn't changed
      let updated;
      try {
        updated = await prisma.auction.update({
          where: { id, status: auction.status },
          data: { status: "ENDED", winnerId, finalPrice },
          include: { vehicle: true },
        });
      } catch {
        return NextResponse.json({ error: "Status aukcije je vec promenjen" }, { status: 409 });
      }

      // Broadcast + notifications in parallel
      const notifications: Promise<unknown>[] = [
        pusher.trigger(`auction-${id}`, "auction-ended", {
          auctionId: id,
          status: "ENDED",
          winnerId,
          finalPrice: finalPrice ? Number(finalPrice) : null,
        }),
      ];

      if (winnerId) {
        notifications.push(
          prisma.notification.create({
            data: {
              userId: winnerId,
              type: "AUCTION_WON",
              title: "Cestitamo! Pobedili ste!",
              message: `Vasa ponuda od ${finalPrice} ${auction.currency} je pobedila na aukciji za ${updated.vehicle.name}`,
              data: { auctionId: id },
            },
          }),
          pusher.trigger(`private-user-${winnerId}`, "notification", {
            type: "AUCTION_WON",
            title: "Cestitamo! Pobedili ste!",
            message: `Vasa ponuda od ${finalPrice} ${auction.currency} je pobedila na aukciji za ${updated.vehicle.name}`,
          }),
        );
      }

      await Promise.all(notifications);

      const ip = await getClientIp();
      audit({ action: "AUCTION_STATUS_CHANGED", userId: session.user.id, targetId: id, metadata: { from: auction.status, to: "ENDED", winnerId }, ip });

      // Notify losers
      const losingBidders = await prisma.bid.findMany({
        where: {
          auctionId: id,
          userId: winnerId ? { not: winnerId } : undefined,
        },
        select: { userId: true },
        distinct: ["userId"],
      });

      if (losingBidders.length > 0) {
        await prisma.notification.createMany({
          data: losingBidders.map((bidder) => ({
            userId: bidder.userId,
            type: "AUCTION_LOST" as const,
            title: "Aukcija zavrsena",
            message: `Nazalost, niste pobedili na aukciji za ${updated.vehicle.name}`,
            data: { auctionId: id },
          })),
        });

        await Promise.all(
          losingBidders.map((bidder) =>
            pusher.trigger(`private-user-${bidder.userId}`, "notification", {
              type: "AUCTION_LOST",
              title: "Aukcija zavrsena",
              message: `Nazalost, niste pobedili na aukciji za ${updated.vehicle.name}`,
            })
          )
        );
      }

      return NextResponse.json(updated);
    }

    // For other status changes (LIVE, CANCELLED, ARCHIVED)
    // Use optimistic locking: only update if status hasn't changed
    let updated;
    try {
      updated = await prisma.auction.update({
        where: { id, status: auction.status },
        data: { status: body.status as "LIVE" | "CANCELLED" | "ARCHIVED" },
        include: { vehicle: true },
      });
    } catch {
      return NextResponse.json({ error: "Status aukcije je vec promenjen" }, { status: 409 });
    }

    {
      const ip = await getClientIp();
      audit({ action: "AUCTION_STATUS_CHANGED", userId: session.user.id, targetId: id, metadata: { from: auction.status, to: body.status }, ip });
    }

    // Broadcast status change via Pusher
    if (body.status === "LIVE") {
      await pusher.trigger(`auction-${id}`, "auction-started", {
        auctionId: id,
        status: "LIVE",
      });

      // Notify all active buyers about new auction
      sendNewAuctionEmail(
        updated.vehicle.name,
        id,
        updated.endTime,
        updated.currency,
        updated.startingPrice ? String(updated.startingPrice) : null
      ).catch(() => {});
    }

    return NextResponse.json(updated);
  }

  // General update (only for DRAFT auctions)
  const auction = await prisma.auction.findUnique({ where: { id } });
  if (!auction || auction.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Samo nacrt aukcije moze biti izmenjena" },
      { status: 400 }
    );
  }

  // Only allow safe, known fields to be updated
  const data: Record<string, unknown> = {
    ...(body.startTime != null && { startTime: new Date(body.startTime) }),
    ...(body.endTime != null && { endTime: new Date(body.endTime) }),
    ...(body.currency != null && ["RSD", "EUR"].includes(body.currency) && { currency: body.currency }),
    ...(body.startingPrice !== undefined && { startingPrice: body.startingPrice }),
    ...(body.reservePrice !== undefined && { reservePrice: body.reservePrice }),
    ...(typeof body.showReservePrice === "boolean" && { showReservePrice: body.showReservePrice }),
    ...(body.auctionType != null && ["SEALED", "OPEN", "INDICATOR", "ANONYMOUS"].includes(body.auctionType) && { auctionType: body.auctionType }),
    ...(typeof body.showBidCount === "boolean" && { showBidCount: body.showBidCount }),
    ...(typeof body.buyNowEnabled === "boolean" && { buyNowEnabled: body.buyNowEnabled }),
    ...(body.buyNowPrice !== undefined && { buyNowPrice: body.buyNowPrice }),
  };

  // Validate time relationship after merge with existing values
  const effectiveStart = data.startTime ? new Date(data.startTime as string) : auction.startTime;
  const effectiveEnd = data.endTime ? new Date(data.endTime as string) : auction.endTime;
  if (effectiveEnd <= effectiveStart) {
    return NextResponse.json(
      { error: "Vreme zavrsetka mora biti posle vremena pocetka" },
      { status: 400 }
    );
  }

  // Validate buyNowPrice >= startingPrice after merge
  const effectiveBuyNow = data.buyNowPrice !== undefined ? data.buyNowPrice as number : Number(auction.buyNowPrice);
  const effectiveStarting = data.startingPrice !== undefined ? data.startingPrice as number : Number(auction.startingPrice);
  if (effectiveBuyNow && effectiveStarting && effectiveBuyNow < effectiveStarting) {
    return NextResponse.json(
      { error: "Buy Now cena mora biti veca ili jednaka pocetnoj ceni" },
      { status: 400 }
    );
  }

  const updated = await prisma.auction.update({
    where: { id },
    data,
    include: { vehicle: true },
  });

  return NextResponse.json(updated);
}
