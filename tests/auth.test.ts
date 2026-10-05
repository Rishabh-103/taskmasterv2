import { describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import { signSession, verifySession } from "@/lib/auth";

describe("session tokens", () => {
  it("round-trips the user id", async () => {
    expect(await verifySession(await signSession("abc"))).toBe("abc");
  });
  it("rejects tampered, missing and wrongly-signed tokens", async () => {
    const t = await signSession("abc");
    expect(await verifySession(t.slice(0, -2) + "xx")).toBeNull();
    expect(await verifySession(undefined)).toBeNull();
    const forged = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("abc")
      .setExpirationTime("1h").sign(new TextEncoder().encode("another-secret-another-secret-12345"));
    expect(await verifySession(forged)).toBeNull();
  });
  it("rejects expired tokens", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01"));
    const t = await signSession("abc");
    vi.setSystemTime(new Date("2026-01-09")); // > 7 days
    expect(await verifySession(t)).toBeNull();
    vi.useRealTimers();
  });
  it("throws (not silently 401s) when AUTH_SECRET is missing", async () => {
    const prev = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "short";
    await expect(verifySession("x")).rejects.toThrow(/AUTH_SECRET/);
    process.env.AUTH_SECRET = prev;
  });
});
