import { describe, it, expect, vi, afterEach } from "vitest";
import { createHmac } from "crypto";
import { verifySlackRequest } from "@/lib/slack/verify";

const SECRET = "test-signing-secret";

function makeSignature(secret: string, timestamp: number, body: string): string {
  const sigBase = `v0:${timestamp}:${body}`;
  const hmac = createHmac("sha256", secret).update(sigBase).digest("hex");
  return `v0=${hmac}`;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

describe("verifySlackRequest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts a valid signature with current timestamp", () => {
    const ts = nowSeconds();
    const body = '{"type":"event_callback"}';
    const sig = makeSignature(SECRET, ts, body);

    expect(verifySlackRequest(SECRET, { timestamp: String(ts), signature: sig }, body)).toBe(true);
  });

  it("rejects an invalid signature", () => {
    const ts = nowSeconds();
    const body = '{"type":"event_callback"}';

    expect(verifySlackRequest(SECRET, { timestamp: String(ts), signature: "v0=bad" }, body)).toBe(
      false,
    );
  });

  it("rejects a valid signature with wrong secret", () => {
    const ts = nowSeconds();
    const body = '{"type":"event_callback"}';
    const sig = makeSignature("wrong-secret", ts, body);

    expect(verifySlackRequest(SECRET, { timestamp: String(ts), signature: sig }, body)).toBe(false);
  });

  it("rejects timestamps older than 5 minutes", () => {
    const ts = nowSeconds() - 301;
    const body = '{"type":"event_callback"}';
    const sig = makeSignature(SECRET, ts, body);

    expect(verifySlackRequest(SECRET, { timestamp: String(ts), signature: sig }, body)).toBe(false);
  });

  it("rejects timestamps more than 60 seconds in the future", () => {
    const ts = nowSeconds() + 61;
    const body = '{"type":"event_callback"}';
    const sig = makeSignature(SECRET, ts, body);

    expect(verifySlackRequest(SECRET, { timestamp: String(ts), signature: sig }, body)).toBe(false);
  });

  it("accepts a timestamp slightly in the future (within 60s)", () => {
    const ts = nowSeconds() + 30;
    const body = '{"type":"event_callback"}';
    const sig = makeSignature(SECRET, ts, body);

    expect(verifySlackRequest(SECRET, { timestamp: String(ts), signature: sig }, body)).toBe(true);
  });

  it("returns false for empty signature (length mismatch)", () => {
    const ts = nowSeconds();
    const body = "test";

    expect(verifySlackRequest(SECRET, { timestamp: String(ts), signature: "" }, body)).toBe(false);
  });

  it("returns false for non-numeric timestamp", () => {
    const body = "test";

    expect(
      verifySlackRequest(SECRET, { timestamp: "not-a-number", signature: "v0=abc" }, body),
    ).toBe(false);
  });

  it("works with empty body", () => {
    const ts = nowSeconds();
    const body = "";
    const sig = makeSignature(SECRET, ts, body);

    expect(verifySlackRequest(SECRET, { timestamp: String(ts), signature: sig }, body)).toBe(true);
  });
});
