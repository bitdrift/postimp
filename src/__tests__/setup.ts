import { vi } from "vitest";

// ── Safety guard: prevent tests from running outside Docker ──────────
// The test-entrypoint.sh sets POSTIMP_TEST_CONTAINER=1 before running vitest.
// This prevents accidentally hitting a production database.
if (!process.env.POSTIMP_TEST_CONTAINER) {
  throw new Error(
    "Tests must run inside the Docker container. Use `make test` or `npm run test:docker`.",
  );
}

// ── Environment variables ────────────────────────────────────────────
// JWTs below are signed with the secret in scripts/test-entrypoint.sh
// ("super-secret-jwt-token-with-at-least-32-characters-long").
// If that secret changes, regenerate these tokens.
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoidGVzdCIsImlhdCI6MTc3MjY3NzEyMSwiZXhwIjoyMDg4MDM3MTIxfQ.2OKwB_fc6OYTm1bl54bPDVAbcgKQBQeyjZtzMpefafI";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InRlc3QiLCJpYXQiOjE3NzI2NzcxMjEsImV4cCI6MjA4ODAzNzEyMX0.T_xhqWx3_n9TCCf4r_zsn4EKTDweMHZ-HOahs9qJiEw";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.OPENAI_API_KEY = "test-key";
process.env.TWILIO_ACCOUNT_SID = "ACtest";
process.env.TWILIO_AUTH_TOKEN = "test-token";
process.env.TWILIO_PHONE_NUMBER = "+15551234567";
process.env.INSTAGRAM_APP_ID = "test-id";
process.env.INSTAGRAM_APP_SECRET = "test-secret";

// ── Mock external services (NOT Supabase) ────────────────────────────

vi.mock("@/lib/openai/conversation", () => ({
  sendMessage: vi.fn().mockResolvedValue({
    responseId: "resp_test_123",
    textResponse: "Here's a caption for your post!",
    toolCalls: [
      {
        name: "update_caption",
        callId: "call_test_1",
        args: { caption: "Test caption #test #vitest" },
      },
    ],
  }),
  sendToolResults: vi.fn().mockResolvedValue({
    responseId: "resp_test_456",
    textResponse: "Caption updated!",
    toolCalls: [],
  }),
  buildSystemPrompt: vi.fn().mockReturnValue("test system prompt"),
}));

vi.mock("@/lib/twilio/client", () => ({
  twilioClient: {},
  sendSms: vi.fn().mockResolvedValue({ sid: "SM_test" }),
}));

vi.mock("@/lib/twilio/validate", () => ({
  validateTwilioRequest: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/instagram/publish", () => ({
  publishToInstagram: vi.fn().mockResolvedValue({
    success: true,
    instagramPostId: "ig_123",
  }),
}));

vi.mock("@/lib/instagram/auth", () => ({
  getAuthorizationUrl: vi.fn().mockReturnValue("https://instagram.com/oauth"),
  exchangeCodeForToken: vi.fn().mockResolvedValue({ accessToken: "tok", userId: "uid" }),
  getInstagramUsername: vi.fn().mockResolvedValue("testuser"),
  refreshInstagramToken: vi.fn().mockResolvedValue({
    accessToken: "refreshed_tok",
    expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
  }),
  isTokenExpiringSoon: vi.fn().mockReturnValue(false),
}));
