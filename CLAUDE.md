# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"จดเงิน" is a single-user income and expense tracker. People record entries either on the web UI or through Claude over MCP, and both write to the same data. Everything runs as one Cloudflare Worker: Next.js through OpenNext, a D1 database, and OAuth state in KV. UI text, MCP tool descriptions, code comments and test names are in Thai. Keep new user-facing strings in Thai.

## Commands

```sh
npm install
npm test                          # vitest: tests/**/*.test.ts (service layer against in-memory SQLite)
npx vitest run tests/pure.test.ts # one file
npx vitest run -t "เวลาไทย"        # tests whose name matches
npm run lint
npm run typecheck
npm run db:migrate:local          # apply migrations/ to the local D1
npm run preview                   # opennextjs-cloudflare build + wrangler dev → http://localhost:8787
npm run deploy                    # build + wrangler deploy (live Cloudflare project)
npm run cf-typegen                # regenerate worker-configuration.d.ts after changing bindings
```

Use `npm run preview` to run the app. `npm run dev` (plain `next dev`) serves only the pages. `/api/*`, `/mcp` and `/authorize` live in `worker.ts`, outside Next.js, so the UI can't load data under `next dev`.

`worker.ts` imports `./.open-next/worker.js`, which only exists after `opennextjs-cloudflare build`. `typecheck` and `preview` can fail on a fresh clone until you have built once.

## Architecture

```
browser ─► Next.js pages (all "use client") ─► fetch /api/* ─┐
Claude  ─► /mcp (OAuth bearer token) ────────────────────────┼─► src/server/services/* ─► D1
                                                             ┘
```

- **`worker.ts`** is the only entry point. It wraps everything in `@cloudflare/workers-oauth-provider`. `/mcp` is the protected `apiRoute`, so the provider rejects calls without a token (401) and passes `ctx.props.userId` to the MCP handler. Everything else goes to `defaultHandler`: `/authorize` → `src/server/authorize.ts`, `/api/*` → `src/server/api.ts`, and the rest → the Next.js worker. The provider is built and cached per origin, from `PUBLIC_URL` if it is set, otherwise from the request origin.
- **`src/server/services/`** is the shared business logic. `api.ts` (web, zod-validated JSON) and `mcp.ts` (MCP tools, stateless Streamable HTTP) are thin adapters over it, so put behaviour changes here, not in an adapter. Services throw `ServiceError` / `AuthError` with a `code`, and each adapter maps that code to an HTTP status or an MCP `isError` result.
- **`src/server/db.ts`** defines a minimal `Db` interface (prepare/bind/all/first/run/batch) instead of using D1 types directly. That way tests can swap in `tests/sqlite-db.ts`, which wraps better-sqlite3, applies every `migrations/*.sql` file in order, and emulates D1 `batch` as a single transaction. Services must use only that interface.
- **Auth:** the first account to register becomes the owner. In the same `batch` (one D1 transaction), registration seeds `DEFAULT_CATEGORIES` and sets `app_settings.registration_open` to `0`. The web UI uses a session cookie whose name is `__Host-money_session` on https and `money_session` on http. The DB stores only the SHA-256 of the session token. Passwords use PBKDF2 at 100,000 iterations, the Workers maximum. `/authorize` requires an existing web session before the user can grant Claude access.
- **Frontend:** the `src/app/` pages are client components that call `/api` through `src/lib/api.ts`. That file **re-declares** the `Transaction`/`Category`/totals types by hand, so update it whenever you change service return shapes. UI is shadcn/ui (`base-nova` style, Base UI) in `src/components/ui`, and app components are in `src/components/money`.

## Data invariants

- Money is stored as integer **satang** (`amount_satang > 0`). Convert at the edges with `bahtToSatang` / `satangToBaht` / `formatBaht` in `src/server/money.ts`, and never do float baht arithmetic in storage or queries.
- Dates are `YYYY-MM-DD` in **Asia/Bangkok**, from `todayInBangkok()` and the helpers in `src/server/thai-date.ts`. Weeks start on Monday. `previousRange` compares a whole month to the previous month, a whole year to the previous year, and any other range to the same number of days just before it.
- Deletes are soft (`deleted_at`) and can be undone with `restore_transaction`. Each transaction records `source` as `'web'` or `'claude'`, and the UI shows "จาก Claude" for Claude entries.
- Free-text entry (`"กะเพราไข่ดาว 65 กาแฟ 55"`, `"เมื่อวาน..."`) is parsed in `src/server/parse.ts`. `src/server/categories.ts` guesses the kind and category from keywords. Each user's categories store their own comma-separated `keywords`.
- Schema changes go in a new numbered file in `migrations/`. Never edit `0001_init.sql`, because it has already been applied to the remote D1.

## Deployment notes

- `wrangler.jsonc` holds the real D1 and KV ids for the deployed worker `moneyz-app`, and `npm run deploy` / `db:migrate:remote` change production. The binding names `DB` and `OAUTH_KV` are required by the code.
- `.dev.vars` (optional `PUBLIC_URL`) is gitignored. `.dev.vars.example` is the template.
- Claude can't reach localhost, so the MCP connector only works against the deployed URL (`https://<domain>/mcp`).
