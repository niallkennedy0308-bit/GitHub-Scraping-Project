import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { decryptSecret } from "../src/lib/token-crypto";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true, email: true, githubTokenEncrypted: true },
  });

  console.log(
    JSON.stringify(
      {
        adminEmail: admin?.email ?? null,
        hasEncryptedToken: Boolean(admin?.githubTokenEncrypted),
        envGithubTokenSet: Boolean(process.env.GITHUB_TOKEN?.trim()),
        authSecretSet: Boolean(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET),
      },
      null,
      2,
    ),
  );

  if (!admin?.githubTokenEncrypted) {
    console.log("No encrypted admin token in DB. Save one in Admin → Settings.");
    return;
  }

  let token: string;
  try {
    token = decryptSecret(admin.githubTokenEncrypted);
  } catch (error) {
    console.log(
      "Decrypt failed — AUTH_SECRET may have changed since the token was saved.",
      error instanceof Error ? error.message : error,
    );
    return;
  }

  console.log(
    JSON.stringify(
      {
        decryptOk: true,
        tokenLength: token.length,
        tokenPrefix: token.slice(0, 7),
      },
      null,
      2,
    ),
  );

  const response = await fetch("https://api.github.com/rate_limit", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "github-scraping-admin",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  const body = (await response.json()) as {
    resources?: {
      core?: { limit?: number; remaining?: number; reset?: number; used?: number };
      search?: { limit?: number; remaining?: number; reset?: number; used?: number };
    };
    message?: string;
  };

  console.log(
    JSON.stringify(
      {
        httpStatus: response.status,
        core: body.resources?.core ?? null,
        search: body.resources?.search ?? null,
        message: body.message ?? null,
        interpretation:
          (body.resources?.core?.limit ?? 0) <= 60
            ? "UNAUTHENTICATED or token not accepted (limit ~60/hour)"
            : "Authenticated token accepted (core limit should be ~5000/hour)",
      },
      null,
      2,
    ),
  );
}

main().finally(async () => {
  await prisma.$disconnect();
});
