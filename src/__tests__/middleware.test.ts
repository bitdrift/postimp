import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}));

// Import after mock so middleware picks up the stub
const { middleware } = await import("@/middleware");

function request(path: string) {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

describe("middleware next-redirect", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
  });

  describe("unauthenticated user on protected route", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
    });

    it("redirects to /login with next param", async () => {
      const res = await middleware(request("/posts"));
      const url = new URL(res!.headers.get("location")!);
      expect(url.pathname).toBe("/login");
      expect(url.searchParams.get("next")).toBe("/posts");
    });

    it("preserves query string in next param", async () => {
      const res = await middleware(request("/posts?filter=drafts&page=2"));
      const url = new URL(res!.headers.get("location")!);
      expect(url.searchParams.get("next")).toBe("/posts?filter=drafts&page=2");
    });
  });

  describe("authenticated user on /login with next param", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    });

    it("redirects to the next path", async () => {
      const res = await middleware(request("/login?next=%2Fsettings"));
      const url = new URL(res!.headers.get("location")!);
      expect(url.pathname).toBe("/settings");
      expect(url.searchParams.has("next")).toBe(false);
    });

    it("preserves query string from next param", async () => {
      const res = await middleware(request("/login?next=%2Fposts%3Ffilter%3Ddrafts"));
      const url = new URL(res!.headers.get("location")!);
      expect(url.pathname).toBe("/posts");
      expect(url.searchParams.get("filter")).toBe("drafts");
    });

    it("falls back to /posts when next is missing", async () => {
      const res = await middleware(request("/login"));
      const url = new URL(res!.headers.get("location")!);
      expect(url.pathname).toBe("/posts");
    });

    it("blocks protocol-relative redirect (//evil.com)", async () => {
      const res = await middleware(request("/login?next=%2F%2Fevil.com"));
      const url = new URL(res!.headers.get("location")!);
      expect(url.pathname).toBe("/posts");
    });

    it("blocks /api/ paths", async () => {
      const res = await middleware(request("/login?next=%2Fapi%2Fauth%2Fcreate-profile"));
      const url = new URL(res!.headers.get("location")!);
      expect(url.pathname).toBe("/posts");
    });

    it("blocks /auth/ paths", async () => {
      const res = await middleware(request("/login?next=%2Fauth%2Fcallback"));
      const url = new URL(res!.headers.get("location")!);
      expect(url.pathname).toBe("/posts");
    });
  });
});
