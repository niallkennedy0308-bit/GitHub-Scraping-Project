import "dotenv/config";
import { fetchProfileReadme } from "../src/lib/github/client";
import { extractEmailFromText, extractLinkedInFromText } from "../src/lib/github/normalize";
import { PrismaClient } from "@prisma/client";
import { decryptSecret } from "../src/lib/token-crypto";

async function main() {
  const prisma = new PrismaClient();
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", githubTokenEncrypted: { not: null } },
    select: { githubTokenEncrypted: true },
  });
  const token = admin?.githubTokenEncrypted
    ? decryptSecret(admin.githubTokenEncrypted)
    : null;
  await prisma.$disconnect();

  const login = process.argv[2] || "imranolas";
  const md = await fetchProfileReadme(login, token);
  console.log(
    JSON.stringify(
      {
        login,
        hasReadme: Boolean(md),
        length: md?.length ?? 0,
        email: extractEmailFromText(md),
        linkedin: extractLinkedInFromText(md),
        preview: md?.slice(0, 220) ?? null,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
