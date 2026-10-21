/**
 * Re-extract email/LinkedIn from stored profileReadme for users missing them.
 * Usage: npx tsx scripts/backfill-readme-contacts.ts [login]
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { extractEmailFromText, extractLinkedInFromText } from "../src/lib/github/normalize";

const prisma = new PrismaClient();

async function main() {
  const onlyLogin = process.argv[2]?.trim();
  const users = await prisma.gitHubUser.findMany({
    where: {
      profileReadme: { not: null },
      ...(onlyLogin ? { login: onlyLogin } : {}),
      OR: [{ linkedinUrl: null }, { linkedinUrl: "" }, { email: null }, { email: "" }],
    },
    select: { id: true, login: true, email: true, linkedinUrl: true, profileReadme: true },
  });

  let updated = 0;
  for (const user of users) {
    const readme = user.profileReadme || "";
    const email = user.email?.trim() || extractEmailFromText(readme);
    const linkedinUrl = user.linkedinUrl?.trim() || extractLinkedInFromText(readme);
    if (email === user.email && linkedinUrl === user.linkedinUrl) {
      console.log(`  @${user.login}: no new contacts`);
      continue;
    }
    await prisma.gitHubUser.update({
      where: { id: user.id },
      data: {
        email: email || null,
        linkedinUrl: linkedinUrl || null,
      },
    });
    updated += 1;
    console.log(`  @${user.login}: email=${email || "—"} linkedin=${linkedinUrl || "—"}`);
  }
  console.log(`Updated ${updated}/${users.length} user(s).`);
}

main().finally(async () => {
  await prisma.$disconnect();
});
