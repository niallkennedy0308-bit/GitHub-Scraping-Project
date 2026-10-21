import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { decryptSecret } from "../src/lib/token-crypto";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { githubTokenEncrypted: true },
  });
  if (!admin?.githubTokenEncrypted) {
    console.log("No token");
    return;
  }
  const token = decryptSecret(admin.githubTokenEncrypted);
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "github-scraping-admin",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  const text = await response.text();
  console.log(
    JSON.stringify(
      {
        status: response.status,
        body: text.slice(0, 800),
      },
      null,
      2,
    ),
  );
}

main().finally(async () => {
  await prisma.$disconnect();
});
