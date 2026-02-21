import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomBytes } from "crypto";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.log("Usage: npx tsx scripts/reset-invite.ts <email>");
    process.exit(1);
  }

  const token = randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + 48 * 60 * 60 * 1000);

  await prisma.user.update({
    where: { email },
    data: {
      status: "PENDING",
      passwordHash: null,
      inviteToken: token,
      inviteTokenExpiry: expiry,
    },
  });

  console.log(`Reset ${email} to PENDING`);
  console.log(`Invite link: http://localhost:3000/invite/${token}`);
  await prisma.$disconnect();
}

main();
