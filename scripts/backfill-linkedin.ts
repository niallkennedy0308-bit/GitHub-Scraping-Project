/**
 * One-shot: refresh linkedinUrl for users missing it via GitHub social_accounts.
 * Usage: npx tsx scripts/backfill-linkedin.ts [login]
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { decryptSecret } from "../src/lib/token-crypto";
import { fetchUserSocialAccounts } from "../src/lib/github/client";
import { extractLinkedInUrl } from "../src/lib/github/normalize";

const prisma = new PrismaClient();

async function main() {
  const onlyLogin = process.argv[2]?.trim();
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", githubTokenEncrypted: { not: null } },
    select: { githubTokenEncrypted: true },
  });
  const token = admin?.githubTokenEncrypted
    ? decryptSecret(admin.githubTokenEncrypted)
    : process.env.GITHUB_TOKEN?.trim() || null;

  const users = await prisma.gitHubUser.findMany({
    where: {
      OR: [{ linkedinUrl: null }, { linkedinUrl: "" }],
      ...(onlyLogin ? { login: onlyLogin } : {}),
    },
    select: { id: true, login: true, blog: true, bio: true, company: true },
    take: onlyLogin ? 1 : 200,
    orderBy: { lastScrapedAt: "desc" },
  });

  console.log(`Checking ${users.length} user(s)…`);
  let updated = 0;

  for (const user of users) {
    try {
      const socialAccounts = await fetchUserSocialAccounts(user.login, token);
      const linkedinUrl = extractLinkedInUrl(
        {
          login: user.login,
          id: 0,
          blog: user.blog,
          bio: user.bio,
          company: user.company,
        },
        socialAccounts,
      );
      if (!linkedinUrl) {
        console.log(`  @${user.login}: no LinkedIn`);
        continue;
      }
      await prisma.gitHubUser.update({
        where: { id: user.id },
        data: { linkedinUrl },
      });
      updated += 1;
      console.log(`  @${user.login}: ${linkedinUrl}`);
    } catch (error) {
      console.log(
        `  @${user.login}: error`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  console.log(`Updated ${updated} user(s).`);
}

main().finally(async () => {
  await prisma.$disconnect();
});
