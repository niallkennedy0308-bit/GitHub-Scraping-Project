export type NumericComparator = ">" | ">=" | "<" | "<=" | "";

export type GitHubSearchBuilderState = {
  keywords: string;
  organization: string;
  fullname: string;
  location: string;
  language: string;
  reposComparator: NumericComparator;
  repos: string;
  followersComparator: NumericComparator;
  followers: string;
  createdComparator: NumericComparator;
  created: string;
  sponsorable: boolean;
  hireable: boolean;
};

export const EMPTY_SEARCH_BUILDER: GitHubSearchBuilderState = {
  keywords: "",
  organization: "",
  fullname: "",
  location: "",
  language: "",
  reposComparator: ">",
  repos: "",
  followersComparator: ">",
  followers: "",
  createdComparator: ">",
  created: "",
  sponsorable: false,
  hireable: false,
};

function quoteIfNeeded(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /\s/.test(trimmed) ? `"${trimmed.replaceAll('"', "")}"` : trimmed;
}

function numericQualifier(
  key: string,
  comparator: NumericComparator,
  value: string,
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return null;
  const op = comparator || "";
  return `${key}:${op}${trimmed}`;
}

function dateQualifier(
  comparator: NumericComparator,
  value: string,
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Accept YYYY-MM-DD from date inputs
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const op = comparator || "";
  return `created:${op}${trimmed}`;
}

/** Build a GitHub users search `q` string from structured fields. */
export function buildGitHubUserSearchQuery(state: GitHubSearchBuilderState): string {
  const parts: string[] = [];

  const keywords = state.keywords.trim();
  if (keywords) parts.push(keywords);

  if (state.organization.trim()) {
    parts.push(`org:${quoteIfNeeded(state.organization)}`);
  }
  if (state.fullname.trim()) {
    parts.push(`fullname:${quoteIfNeeded(state.fullname)}`);
  }
  if (state.location.trim()) {
    parts.push(`location:${quoteIfNeeded(state.location)}`);
  }
  if (state.language.trim()) {
    parts.push(`language:${quoteIfNeeded(state.language)}`);
  }

  const repos = numericQualifier("repos", state.reposComparator, state.repos);
  if (repos) parts.push(repos);

  const followers = numericQualifier(
    "followers",
    state.followersComparator,
    state.followers,
  );
  if (followers) parts.push(followers);

  const created = dateQualifier(state.createdComparator, state.created);
  if (created) parts.push(created);

  if (state.sponsorable) parts.push("sponsorable:true");
  if (state.hireable) parts.push("hireable:true");

  return parts.join(" ");
}

export function buildGitHubUserSearchUrl(state: GitHubSearchBuilderState): string {
  const q = buildGitHubUserSearchQuery(state);
  if (!q) return "";
  return `https://github.com/search?q=${encodeURIComponent(q)}&type=users`;
}

export function buildGitHubUserApiSearchUrl(state: GitHubSearchBuilderState): string {
  const q = buildGitHubUserSearchQuery(state);
  if (!q) return "";
  return `https://api.github.com/search/users?q=${encodeURIComponent(q)}`;
}

/**
 * Best-effort parse of an existing query back into builder fields.
 * Unknown tokens remain in keywords.
 */
export function parseGitHubUserSearchQuery(query: string): GitHubSearchBuilderState {
  const state: GitHubSearchBuilderState = { ...EMPTY_SEARCH_BUILDER };
  const tokens = tokenizeQuery(query.trim());
  const leftover: string[] = [];

  for (const token of tokens) {
    const match = token.match(
      /^(org|fullname|location|language|repos|followers|created|sponsorable|hireable):(.*)$/i,
    );
    if (!match) {
      leftover.push(token);
      continue;
    }

    const key = match[1].toLowerCase();
    let value = match[2];
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = value.slice(1, -1);
    }

    switch (key) {
      case "org":
        state.organization = value;
        break;
      case "fullname":
        state.fullname = value;
        break;
      case "location":
        state.location = value;
        break;
      case "language":
        state.language = value;
        break;
      case "repos": {
        const parsed = parseComparatorValue(value);
        state.reposComparator = parsed.comparator;
        state.repos = parsed.value;
        break;
      }
      case "followers": {
        const parsed = parseComparatorValue(value);
        state.followersComparator = parsed.comparator;
        state.followers = parsed.value;
        break;
      }
      case "created": {
        const parsed = parseComparatorValue(value);
        state.createdComparator = parsed.comparator;
        state.created = parsed.value;
        break;
      }
      case "sponsorable":
        state.sponsorable = value.toLowerCase() === "true";
        break;
      case "hireable":
        state.hireable = value.toLowerCase() === "true";
        break;
      default:
        leftover.push(token);
    }
  }

  state.keywords = leftover.join(" ");
  return state;
}

function parseComparatorValue(raw: string): {
  comparator: NumericComparator;
  value: string;
} {
  const m = raw.match(/^(>=|<=|>|<)?(.+)$/);
  if (!m) return { comparator: ">", value: raw };
  return {
    comparator: (m[1] as NumericComparator) || "",
    value: m[2],
  };
}

/** Split query preserving quoted segments. */
function tokenizeQuery(query: string): string[] {
  const tokens: string[] = [];
  const re = /"[^"]*"|[^\s]+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(query)) !== null) {
    tokens.push(match[0]);
  }
  return tokens;
}
