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

Each item is a small, testable feature — a vertical slice that delivers something you can see working end-to-end. Features build on each other but each is independently committable. No tables or code are created until a feature needs them.

### Done

- [x] **Facebook Login: Business Discovery scope** — Added `instagram_basic` to Facebook Login scopes, enabling the Business Discovery API for reading other accounts' posts.
- [x] **Look up any Instagram account** — Insights hub at `/insights`, account lookup at `/insights/lookup`. Search by username, see profile info and last ~5 posts (image, caption, likes, comments, links to original). Uses Business Discovery API via Facebook Login. Added Insights to hamburger menu nav. Facebook connect prompt with `returnTo` flow. Fixed Facebook Login for Business page listing via `granular_scopes` fallback. *Blocked on App Review for `instagram_basic` approval.*

### Up Next

- [ ] **Save inspiration accounts** — From the account lookup page, tap "Save as inspiration." Saved accounts appear in a list on a new "Research" screen. User can add up to 10 and remove any. Data model is created as needed.

- [ ] **Pull your own post history** — New section on the Research screen: "Your Posts." Pulls and displays your last ~5 Instagram posts with images, captions, and engagement stats. Uses `GET /<IG_USER_ID>/media`.

- [ ] **AI-powered niche analysis** — After saving at least one inspiration account (or having your own posts pulled), a button triggers an AI analysis pass. AI looks at the collected posts and produces a written summary: what's working, common patterns (tone, length, hashtags, hooks, CTAs), engagement trends. Summary is displayed on the Research screen.

- [ ] **Smarter captions from research** — The niche analysis summary is fed into the caption generation system prompt. When composing a new post, the AI draws on research insights to write better captions. No UI change — captions just get better.

- [ ] **Hashtag search** — Enter a hashtag on the Research screen, see recent public posts for that tag. Save hashtags for later reference. Limited to 30 unique hashtags per 7-day window (Instagram API limit). Uses `ig_hashtag_search`.

- [ ] **Onboarding: research setup** — After existing onboarding, new optional steps: (1) "What's your Instagram username?" triggers own-post pull, (2) "Accounts you admire?" triggers inspiration saves, (3) "Hashtags for your niche?" triggers hashtag search. Each step is skippable.

- [ ] **Manage research sources in settings** — New section on account/settings page to add/remove inspiration accounts and hashtags. Changes trigger fresh data pulls.

- [ ] **Refresh research data** — Button to manually re-pull all research sources (new posts, updated engagement metrics). Later: daily cron job to do this automatically.

- [ ] **Strategy conversation** — New persistent AI chat thread at the account level (not tied to a post). Accessible from the app nav. AI has context from research data and can discuss goals, brand voice, and content direction.

- [ ] **Post ideas list** — New screen showing AI-generated post ideas based on research data. Each idea has a title and brief description. User can dismiss or act on ideas. "Start" opens a new post chat with the idea as context.

- [ ] **Chat without an image** — Allow starting a post conversation without uploading a photo first. Discuss what to post with the AI, get suggestions for photo concepts, then upload when ready.

- [ ] **Goal setting** — In the strategy conversation, AI helps set goals (posting frequency, engagement targets, brand direction). Goals are stored and referenced in post-level conversations ("You said you wanted to post 3x/week — you're at 1 so far").

- [ ] **Content calendar** — AI suggests a posting schedule based on goals and niche patterns. Visual calendar view. When finalizing a post, AI considers what's already planned.

- [ ] **Schedule a post** — "Schedule" option alongside "Approve" when finalizing. Date/time picker. Scheduled posts are visible in the calendar and publish automatically via cron.

- [ ] **Weekly recap** — Proactive weekly summary in the strategy thread: posts published, engagement stats vs. goals, suggestions for next week. Optionally delivered via SMS.

- [ ] **AI-suggested posting times** — When scheduling, AI recommends optimal times based on niche engagement patterns from research data.

- [ ] **Business type templates** — Seed data for common business types (restaurant, fitness, retail, creator). Bootstraps the system prompt when research data is sparse. AI personalizes based on user's brand description.

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
