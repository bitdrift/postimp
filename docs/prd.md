# Post Imp - Product Requirements Document

## 1. Overview

Post Imp is an AI-powered social media management service. Customers interact with the service primarily through SMS to create, review, and publish social media posts. The service analyzes customer-provided images and text, composes draft posts tailored to the customer's profile, and publishes approved content to their connected social media accounts.

**Domain:** postimp.com

## 2. Target Users

Small business owners, creators, and individuals who want to maintain a social media presence without the time or expertise to craft posts themselves.

## 3. Core Workflow

### 3.1 Registration & Onboarding

1. Customer texts a designated phone number (TBD) to initiate registration.
2. Service replies with a link to the Post Imp website to complete signup.
3. Customer completes an onboarding flow on the website that collects:
   - Business/brand name and description
   - Tone and voice preferences
   - Target audience
   - Instagram account connection (OAuth)
   - Any other profile details used to customize posts

### 3.2 Post Creation

1. Customer sends an SMS containing an image, a text description, or both.
2. Service receives the message and uses an AI model to compose a draft social media post.
   - AI analyzes the image content (if provided).
   - AI incorporates customer profile info and past post history to tailor the draft.
3. Service sends the draft back to the customer via SMS, including a link to preview the full draft (image + caption) on the Post Imp website.

### 3.3 Review & Revision

1. Customer reviews the draft.
2. Customer may approve the draft by replying via SMS.
3. Customer may request revisions by replying with feedback via SMS.
4. Service revises the draft based on feedback and re-sends for review.
5. This revision cycle can repeat as needed until the customer is satisfied.

### 3.4 Publishing

1. Upon customer approval, the service automatically publishes the post to the customer's connected Instagram account.
2. The completed post (image, caption, metadata) is stored in the database.

## 4. Platform Support

- **Phase 1 (MVP):** Instagram only
- **Future:** Additional platforms (e.g., Facebook, X/Twitter, TikTok, LinkedIn) may be added

## 5. Website

The Post Imp website (postimp.com) serves the following purposes:

- **Signup/onboarding:** New customer registration and profile setup
- **Draft preview:** Hosted pages where customers can view full draft posts (image + caption) before approving
- **Account management:** Customers can update profile info and manage connected social accounts

The website should be simple and lightweight — the primary interface remains SMS.

## 6. AI Post Composition

- The service uses an online AI model (provider TBD) to generate draft posts.
- The AI receives:
  - The customer's image and/or text input
  - Customer profile data (brand info, tone, audience)
  - History of previous posts for context and consistency
- The AI outputs a draft caption/post text appropriate for the target platform.

## 7. Data Storage

- Customer profiles and preferences
- Connected social media account credentials/tokens
- Post history (image, caption, platform, publish date, status)
- Conversation/SMS history for context
- Post history is used to improve future post quality and maintain brand consistency

## 8. Pricing

- Pricing model: per-post (amount TBD)
- Billing implementation deferred to a later phase
- MVP will operate without billing

## 9. Third-Party Services (TBD)

The following categories of third-party services will be required. Specific providers to be selected:

| Category | Purpose | Candidates |
|---|---|---|
| **SMS/Messaging** | Send and receive SMS with customers | TBD |
| **AI Model** | Generate draft post captions from images/text | TBD |
| **Social Media API** | Publish posts to Instagram (and future platforms) | Instagram Graph API |
| **Hosting/Compute** | Host the web application and backend services | TBD |
| **Database** | Store customer data, posts, and conversation history | TBD |
| **Domain/DNS** | Manage postimp.com | TBD |
| **Authentication** | OAuth for connecting customer social media accounts | TBD |
| **File/Image Storage** | Store uploaded images and post media | TBD |
| **Payments** | Per-post billing (future phase) | TBD |

## 10. MVP Scope

The MVP includes:

- SMS-based registration trigger
- Web-based onboarding and profile setup
- SMS-based post creation (image and/or text input)
- AI-generated draft posts
- SMS-based draft review and revision loop
- Automated publishing to Instagram
- Post history storage
- Simple website for signup, onboarding, and draft preview

The MVP does **not** include:

- Billing/payments
- Multi-platform publishing (beyond Instagram)
- Scheduled/queued posts
- Analytics or reporting
