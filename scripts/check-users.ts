import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.user.findMany({
    select: { email: true, status: true, name: true, passwordHash: true },
  });
  for (const u of users) {
    console.log(
      u.email,
      "| status:", u.status,
      "| name:", u.name,
      "| hasPassword:", !!u.passwordHash
    );
  }
  await prisma.$disconnect();
}

main();
