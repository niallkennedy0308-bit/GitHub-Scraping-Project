import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

function getKey() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "dev-secret";
  return scryptSync(secret, "github-pat-salt-v1", 32);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  if (buf.length < 28) {
    throw new Error("Invalid encrypted secret");
  }
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function maskToken(token: string): string {
  const trimmed = token.trim();
  if (trimmed.length <= 8) return "••••••••";
  // Keep a recognizable prefix so the UI can show classic vs fine-grained.
  const prefixLen = trimmed.startsWith("github_pat_")
    ? 11
    : trimmed.startsWith("ghp_") || trimmed.startsWith("gho_") || trimmed.startsWith("ghu_")
      ? 4
      : Math.min(7, trimmed.length - 4);
  return `${trimmed.slice(0, prefixLen)}…${trimmed.slice(-4)}`;
}
