# GitHub User Scraping & Validation — Admin

Phase 1 admin dashboard for configuring GitHub user searches, scam-detection rules, background scraping jobs, duplicate-safe persistence, and manual review.

## Stack

- **Next.js 16** (App Router) + TypeScript
- **Prisma** + **SQLite** (local; swap `DATABASE_URL` for PostgreSQL in production)
- **Auth.js (NextAuth v5)** credentials + `ADMIN` / `USER` roles
- **DB-polled worker** (`npm run worker`) for background scraping (no Redis required)
- **Zod** validation, **Vitest** unit tests

## Quick start

```bash
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

In a second terminal:

```bash
npm run worker
```

Open [http://localhost:3000](http://localhost:3000).

### Seeded accounts

| Role  | Email              | Password  |
|-------|--------------------|-----------|
| Admin | admin@example.com  | admin123  |
| User  | user@example.com   | user123   |

Regular users receive **403** on `/admin` and `/api/admin/*`.

## Environment

Copy `.env.example` to `.env`:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Prisma DB URL (`file:./dev.db` for SQLite) |
| `AUTH_SECRET` | NextAuth secret |
| `NEXTAUTH_URL` | App URL |
| `GITHUB_TOKEN` | Optional fallback only — prefer per-admin tokens in **Settings** |
| `SCRAPER_MAX_PAGES` | Max search pages per job (default 10) |
| `SCRAPER_PAGE_SIZE` | Results per page (default 30) |

Never commit real tokens. The frontend never receives `GITHUB_TOKEN`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js dev server |
| `npm run worker` | Background scraping worker |
| `npm run db:seed` | Seed admin/user + sample rules/config |
| `npm test` | Unit tests (rules + URL validation) |
| `npm run lint` | ESLint |
| `npm run build` | Production build |

## Admin areas

1. **Overview** — unique user and job metrics  
2. **Scraping Configurations** — CRUD, URL validation (SSRF-safe), start jobs  
3. **Scam Detection Rules** — dynamic typed rules, AND/OR groups, sample testing  
4. **Scraping Jobs** — queue/run/cancel + live counters  
5. **GitHub Users** — search, filter, sort, paginate, bulk actions  
6. **Scam Review** — manual decisions with history  
7. **Scraping History** — terminal job summaries + completion toasts  

## Design notes

- GitHub **numeric `id`** is the unique identity key (login can change).
- Flagged ≠ confirmed scam. Only **exclusion** rules auto-reject.
- Manual review decisions are preserved on re-scrape.
- Soft delete archives users (`deletedAt`) instead of hard delete.
- Scraping uses the official GitHub Search/Users API with pagination, retries, and rate-limit backoff.

## Tests

```bash
npm test
```

Covers string/numeric/boolean/date operators, AND/OR groups, disabled rules, exclusion vs flag behavior, and GitHub URL SSRF guards.
