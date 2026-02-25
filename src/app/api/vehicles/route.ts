import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { vehicleSchema } from "@/lib/validations";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vehicles = await prisma.vehicle.findMany({
    include: {
      auction: {
        select: { id: true, status: true },
      },
      createdBy: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(vehicles);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = vehicleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      ...parsed.data,
      createdById: session.user.id,
    },
  });

  return NextResponse.json(vehicle, { status: 201 });
}
