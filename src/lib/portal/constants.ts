export const SCAM_REPORT_REASONS = [
  "Suspected fraudulent identity",
  "Suspicious or misleading profile information",
  "Suspicious links or website",
  "Suspected impersonation",
  "Other",
] as const;

export type ScamReportReason = (typeof SCAM_REPORT_REASONS)[number];

export const USER_REPORT_REASON = "User report";
export const USER_REPORT_DESCRIPTION =
  "Reported from the user portal. An administrator will verify this profile.";

export function reportStatusLabel(status: string) {
  if (status === "pending") return "Awaiting review";
  if (status === "under_review") return "Under review";
  if (status === "resolved") return "Confirmed";
  if (status === "dismissed") return "Not confirmed";
  return status;
}

/** Profiles regular users may discover / newly save as contacts. */
export const PORTAL_VISIBLE_STATUSES = ["pending", "legitimate", "suspicious"] as const;
