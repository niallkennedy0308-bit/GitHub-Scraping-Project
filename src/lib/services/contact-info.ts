import { z } from "zod";

const emailSchema = z.string().trim().email().max(320);
const linkedinSchema = z
  .string()
  .trim()
  .max(500)
  .refine((value) => {
    try {
      const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
      const url = new URL(withProtocol);
      const host = url.hostname.replace(/^www\./, "").toLowerCase();
      if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) return false;
      return /\/in\/|\/company\/|\/pub\//i.test(url.pathname);
    } catch {
      return false;
    }
  }, "Enter a valid LinkedIn profile URL");

export function normalizeEmailInput(value: string): string {
  return emailSchema.parse(value).toLowerCase();
}

export function normalizeLinkedInInput(value: string): string {
  const parsed = linkedinSchema.parse(value);
  return /^https?:\/\//i.test(parsed) ? parsed : `https://${parsed}`;
}

export function isBlank(value: string | null | undefined): boolean {
  return !value || !String(value).trim();
}
