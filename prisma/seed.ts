import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@example.com").toLowerCase();
  const userEmail = (process.env.USER_EMAIL || "user@example.com").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const userPassword = process.env.USER_PASSWORD || "user123";

  const adminHash = await bcrypt.hash(adminPassword, 10);
  const userHash = await bcrypt.hash(userPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: Role.ADMIN, passwordHash: adminHash, name: "Admin" },
    create: {
      email: adminEmail,
      name: "Admin",
      role: Role.ADMIN,
      passwordHash: adminHash,
    },
  });

  await prisma.user.upsert({
    where: { email: userEmail },
    update: { role: Role.USER, passwordHash: userHash, name: "Regular User" },
    create: {
      email: userEmail,
      name: "Regular User",
      role: Role.USER,
      passwordHash: userHash,
    },
  });

  let ruleSet = await prisma.scamRuleSet.findFirst({ where: { name: "Default review rules" } });
  if (!ruleSet) {
    ruleSet = await prisma.scamRuleSet.create({
      data: {
        name: "Default review rules",
        description: "Flag low-signal profiles for manual review. Does not auto-confirm scam.",
        groupLogic: "OR",
        enabled: true,
        rules: {
          create: [
            {
              name: "Missing email",
              field: "email",
              operator: "is_empty",
              severity: "medium",
              action: "flag",
              scoreWeight: 10,
              description: "Public email is missing",
              enabled: true,
              sortOrder: 1,
            },
            {
              name: "Missing company",
              field: "company",
              operator: "is_empty",
              severity: "low",
              action: "flag",
              scoreWeight: 10,
              description: "Company is missing",
              enabled: true,
              sortOrder: 2,
            },
            {
              name: "Missing social links",
              field: "has_social_links",
              operator: "is_false",
              severity: "medium",
              action: "flag",
              scoreWeight: 10,
              description: "No social links found on profile",
              enabled: true,
              sortOrder: 3,
            },
          ],
        },
      },
    });
  }

  const existingConfig = await prisma.scrapingConfiguration.findFirst({
    where: { name: "Hireable fullstack sample" },
  });
  if (!existingConfig) {
    await prisma.scrapingConfiguration.create({
      data: {
        name: "Hireable fullstack sample",
        description: "Sample configuration using a GitHub users search query",
        githubSearchUrl: "https://github.com/search?q=fullstack+hireable%3Atrue&type=users",
        searchQuery: "fullstack hireable:true",
        enabled: true,
        ruleSetId: ruleSet.id,
        createdById: admin.id,
      },
    });
  }

  console.log("Seed complete");
  console.log(`Admin: ${adminEmail} / ${adminPassword}`);
  console.log(`User:  ${userEmail} / ${userPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
