# Supplier Hub

Supplier Hub is a responsive procurement directory for searching, analyzing, and maintaining supplier records.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/supplier-hub` — Supplier Hub web interface
- `artifacts/api-server/src/routes/suppliers.ts` — supplier directory and summary API
- `lib/db/src/schema/suppliers.ts` — supplier database table
- `lib/api-spec/openapi.yaml` — API contract and generated client source

## Architecture decisions

- Supplier IDs from the source spreadsheet are stable record keys.
- Supplier summary counts are calculated from the database, not maintained as duplicate totals.

## Product

Users can search and filter suppliers by name, address, city, state, ZIP code, country, or payment terms; view record details; create, edit, and delete records; and review location and payment-term summaries.

## User preferences

No additional preferences recorded.

## Gotchas

- Regenerate the API client and Zod validators after changing `lib/api-spec/openapi.yaml`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
