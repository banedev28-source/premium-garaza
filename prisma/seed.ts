import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

function createClient() {
  const url = process.env.DATABASE_URL!;
  if (url.startsWith("prisma+postgres://")) {
    return new PrismaClient({ accelerateUrl: url });
  }
  const adapter = new PrismaPg({ connectionString: url });
  return new PrismaClient({ adapter });
}

const prisma = createClient();

async function main() {
  // Create admin user
  const passwordHash = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@aukcija.rs" },
    update: {},
    create: {
      email: "admin@aukcija.rs",
      name: "Admin",
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  console.log("Created admin user:", admin.email);

  // Create a test buyer
  const buyerHash = await bcrypt.hash("buyer123", 12);

  const buyer = await prisma.user.upsert({
    where: { email: "kupac@aukcija.rs" },
    update: {},
    create: {
      email: "kupac@aukcija.rs",
      name: "Test Kupac",
      passwordHash: buyerHash,
      role: "BUYER",
      status: "ACTIVE",
      invitedById: admin.id,
    },
  });

  console.log("Created buyer user:", buyer.email);

  // Create a test vehicle
  const vehicle = await prisma.vehicle.upsert({
    where: { id: "test-vehicle-1" },
    update: {},
    create: {
      id: "test-vehicle-1",
      name: "BMW 530d xDrive 2020",
      description:
        "Odlicno stanje, servisna knjiga, garaziran. Full oprema sa M paketom.",
      specifications: {
        year: 2020,
        mileage: "85.000 km",
        fuel: "Dizel",
        transmission: "Automatik",
        engine: "3.0 TDI",
        power: "265 KS",
        color: "Crna metalik",
      },
      images: [
        "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800",
        "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800",
      ],
      createdById: admin.id,
    },
  });

  console.log("Created vehicle:", vehicle.name);

  // Create a test auction (DRAFT)
  const startTime = new Date();
  startTime.setHours(startTime.getHours() + 1);
  const endTime = new Date();
  endTime.setDate(endTime.getDate() + 1);

  await prisma.auction.upsert({
    where: { vehicleId: vehicle.id },
    update: {},
    create: {
      vehicleId: vehicle.id,
      createdById: admin.id,
      status: "DRAFT",
      auctionType: "OPEN",
      currency: "EUR",
      startTime,
      endTime,
      startingPrice: 15000,
      reservePrice: 20000,
      showReservePrice: false,
      showBidCount: true,
      buyNowEnabled: true,
      buyNowPrice: 35000,
    },
  });

  console.log("Created test auction");
  console.log("\n--- Login Credentials ---");
  console.log("Admin: admin@aukcija.rs / admin123");
  console.log("Buyer: kupac@aukcija.rs / buyer123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
