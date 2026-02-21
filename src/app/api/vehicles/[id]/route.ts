import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { vehicleSchema } from "@/lib/validations";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      auction: true,
      createdBy: { select: { name: true } },
    },
  });

  if (!vehicle) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(vehicle);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = vehicleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const vehicle = await prisma.vehicle.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json(vehicle);
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

  // Check if vehicle has an auction
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: { auction: true },
  });

  if (vehicle?.auction) {
    return NextResponse.json(
      { error: "Vozilo ima aktivnu aukciju i ne moze biti obrisano" },
      { status: 400 }
    );
  }

  await prisma.vehicle.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
