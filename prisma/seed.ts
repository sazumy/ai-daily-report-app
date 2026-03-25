import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  await prisma.user.upsert({
    where: { email: "taro@example.com" },
    update: {},
    create: {
      name: "山田 太郎",
      email: "taro@example.com",
      passwordHash,
      role: "salesperson",
    },
  });

  await prisma.user.upsert({
    where: { email: "sato@example.com" },
    update: {},
    create: {
      name: "佐藤 部長",
      email: "sato@example.com",
      passwordHash,
      role: "manager",
    },
  });

  const customerA = await prisma.customer.findFirst({
    where: { name: "鈴木 一郎", companyName: "株式会社ABC" },
  });
  if (!customerA) {
    await prisma.customer.create({
      data: { name: "鈴木 一郎", companyName: "株式会社ABC" },
    });
  }

  const customerB = await prisma.customer.findFirst({
    where: { name: "田中 花子", companyName: "有限会社XYZ" },
  });
  if (!customerB) {
    await prisma.customer.create({
      data: { name: "田中 花子", companyName: "有限会社XYZ" },
    });
  }

  console.log("Seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
