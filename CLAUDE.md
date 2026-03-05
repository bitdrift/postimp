# CLAUDE.md — Post Imp

## Project

Post Imp is an AI-powered social media manager. Users create Instagram posts through a web chat UI or SMS. See `docs/prd.md` for full product requirements and `docs/architecture.md` for system design.

## Tech Stack

- Next.js 15 (App Router), React 18, TypeScript, Tailwind CSS 4
- Supabase (Postgres, Auth, Storage, Realtime)
- OpenAI GPT-4o, Twilio, Instagram Graph API
- Deployed on Vercel

## Commands

```bash
npm run dev          # Start dev server (port 3000)
npm run build        # Production build
npm run lint         # ESLint
npm run format       # Format all files (Biome)
npm run format:check # Check formatting without writing
npm run test:docker  # Run tests in isolated Docker container
```

## Project Structure

- `src/app/` — Pages and API route handlers (App Router)
- `src/lib/core/` — Unified message router and post handlers (the core business logic)
- `src/lib/supabase/` — Database clients (browser, server, admin)
- `src/lib/instagram/` — OAuth and publishing
- `src/lib/openai/` — Caption generation
- `src/lib/twilio/` — SMS client
- `supabase/migrations/` — SQL schema migrations

## Key Patterns

- **No separate backend.** Next.js Route Handlers (`app/api/`) are the entire backend, running as Vercel serverless functions.
- **Unified message router.** `lib/core/router.ts` handles both web and SMS through the same logic. Channel-specific delivery is abstracted via `DeliverFn`.
- **Supabase client tiers.** Use `client.ts` in browser, `server.ts` in server components, `admin.ts` (service role) in API routes. API routes bypass RLS; browser/server clients respect it.
- **One active draft.** Users can only have one draft post at a time. New uploads cancel existing drafts.
- **Realtime chat.** Thread views subscribe to Supabase Postgres Changes for live message updates.

## Formatting & Linting

- **Biome** handles code formatting (2-space indent, double quotes, semicolons, 100 line width)
- **ESLint** handles linting (Next.js rules)
- A pre-commit hook (Husky + lint-staged) runs both automatically on staged files
- **Before committing**, always run `npm run format` to format changed files. The pre-commit hook enforces this, but running it proactively avoids hook failures.

## Conventions

- Path alias: `@/*` maps to `src/*`
- Server components by default; use `"use client"` only when needed
- API routes use the admin Supabase client (`createAdminClient`)
- Database changes go through `supabase/migrations/` as incremental SQL files
- Fonts: Luckiest Guy (logo), Geist (body), Geist Mono (code)

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `NEXT_PUBLIC_BASE_URL`

## Testing

- Test runner: Vitest
- Test files mirror source paths: `src/lib/foo.ts` → `src/__tests__/lib/foo.test.ts`
- Real Supabase (Postgres + PostgREST) in Docker — no mocking the DB
- External services (OpenAI, Twilio, Instagram) mocked via `vi.mock()` in `src/__tests__/setup.ts`
- `npm test` runs locally (requires local Supabase or Docker)
- `npm run test:docker` runs everything in an isolated container with no network access
