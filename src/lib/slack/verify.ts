import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verifies that an incoming request is genuinely from Slack
 * using the signing secret and request signature.
 * https://api.slack.com/authentication/verifying-requests-from-slack
 */
export function verifySlackRequest(
  signingSecret: string,
  headers: { timestamp: string; signature: string },
  rawBody: string,
): boolean {
  const timestamp = Number(headers.timestamp);
  const now = Math.floor(Date.now() / 1000);

  // Reject requests older than 5 minutes or more than 60 seconds in the future
  if (timestamp < now - 300 || timestamp > now + 60) {
    return false;
  }

  const sigBaseString = `v0:${timestamp}:${rawBody}`;
  const hmac = createHmac("sha256", signingSecret).update(sigBaseString).digest("hex");
  const expectedSignature = `v0=${hmac}`;

  try {
    return timingSafeEqual(Buffer.from(headers.signature), Buffer.from(expectedSignature));
  } catch {
    return false;
  }
}
