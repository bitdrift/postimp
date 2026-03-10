# Research & Strategy Feature

## Vision

Help users create better posts by learning from what works — their own history, accounts they admire, and trending content in their niche. The system uses this research to improve caption generation, suggest post ideas, and guide users toward a cohesive brand strategy with measurable goals.

## Core Concepts

### Research Inputs

Users provide three types of research sources during onboarding (and can modify anytime):

1. **Own username** — If the user has existing Instagram posts, we pull and analyze them to understand their current style, what's worked, and what hasn't.
2. **Inspiration accounts** — Usernames of accounts the user wants to learn from (limit: 10). We pull their public posts and analyze patterns in content, captions, engagement, and posting cadence.
3. **Hashtags** — Tags relevant to the user's niche. Used to discover trending content, find additional inspiration accounts, and inform caption/hashtag strategy.

### What We Do With It

| Capability | Description |
|-----------|-------------|
| **Better captions** | System prompt is enriched with patterns from high-performing posts in the user's niche — tone, length, hashtag strategy, hooks, CTAs |
| **Post ideas** | Periodic suggestions based on what's trending and what's worked for inspiration accounts. Presented as a browsable list the user can act on |
| **Brand voice development** | AI helps the user develop a distinctive voice by analyzing what makes inspiration accounts stand out and adapting those patterns to the user's brand |
| **Strategic planning** | Goal-setting, content calendar suggestions, and ongoing coaching through a persistent strategy conversation |
| **Performance tips** | After publishing, the AI can compare the post's performance to benchmarks from the user's niche |

### Account-Level Conversations

Currently every conversation is tied to a specific post. This feature introduces conversations that exist at the account level — not about a specific post, but about the user's overall strategy, goals, and brand direction. These threads:

- Start during onboarding (research setup)
- Persist across sessions for ongoing strategy discussion
- Can be used for goal-setting, content calendar planning, and brand voice refinement
- May proactively engage the user periodically (e.g., weekly recap, new idea suggestions)

---

## Backlog

Tasks are ordered by suggested priority but can be reprioritized as we go. Each task is independently buildable and testable.

### Infrastructure

- [ ] **Add Facebook Login auth path** — Required for Business Discovery API (reading other accounts' posts) and hashtag search. Add alongside existing Instagram Login without disrupting current flow.
- [ ] **Research data model & migrations** — Create tables: `research_accounts` (tracked IG accounts, relationship type), `research_posts` (stored posts with local image copies), `research_hashtags` (tracked tags), `research_hashtag_posts` (discovered posts). Store images in Supabase Storage since Instagram CDN URLs expire.
- [ ] **Business Discovery API integration** — Given a username, fetch their profile info and recent posts (last ~5) via `GET /<IG_USER_ID>?fields=business_discovery.fields(...)`. Store results in research tables.
- [ ] **Hashtag search API integration** — Given a hashtag, fetch recent public media via `ig_hashtag_search`. Store results. Note: limited to 30 unique hashtags per 7-day window per user.
- [ ] **Own account post ingestion** — Pull the user's own posts via `GET /<IG_USER_ID>/media`. Start with last ~5, store images + metadata. Can expand to full history later.
- [ ] **Background data refresh** — Cron job or on-demand trigger to re-pull research data periodically (daily). Update engagement metrics on previously stored posts.

### Onboarding & Settings

- [ ] **Onboarding: Instagram username step** — New step after existing onboarding: "What's your Instagram username?" (optional — account may be new). Triggers own-account ingestion if provided.
- [ ] **Onboarding: inspiration accounts step** — "Add accounts you'd like to learn from" — username input, up to 10. Triggers Business Discovery pull for each.
- [ ] **Onboarding: hashtag step** — "What hashtags describe your niche?" — tag input. AI suggests a few based on brand description. Triggers hashtag search.
- [ ] **Account settings: manage research sources** — New section in account page to add/remove inspiration accounts and hashtags. Re-trigger data pull when sources change.

### Caption Enrichment

- [ ] **AI analysis pipeline** — When research data is pulled/refreshed, run a GPT-4o analysis pass that extracts patterns: caption length, hashtag usage, hooks/CTAs, tone, posting cadence, engagement correlations. Store summary per account and as an aggregate "niche profile."
- [ ] **Enrich system prompt with research insights** — Extend `buildSystemPrompt` to include niche context: "High-performing posts in this niche tend to...", "The user's best posts share these traits...", etc. Keep it concise — summarized insights, not raw data.
- [ ] **Business type profile templates** — Curate static seed data for common business types (restaurant, fitness, retail, creator, etc.). Use as a bootstrap when research data is sparse. AI personalizes based on user's brand description.

### Post Ideas

- [ ] **Post Ideas screen** — New screen accessible from hamburger menu. Browsable list of AI-generated post ideas, each with title, brief description, and optional reference image from research.
- [ ] **Idea generation engine** — AI generates ideas based on: trending content in hashtags, inspiration account patterns, gaps in user's posting history, seasonal opportunities. Batch-generate ~10, store in a table, mark as used/dismissed. Regenerate when stock runs low.
- [ ] **Idea → post flow** — "Start" CTA on an idea opens a new chat thread with context pre-loaded (AI knows the idea and what kind of photo to expect). "Upload" CTA goes to image upload with idea context attached.
- [ ] **Pre-image ideation in chat** — Allow users to start a chat without an image. Chat with the AI about what to post, get suggestions for photo concepts/compositions, then upload when ready.

### Strategy & Goals

- [ ] **Account-level strategy conversation** — New persistent thread not tied to a post. Accessible from the app. Starts during onboarding, AI asks about goals and makes initial recommendations. User can revisit anytime.
- [ ] **Goal setting** — AI helps user set quantitative goals (follower targets, engagement rates, posting frequency) and qualitative goals (brand awareness, community building). Stored on profile, referenced in post-level conversations.
- [ ] **Content calendar suggestions** — AI suggests a posting schedule based on goals and niche patterns. Presented as recommendations in the strategy thread. Before each post is finalized, AI considers the calendar context.
- [ ] **Proactive engagement** — Weekly summary of posting activity vs. goals. Nudges when the user hasn't posted in a while. Delivered in strategy thread (and optionally via SMS).

### Scheduling

- [ ] **Schedule a post** — "Schedule" option alongside "Approve" when finalizing. Date/time picker. Stored as a scheduled post.
- [ ] **Scheduled post publishing** — Cron job to publish posts at their scheduled time. Scheduled posts visible in a list or calendar view.
- [ ] **AI-suggested posting times** — Based on research data, suggest optimal times to post for the user's niche.

---

## Technical Considerations

### Facebook Login Auth

Business Discovery and hashtag search require Facebook Login (not Instagram Login). Options:
- Add Facebook Login as a second auth path alongside existing Instagram Login
- Or migrate entirely to Facebook Login (supports everything Instagram Login does, plus more)
- Recommendation: Add Facebook Login incrementally; don't disrupt existing Instagram Login flow

### Data Storage Strategy

- Download and store images from Instagram CDN to Supabase Storage (URLs expire)
- Store structured post data in Postgres tables
- Start with ~5 posts per source to keep things fast and testable; expand later
- Refresh data periodically (daily cron) to capture new posts and updated engagement metrics
- Be mindful of Instagram API rate limits (200 calls/user/hour)

### AI Analysis

- Use GPT-4o for analysis passes (can process images + text)
- Cache analysis results — don't re-analyze on every request
- Keep system prompt additions concise (token budget matters)
- Consider a dedicated "research analysis" prompt separate from the caption generation prompt

### Hashtag Search Limits

- Instagram limits hashtag search to 30 unique hashtags per 7-day window per user
- Plan hashtag queries carefully; prioritize the user's selected tags
- Cache results aggressively
