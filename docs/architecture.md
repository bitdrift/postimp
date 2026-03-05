# Post Imp — Architecture

## System Overview

Post Imp is a Next.js application with no separate backend. All server-side logic runs as Next.js Route Handlers (Vercel serverless functions) that call external services directly.

```
Browser ──→ Next.js API Routes (Vercel) ──→ Supabase / OpenAI / Instagram
Twilio  ──→ /api/webhooks/twilio ──────────→ same serverless layer
```

There is no dedicated API server, REST layer, or BFF. Next.js serves both the frontend and all backend logic.

## Tech Stack

| Layer        | Technology                          |
| ------------ | ----------------------------------- |
| Framework    | Next.js 15 (App Router, TypeScript) |
| UI           | React 18, Tailwind CSS 4            |
| Database     | Supabase (PostgreSQL 17)            |
| Auth         | Supabase Auth (email/password)      |
| Storage      | Supabase Storage (post images)      |
| Realtime     | Supabase Postgres Changes           |
| AI           | OpenAI GPT-4o (vision)              |
| SMS          | Twilio                              |
| Social       | Instagram Graph API v21.0           |
| Hosting      | Vercel                              |

## Directory Structure

```
src/
├── app/                        # Next.js App Router
│   ├── (auth)/                 # Login, signup, OAuth callback
│   ├── api/                    # All backend logic (Route Handlers)
│   │   ├── chat/               # send, upload, messages
│   │   ├── instagram/          # OAuth auth + callback
│   │   ├── posts/              # CRUD operations
│   │   └── webhooks/twilio/    # Inbound SMS/MMS
│   ├── posts/                  # Post list + thread chat view
│   │   ├── [postId]/           # Thread view (chat + preview tabs)
│   │   └── new/                # Image upload flow
│   ├── account/                # Profile & Instagram connection
│   ├── onboarding/             # Brand profile setup
│   └── preview/[token]/        # Public shareable preview
├── lib/                        # Business logic & service clients
│   ├── core/                   # Unified message router + handlers
│   │   ├── router.ts           # Routes messages by state + intent
│   │   ├── handle-new-post.ts  # Draft creation
│   │   ├── handle-approve.ts   # Publishing
│   │   ├── handle-revise.ts    # Caption revision
│   │   ├── deliver.ts          # Channel-agnostic delivery
│   │   ├── messages.ts         # Message templates (SMS + web)
│   │   └── types.ts            # Shared types
│   ├── supabase/               # DB clients (browser, server, admin)
│   ├── instagram/              # OAuth + Graph API publishing
│   ├── openai/                 # GPT-4o caption generation
│   ├── twilio/                 # SMS client + signature validation
│   └── sms/                    # SMS-specific routing
├── middleware.ts                # Auth guard for protected routes
supabase/
├── migrations/                 # Incremental SQL migrations
└── config.toml                 # Supabase CLI config
```

## Key Architectural Patterns

### Unified Message Router

The central design pattern is a **unified router** (`lib/core/router.ts`) that handles both web and SMS messages through the same business logic. Channel differences are abstracted via a `DeliverFn` type — the router doesn't know or care whether it's replying to a browser or a phone.

```
Web /api/chat/send ──→ router.ts ──→ handle-*.ts ──→ deliver (web)
Twilio webhook    ──→ router.ts ──→ handle-*.ts ──→ deliver (sms)
```

The router determines intent based on post state and message content:
- **No active draft + image** → create new post
- **Active draft + approval keywords** → publish
- **Active draft + text feedback** → revise caption
- **Cancel/help keywords** → cancel or show help

### Post Lifecycle

Posts follow a simple state machine: `draft` → `published` or `cancelled`. Only one draft can be active per user at a time — uploading a new image cancels any existing draft.

### Supabase Client Tiers

Three client configurations for different contexts:

| Client        | File              | Use case                      |
| ------------- | ----------------- | ----------------------------- |
| Browser       | `client.ts`       | Client components (with RLS)  |
| Server        | `server.ts`       | Server components (with RLS)  |
| Admin         | `admin.ts`        | API routes (bypasses RLS)     |

API routes use the admin (service role) client for full database access. Browser and server clients respect Row-Level Security policies.

### Realtime Chat

The thread view uses Supabase Postgres Changes to subscribe to new messages. The server component fetches initial messages on load, then the client subscribes for INSERT events on the `messages` table filtered by `post_id`. This gives real-time updates when the AI responds or when interacting via SMS simultaneously.

## Database Schema

Five tables plus a storage bucket:

| Table                    | Purpose                                                    |
| ------------------------ | ---------------------------------------------------------- |
| `profiles`               | Brand info (name, tone, audience), extends `auth.users`    |
| `posts`                  | Image URL, caption, status, preview_token, instagram_post_id |
| `messages`               | Chat history for both SMS and web, linked to posts         |
| `instagram_connections`  | OAuth tokens and Instagram user details                    |
| `pending_registrations`  | SMS signup tokens (24-hour expiry)                         |
| **Storage: post-images** | Uploaded images (10MB limit, public read)                  |

RLS policies scope data to the owning user. Posts are also readable by anyone with a valid `preview_token`.

## External Service Integrations

### Instagram Graph API

1. **OAuth**: User authorizes → short-lived token → exchanged for 60-day long-lived token
2. **Publish**: Create media container → poll until `FINISHED` → publish → store post ID

### OpenAI GPT-4o

Generates captions using the image, user description, brand context, and recent captions for tone consistency. Revisions pass prior feedback to the model. Max 500 tokens output.

### Twilio

Receives inbound SMS/MMS at `/api/webhooks/twilio`. Validates request signatures in production. Sends outbound replies via the Twilio REST API.

## Authentication & Middleware

- Supabase Auth handles email/password signup and session management
- `middleware.ts` intercepts all routes and validates sessions via cookies
- Public routes: `/`, `/login`, `/signup`, `/preview/*`, `/api/*`, `/privacy`, `/terms`
- Authenticated users hitting auth pages are redirected to `/posts`
- Unauthenticated users hitting protected routes are redirected to `/login`

## Deployment

- **Vercel**: Automatic deployments from git. Next.js API routes run as serverless functions.
- **Supabase**: Managed PostgreSQL with migrations applied from `supabase/migrations/`.
- **Environment variables**: Split between `NEXT_PUBLIC_*` (client-safe) and server-only secrets (Supabase service role key, API keys for OpenAI/Twilio/Instagram).
