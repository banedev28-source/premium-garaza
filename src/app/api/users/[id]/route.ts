import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

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

  // Only allow toggling status
  if (body.status && ["ACTIVE", "DEACTIVATED"].includes(body.status)) {
    const user = await prisma.user.update({
      where: { id },
      data: { status: body.status },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
      },
    });
    return NextResponse.json(user);
  }

  return NextResponse.json({ error: "Invalid update" }, { status: 400 });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Don't allow deleting yourself
  if (id === session.user.id) {
    return NextResponse.json({ error: "Ne mozete obrisati sami sebe" }, { status: 400 });
  }

  // Delete all related data in correct order to avoid FK violations
  await prisma.notification.deleteMany({ where: { userId: id } });
  await prisma.bid.deleteMany({ where: { userId: id } });

  // Remove winnerId references
  await prisma.auction.updateMany({
    where: { winnerId: id },
    data: { winnerId: null, finalPrice: null },
  });

  // Delete auctions created by this user (bids already cleaned above or cascade)
  const userAuctions = await prisma.auction.findMany({
    where: { createdById: id },
    select: { id: true },
  });
  if (userAuctions.length > 0) {
    const auctionIds = userAuctions.map((a) => a.id);
    await prisma.bid.deleteMany({ where: { auctionId: { in: auctionIds } } });
    await prisma.auction.deleteMany({ where: { createdById: id } });
  }

  // Delete vehicles created by this user
  await prisma.vehicle.deleteMany({ where: { createdById: id } });

  // Nullify invitedById references
  await prisma.user.updateMany({
    where: { invitedById: id },
    data: { invitedById: null },
  });

  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
