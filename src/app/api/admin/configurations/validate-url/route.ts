import { NextResponse } from "next/server";
import { jsonError, requireAdmin } from "@/lib/auth-guards";
import { validateAndParseGitHubSearch } from "@/lib/github-url";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const parsed = validateAndParseGitHubSearch(String(body.url || ""));
    return NextResponse.json({ valid: true, ...parsed });
  } catch (error) {
    return jsonError(error);
  }
}
