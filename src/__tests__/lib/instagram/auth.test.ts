import { describe, it, expect, vi } from "vitest";

vi.unmock("@/lib/instagram/auth");

import { isTokenExpiringSoon } from "@/lib/instagram/auth";

describe("isTokenExpiringSoon", () => {
  it("returns false for null expiry", () => {
    expect(isTokenExpiringSoon(null)).toBe(false);
  });

  it("returns false when expiry is far in the future", () => {
    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(isTokenExpiringSoon(thirtyDays)).toBe(false);
  });

  it("returns true when expiry is within 7 days", () => {
    const threeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(isTokenExpiringSoon(threeDays)).toBe(true);
  });

  it("returns true when already expired", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(isTokenExpiringSoon(yesterday)).toBe(true);
  });

  it("respects custom window", () => {
    const twoDays = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const oneDay = 24 * 60 * 60 * 1000;

    expect(isTokenExpiringSoon(twoDays, oneDay)).toBe(false);
    expect(isTokenExpiringSoon(twoDays, 3 * oneDay)).toBe(true);
  });

  it("returns true with windowMs=0 for expired tokens", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(isTokenExpiringSoon(past, 0)).toBe(true);
  });

  it("returns false with windowMs=0 for non-expired tokens", () => {
    const future = new Date(Date.now() + 60000).toISOString();
    expect(isTokenExpiringSoon(future, 0)).toBe(false);
  });
});
