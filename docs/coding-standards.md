# Coding Standards

Supplements `CLAUDE.md` with detailed conventions for keeping the codebase consistent as it grows. When in doubt, match the style of existing code.

---

## 1. TypeScript & Typing

- `strict: true` — never weaken it.
- Zero `any`. Use `unknown` and narrow, or define a proper type.
- `interface` for object shapes, `type` for unions, intersections, and function signatures.
- Shared types live in two places:
  - `lib/db/*.ts` — DB row shapes re-exported from domain modules (`Profile` from `lib/db/profiles`, `Post` from `lib/db/posts`, etc.)
  - `lib/core/types.ts` — domain types (`MessageContext`, `DeliverFn`, etc.)
- Always use `import type` for type-only imports.
- Use explicit `| null` for nullable DB fields (matches Postgres semantics).
- Annotate return types on exported functions.

```ts
// Good
import type { MessageChannel } from "@/lib/db/messages";

export interface RouteResult {
  postId?: string;
}

export async function routeMessage(
  ctx: MessageContext,
  deliver: DeliverFn,
): Promise<RouteResult> { ... }
```

## 2. File Size & Organization

Soft limits (not hard rules):

| Kind           | Target | Investigate at |
| -------------- | ------ | -------------- |
| Logic modules  | ~200   | 250+           |
| Components     | ~400   | 500+           |
| API routes     | ~60    | 80+            |

Split when:

- A file has two distinct responsibilities.
- A helper is reused across files.
- A sub-component is independently testable.

New domains get their own `lib/<domain>/` directory (e.g., `lib/instagram/`, `lib/twilio/`).

## 3. Function Length

- Soft limit: ~50 lines.
- Longer is fine for linear pipelines (route handlers, sequential workflows).
- Extract when: logic is reused, independently testable, or mixes concerns.

## 4. Naming Conventions

| Element               | Convention       | Example                    |
| --------------------- | ---------------- | -------------------------- |
| Files & directories   | kebab-case       | `handle-new-post.ts`       |
| React components      | PascalCase       | `ThreadView`               |
| Types & interfaces    | PascalCase       | `MessageContext`            |
| Functions & variables | camelCase        | `routeMessage`             |
| True constants        | UPPER_SNAKE_CASE | `NIL` (sentinel UUID)      |
| Test seed helpers     | `seed*`          | `seedProfile`, `seedPost`  |
| Test factory helpers  | `make*`          | `makeTestDeliver`          |
| Test cleanup helpers  | `clean*`         | `cleanAll`                 |

## 5. Imports

- Always use the `@/` path alias (maps to `src/`). No relative `../../` paths.
- Separate `import type` from value imports.
- Group order (blank line between groups):
  1. React / Next.js (`react`, `next/*`)
  2. External packages
  3. Internal modules (`@/lib/*`, `@/app/*`)
  4. Types (`import type`)

```ts
import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createDbClient } from "@/lib/db/client";
import { getProfile } from "@/lib/db/profiles";

import type { MessageContext } from "@/lib/core/types";
```

## 6. Error Handling

- **Supabase calls:** Always destructure `{ data, error }`. Check `error` before using `data`.
- **API route handlers:** Wrap logic in try-catch. Return appropriate status codes:
  - `200` — success
  - `400` — bad input
  - `401` — not authenticated
  - `403` — not authorized
  - `404` — resource not found
- **User-facing text:** Keep all user-facing error/response strings in `lib/core/messages.ts`. No inline string literals for messages sent to users.
- **Seed/test helpers:** Throw on error so tests fail fast with clear messages.

```ts
// API route pattern — use lib/db/ functions, not raw queries
const post = await getPostById(db, postId, user.id);
if (!post) {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
```

## 7. React Patterns

- **Server components by default.** Only add `"use client"` when the component needs browser APIs, hooks, or event handlers.
- **Server page + client view pattern:** Page components (`page.tsx`) are server components that fetch data. Interactive UI lives in a colocated client component (e.g., `thread-view.tsx`).
- **Colocate with page.** Page-specific components live next to their `page.tsx`, not in a shared `components/` directory. Extract to shared only when reused across pages.

```
src/app/posts/[postId]/
  page.tsx          ← server component (data fetching)
  thread-view.tsx   ← "use client" (interactive UI)
```

## 8. Testing

### TDD workflow (mandatory for business logic)

1. **Red** — Write a failing test that describes the expected behavior.
2. **Green** — Write the minimum code to make the test pass.
3. **Refactor** — Clean up while keeping tests green.

No new business logic in `lib/core/` without a failing test preceding it.

### Conventions

- Test files mirror source paths: `src/lib/core/router.ts` → `src/__tests__/lib/core/router.test.ts`
- **Real Postgres** via Supabase in Docker. Never mock the database.
- **Mock external services only** (OpenAI, Twilio, Instagram) — mocks live in `src/__tests__/setup.ts`.
- Use seed helpers (`seedProfile`, `seedPost`, `seedInstagramConnection`) to set up test data.
- Use `makeTestDeliver()` for capturing delivered messages in tests.
- Clean up in `afterEach` with `cleanAll()`. Tests must not leak state.
- Assert both **behavior** (what was delivered) and **DB state** (what changed in Postgres).

```ts
describe("routeMessage", () => {
  let deliver: ReturnType<typeof makeTestDeliver>["deliver"];
  let messages: ReturnType<typeof makeTestDeliver>["messages"];

  beforeEach(() => {
    ({ deliver, messages } = makeTestDeliver());
  });

  afterEach(async () => {
    await cleanAll();
  });

  it("cancels draft on CANCEL keyword", async () => {
    const { id } = await seedProfile();
    await seedPost(id);
    await routeMessage(ctx(id, { body: "cancel" }), deliver);

    // Assert behavior
    expect(messages[0].text.toLowerCase()).toContain("cancel");

    // Assert DB state
    const db = createDbClient();
    const { data } = await db.from("posts").select("status").eq("profile_id", id).single();
    expect(data?.status).toBe("cancelled");
  });
});
```

### Priority

Test core logic first (`lib/core/`), then API routes, then UI behavior.

## 9. Database

- **Incremental migrations** in `supabase/migrations/`. Never edit existing migration files.
- **DB client in API routes.** Use `createDbClient()` from `lib/db/client` for database operations in API routes and core logic. Use `createClient()` (server) for auth checks. Browser components use `createClient()` from `lib/supabase/client`.
- **DB access layer.** All server-side DB operations go through `lib/db/` functions. Each function takes a `DbClient` as its first parameter. Functions return `data | null` and throw on error. Import types from `lib/db/` modules, not `lib/supabase/types` directly. Never import `@supabase/supabase-js` outside of `lib/supabase/` and `lib/db/`.
- **Types mirror schema.** When you add/change a column, update the corresponding interface in `lib/supabase/types.ts`.
- **Explicit nullability.** Nullable columns use `| null` in TypeScript, never `?` (optional) — they are present but null, not absent.

## 10. Adding New Features

### New intent (keyword command in chat)

1. Add keyword matching in `lib/core/router.ts`.
2. Create handler in `lib/core/handle-<intent>.ts`.
3. Add message templates to `lib/core/messages.ts`.
4. Write tests in `src/__tests__/lib/core/handle-<intent>.test.ts` and add router test case.

### New API endpoint

1. Create route handler in `src/app/api/<path>/route.ts`.
2. Authenticate with `createClient()` → `getUser()`.
3. Use `createDbClient()` from `lib/db/client`, then call `lib/db/` functions for DB operations. Add new db functions in `lib/db/` if needed.
4. Return proper status codes (see section 6).

### New external integration

1. Create `lib/<service>/` directory.
2. Add mock in `src/__tests__/setup.ts`.
3. Add env vars to `.env.local` and document in `CLAUDE.md`.

### New page

1. Create `src/app/<route>/page.tsx` (server component).
2. If interactive, create a colocated `<name>-view.tsx` client component.
3. Add auth check at the top of the page component.
