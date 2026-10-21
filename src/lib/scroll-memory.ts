const SCROLL_PREFIX = "admin-scroll:";
const USERS_LIST_KEY = "admin-users-list-state";
const USERS_RESTORE_FLAG = "admin-users-should-restore";
const DISCOVER_LIST_KEY = "portal-discover-list-state";
const DISCOVER_RESTORE_FLAG = "portal-discover-should-restore";

export type UsersListMemory = {
  q: string;
  location?: string;
  status: string;
  sort: string;
  order: "asc" | "desc";
  page: number;
  pageSize?: number;
  scrollY: number;
};

export type DiscoverViewMode = "table" | "cards";

export type DiscoverListMemory = {
  q: string;
  location: string;
  company: string;
  minFollowers: string;
  minRepos: string;
  hireable: string;
  sort: string;
  order: "asc" | "desc";
  page: number;
  pageSize: number;
  scrollY: number;
  lastUserId?: string | null;
  viewMode?: DiscoverViewMode;
};

export function saveScroll(
  pathname: string,
  y = typeof window !== "undefined" ? window.scrollY || window.pageYOffset || 0 : 0,
  options?: { force?: boolean },
) {
  try {
    const next = Math.max(0, Math.round(y));
    // Never overwrite a real saved position with 0 during route transitions.
    if (!options?.force && next <= 0) {
      const prev = readScroll(pathname);
      if (prev != null && prev > 0) return;
    }
    sessionStorage.setItem(SCROLL_PREFIX + pathname, String(next));
  } catch {
    // ignore
  }
}

export function readScroll(pathname: string): number | null {
  try {
    const raw = sessionStorage.getItem(SCROLL_PREFIX + pathname);
    if (raw == null) return null;
    const y = Number(raw);
    return Number.isFinite(y) && y >= 0 ? y : null;
  } catch {
    return null;
  }
}

export function restoreScroll(pathname: string): number | null {
  const fromKey = readScroll(pathname);
  const fromUsers =
    pathname === "/admin/users" ? readUsersListMemory()?.scrollY ?? null : null;
  const fromDiscover =
    pathname === "/portal/discover" ? readDiscoverListMemory()?.scrollY ?? null : null;
  const y = Math.max(fromKey ?? 0, fromUsers ?? 0, fromDiscover ?? 0);
  if (y <= 0) return null;
  window.scrollTo({ top: y, left: 0, behavior: "auto" });
  return y;
}

export function markUsersListRestorePending() {
  try {
    sessionStorage.setItem(USERS_RESTORE_FLAG, "1");
  } catch {
    // ignore
  }
}

export function consumeUsersListRestorePending(): boolean {
  try {
    const pending = sessionStorage.getItem(USERS_RESTORE_FLAG) === "1";
    if (pending) sessionStorage.removeItem(USERS_RESTORE_FLAG);
    return pending;
  } catch {
    return false;
  }
}

export function peekUsersListRestorePending(): boolean {
  try {
    return sessionStorage.getItem(USERS_RESTORE_FLAG) === "1";
  } catch {
    return false;
  }
}

export function saveUsersListMemory(state: UsersListMemory, options?: { forceScroll?: boolean }) {
  try {
    const prev = readUsersListMemory();
    const scrollY =
      !options?.forceScroll && state.scrollY <= 0 && prev && prev.scrollY > 0
        ? prev.scrollY
        : state.scrollY;

    const next: UsersListMemory = { ...state, scrollY };
    sessionStorage.setItem(USERS_LIST_KEY, JSON.stringify(next));
    saveScroll("/admin/users", scrollY, { force: options?.forceScroll });
  } catch {
    // ignore
  }
}

export function readUsersListMemory(): UsersListMemory | null {
  try {
    const raw = sessionStorage.getItem(USERS_LIST_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UsersListMemory;
  } catch {
    return null;
  }
}

export function markDiscoverListRestorePending() {
  try {
    sessionStorage.setItem(DISCOVER_RESTORE_FLAG, "1");
  } catch {
    // ignore
  }
}

export function consumeDiscoverListRestorePending(): boolean {
  try {
    const pending = sessionStorage.getItem(DISCOVER_RESTORE_FLAG) === "1";
    if (pending) sessionStorage.removeItem(DISCOVER_RESTORE_FLAG);
    return pending;
  } catch {
    return false;
  }
}

export function peekDiscoverListRestorePending(): boolean {
  try {
    return sessionStorage.getItem(DISCOVER_RESTORE_FLAG) === "1";
  } catch {
    return false;
  }
}

export function saveDiscoverListMemory(
  state: DiscoverListMemory,
  options?: { forceScroll?: boolean },
) {
  try {
    const prev = readDiscoverListMemory();
    const scrollY =
      !options?.forceScroll && state.scrollY <= 0 && prev && prev.scrollY > 0
        ? prev.scrollY
        : state.scrollY;
    const lastUserId =
      state.lastUserId !== undefined ? state.lastUserId : prev?.lastUserId ?? null;

    const next: DiscoverListMemory = { ...state, scrollY, lastUserId };
    sessionStorage.setItem(DISCOVER_LIST_KEY, JSON.stringify(next));
    saveScroll("/portal/discover", scrollY, { force: options?.forceScroll });
  } catch {
    // ignore
  }
}

export function readDiscoverListMemory(): DiscoverListMemory | null {
  try {
    const raw = sessionStorage.getItem(DISCOVER_LIST_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DiscoverListMemory;
  } catch {
    return null;
  }
}
