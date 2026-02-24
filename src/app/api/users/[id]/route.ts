import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { audit, getClientIp } from "@/lib/audit";

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

  // Don't allow deactivating yourself
  if (body.status === "DEACTIVATED" && id === session.user.id) {
    return NextResponse.json({ error: "Ne mozete deaktivirati sami sebe" }, { status: 400 });
  }

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

    const ip = await getClientIp();
    audit({ action: "USER_STATUS_CHANGED", userId: session.user.id, targetId: id, metadata: { status: body.status }, ip });

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

  // Don't allow deleting other admins
  const targetUser = await prisma.user.findUnique({
    where: { id },
    select: { role: true },
  });
  if (!targetUser) {
    return NextResponse.json({ error: "Korisnik nije pronadjen" }, { status: 404 });
  }
  if (targetUser.role === "ADMIN") {
    return NextResponse.json({ error: "Ne mozete obrisati drugog administratora" }, { status: 400 });
  }

  // Delete all related data in a transaction to ensure consistency
  await prisma.$transaction(async (tx) => {
    await tx.notification.deleteMany({ where: { userId: id } });
    await tx.bid.deleteMany({ where: { userId: id } });

    // Remove winnerId references
    await tx.auction.updateMany({
      where: { winnerId: id },
      data: { winnerId: null, finalPrice: null },
    });

    // Delete auctions created by this user
    const userAuctions = await tx.auction.findMany({
      where: { createdById: id },
      select: { id: true },
    });
    if (userAuctions.length > 0) {
      const auctionIds = userAuctions.map((a) => a.id);
      await tx.bid.deleteMany({ where: { auctionId: { in: auctionIds } } });
      await tx.auction.deleteMany({ where: { createdById: id } });
    }

    // Delete vehicles created by this user
    await tx.vehicle.deleteMany({ where: { createdById: id } });

    // Nullify invitedById references
    await tx.user.updateMany({
      where: { invitedById: id },
      data: { invitedById: null },
    });

    await tx.user.delete({ where: { id } });
  });

  const ip = await getClientIp();
  audit({ action: "USER_DELETED", userId: session.user.id, targetId: id, ip });

  return NextResponse.json({ success: true });
}
