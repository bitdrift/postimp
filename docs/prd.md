# Post Imp - Product Requirements Document

## 1. Overview

Post Imp is an AI-powered social media manager. Users interact with the service through a web chat interface or SMS to create, review, and publish Instagram posts. The service analyzes user-provided images, composes draft captions tailored to the user's brand profile, and publishes approved content to their connected Instagram account.

**Domain:** postimp.com

## 2. Target Users

Small business owners, creators, and individuals who want to maintain a social media presence without the time or expertise to craft posts themselves.

## 3. User Interfaces

### 3.1 Web App

The primary web interface is a mobile-first chat-style app at `/posts`.

**Posts List** (`/posts`):
- Displays all active posts with thumbnail, caption preview, status badge, and date
- Hamburger menu with navigation to New Post, Account, Support, and Log Out
- Post deletion with confirmation dialog, loading state, and error handling
- "New Post" button in footer

**New Post Flow** (`/posts/new`):
- "Choose an image to begin" prompt with a single file input button
- OS-native picker (Photo Library / Take Photo / Choose File on iOS)
- Upload spinner, then redirect to thread view on success

**Thread View** (`/posts/[postId]`):
- Three tabs: Chat, Preview, Stats
- Chat tab: conversational message bubbles with the AI, text input (auto-expanding textarea), quick action buttons (Approve, Edit, View Preview)
- Preview tab: full post preview (image + latest draft caption), "Approve & Post" button for drafts
- Stats tab: engagement metrics (likes, comments) for published posts, auto-refreshes if data is older than 10 minutes, placeholder for unpublished posts
- Scroll position preserved when switching between tabs
- Real-time updates via Supabase Realtime subscriptions
- Copy-to-clipboard icon next to URLs in messages

**Account** (`/account`):
- Profile section: brand name, description, tone, caption style, target audience (view/edit)
- Instagram connection card: connect/reconnect via OAuth
- Phone number card (when present)
- Navigation links and log out in header bar

**Other Pages:**
- `/` — Landing page
- `/login` — Email/password login
- `/signup` — Multi-step signup (email verification, password, onboarding)
- `/onboarding` — Brand profile setup (required before accessing posts)
- `/preview/[token]` — Public shareable post preview
- `/privacy`, `/terms` — Legal pages

### 3.2 SMS (Twilio)

Users can interact with the full post creation workflow via SMS/MMS:
- Send a photo (MMS) with optional description to create a new post
- Receive draft captions back via SMS with a preview link
- Approve, revise, or cancel drafts by replying with natural language
- Caption override: prefix message with `SET CAPTION:` or `CAPTION:` to set exact caption text
- Help: reply `HELP`, `INFO`, or `SUPPORT` for guidance
- Unregistered phone numbers receive a welcome message with a signup link

## 4. Core Workflow

### 4.1 Registration & Onboarding

**Two entry points:**

1. **Web signup:** Enter email → create password → complete onboarding form → redirected to posts
2. **SMS signup:** Text the service number → receive signup link with token → enter email/password on web → profile created with phone number linked

**Onboarding collects:** brand name, brand description, tone/voice, caption style, target audience.

### 4.2 Post Creation

1. User sends an image (via web upload or MMS) with an optional text description.
2. Image is uploaded to Supabase Storage.
3. Draft post is created and the AI generates a caption via the conversation system.
4. Users can have multiple active drafts simultaneously.

### 4.3 Review & Revision

1. User reviews the draft caption in the chat or preview tab.
2. User can approve, request revisions (with feedback), or cancel.
3. On revision, AI regenerates the caption incorporating the feedback.
4. The preview tab always shows the latest draft caption from the conversation.
5. Revision cycle repeats until the user is satisfied.

### 4.4 Publishing

1. User approves the draft (via "Approve" button, "Approve & Post" on preview tab, or natural language like "looks good", "post it", etc.).
2. System verifies Instagram connection and token validity.
3. Publishes to Instagram via the Graph API (create container → poll status → publish).
4. Post status updated to "published" with Instagram post ID stored.
5. Confirmation message sent to user.

### 4.5 Post Deletion

- Users can delete posts from the posts list via trash icon.
- Confirmation dialog before deletion.
- Soft delete (status set to "cancelled"); cancelled posts filtered from the list.
- Loading indicator and error handling during deletion.

## 5. Conversational AI System

**Model:** OpenAI GPT-4o via Responses API (persistent conversations)

Each post gets its own AI conversation. All user messages go to the AI, which decides intent and calls tools when needed. No keyword matching — the AI handles approvals, revisions, questions, and publishing naturally.

**Conversation persistence:** Each post stores an `openai_conversation_id` (the response ID from the Responses API). Subsequent messages pass `previous_response_id` for full conversation memory.

**Function tools:**
- `update_caption(caption)` — AI calls this whenever writing or revising a caption. The backend formats and displays the caption separately (CAPTION_START/END for web, truncated for SMS).
- `publish_post()` — AI calls this when the user wants to publish. The backend handles Instagram connection checks, token validation, and the publish flow, then returns the result to the AI.

**System prompt includes:**
- Brand context (name, description, tone, target audience)
- Caption style guidelines (polished/casual/minimal)
- Behavioral rules (always use tools for captions, be concise for SMS, stay on topic)

**Caption Style** (user-selectable):
- **Polished** — structured, catchy hooks, emojis, 5-10 hashtags (default)
- **Casual** — natural and conversational, minimal formatting, 0-3 hashtags
- **Minimal** — short and clean (1-2 sentences), no hashtags or emojis

**Pre-AI guards** (hardcoded, not sent to AI):
- Onboarding check
- Image upload and storage
- No-draft/no-media prompt

## 6. Instagram Integration

**OAuth Flow:**
- Scopes: `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_insights`
- Short-lived token exchanged for long-lived token (60 days)
- User ID fetched from `/me` endpoint (avoids JS number precision issues)
- Credentials stored in `instagram_connections` table

**Publishing Flow (via `graph.instagram.com`):**
1. Create media container with image URL + caption
2. Poll container status until FINISHED (max 30 attempts, 2s intervals)
3. Publish the container
4. Store Instagram post ID on success

## 6b. Facebook Integration

**OAuth Flow (Facebook Login for Business):**
- Scopes: `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`
- User selects which Facebook Pages and Instagram accounts to grant access to
- Short-lived token exchanged for long-lived token
- Page listing uses `granular_scopes` fallback (FLB doesn't support `/me/accounts`)
- User selects a Facebook Page; page access token stored in `facebook_connections`
- `returnTo` parameter threads through OAuth flow for redirect after completion

**Insights (via `graph.facebook.com`):**
- Business Discovery API: look up any public Instagram business/creator account
- Requires `instagram_basic` scope via Facebook Login (not available via Instagram Login)
- Blocked on App Review approval for production use

## 7. Data Model

| Table | Purpose |
|---|---|
| `profiles` | User info: brand_name, brand_description, tone, caption_style, target_audience, phone, onboarding_completed |
| `posts` | Draft/published posts: status, caption, image_url, instagram_post_id, preview_token, openai_conversation_id |
| `messages` | All conversation messages: direction, body, channel (sms/web), phone, post_id, media_url |
| `post_stats` | Cached engagement metrics: data (JSONB), fetched_at |
| `instagram_connections` | OAuth credentials: access_token, token_expires_at, instagram_user_id, instagram_username |
| `facebook_connections` | Facebook page connection: page_access_token, facebook_page_id, page_name, granted_scopes |
| `pending_facebook_tokens` | Temporary storage for Facebook user token during page selection flow |
| `pending_registrations` | SMS signup tokens: phone, token, used, expires_at |

## 8. Third-Party Services

| Category | Provider | Purpose |
|---|---|---|
| SMS/Messaging | Twilio | Send and receive SMS/MMS |
| AI Model | OpenAI (GPT-4o) | Generate draft captions with vision |
| Social Media API | Instagram Graph API | Publish posts to Instagram |
| Hosting | Vercel | Next.js app and serverless API routes |
| Database | Supabase (Postgres) | Data storage, auth, file storage, realtime |
| Domain/DNS | Namecheap (registrar) + Vercel (DNS) | postimp.com |
| Authentication | Supabase Auth | Email/password login |
| File Storage | Supabase Storage | Post images |

## 9. Tech Stack

- **Framework:** Next.js (App Router), TypeScript
- **Styling:** Tailwind CSS
- **Font:** Luckiest Guy (logo wordmark), Geist (body)
- **Database:** Supabase Postgres
- **Auth:** Supabase Auth
- **Realtime:** Supabase Postgres Changes
- **Storage:** Supabase Storage
- **AI:** OpenAI GPT-4o (vision)
- **SMS:** Twilio
- **Social:** Instagram Graph API
- **Hosting:** Vercel

## 10. Current Scope

The product currently includes:

- Web-based and SMS-based post creation with image upload
- Conversational AI chat per post (OpenAI Responses API with function calling)
- AI-generated captions, natural-language revisions, and Q&A about posts
- Automated publishing to Instagram
- Thread-per-post architecture with chat, preview, and stats tabs
- Real-time message updates
- Post management (list, view, delete)
- User onboarding and profile management
- Instagram OAuth connection
- Facebook OAuth connection (Facebook Login for Business)
- Insights hub with Instagram account lookup (Business Discovery API)
- Public shareable post previews
- Copy-to-clipboard for links
- Mobile-first responsive design

**Not yet implemented:**
- Token refresh (long-lived tokens expire after 60 days)
- Richer post insights (reach, impressions, saves, shares — requires `instagram_business_manage_insights` scope)
- Billing/payments
- Multi-platform publishing (beyond Instagram)
- Scheduled/queued posts
