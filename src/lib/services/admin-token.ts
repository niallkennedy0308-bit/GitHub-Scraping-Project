import { prisma } from "@/lib/db";
import { decryptSecret, maskToken } from "@/lib/token-crypto";

export async function getAdminGitHubToken(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { githubTokenEncrypted: true },
  });
  if (!user?.githubTokenEncrypted) return null;
  try {
    return decryptSecret(user.githubTokenEncrypted);
  } catch {
    return null;
  }
}

export async function getAdminTokenStatus(userId: string) {
  const token = await getAdminGitHubToken(userId);
  if (!token) {
    return {
      configured: false,
      maskedToken: null as string | null,
    };
  }
  return {
    configured: true,
    maskedToken: maskToken(token),
  };
}
