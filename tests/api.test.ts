import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createFakeDb } from "./helpers/fakeDb";

let fake = createFakeDb();
vi.mock("@/lib/mongodb", () => ({ getDb: async () => fake }));

import * as register from "@/app/api/auth/register/route";
import * as login from "@/app/api/auth/login/route";
import * as logout from "@/app/api/auth/logout/route";
import * as me from "@/app/api/auth/me/route";
import * as habits from "@/app/api/habits/route";
import * as habitById from "@/app/api/habits/[id]/route";
import * as complete from "@/app/api/habits/[id]/complete/route";

type Handler = (req: NextRequest, ctx?: never) => Promise<Response>;

function req(path: string, method: string, opts: { body?: unknown; cookie?: string; tz?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.tz) headers["x-timezone"] = opts.tz;
  return new NextRequest(`http://localhost${path}`, {
    method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
}
const call = async (h: Handler, r: NextRequest) => {
  const res = await h(r);
  return { res, body: await res.json() };
};
const withId = (h: unknown, id: string) => (r: NextRequest) =>
  (h as (r: NextRequest, c: { params: Promise<{ id: string }> }) => Promise<Response>)(r, { params: Promise.resolve({ id }) });

async function signUp(email: string) {
  const res = await register.POST(req("/api/auth/register", "POST", { body: { email, password: "password123" } }));
  const cookie = res.headers.get("set-cookie")!.split(";")[0];
  return cookie;
}
async function newHabit(cookie: string, body: object = { name: "Read", type: "Daily", count: 0 }) {
  const { body: b } = await call(habits.POST, req("/api/habits", "POST", { cookie, body }));
  return b.habit as { _id: string };
}

beforeEach(() => { fake = createFakeDb(); vi.useRealTimers(); });

describe("auth", () => {
  it("registers, sets an httpOnly cookie, and /me returns the user", async () => {
    const res = await register.POST(req("/api/auth/register", "POST", { body: { email: "A@x.com", password: "password123" } }));
    expect(res.status).toBe(201);
    const setCookie = res.headers.get("set-cookie")!;
    expect(setCookie).toMatch(/HttpOnly/i);
    const { body } = await call(me.GET, req("/api/auth/me", "GET", { cookie: setCookie.split(";")[0] }));
    expect(body.user.email).toBe("a@x.com");
  });

  it("never stores the plaintext password", async () => {
    await signUp("a@x.com");
    const stored = fake.cols.users.docs[0].passwordHash as string;
    expect(stored).not.toContain("password123");
    expect(stored).toMatch(/^\$2[aby]\$/);
  });

  it("rejects duplicate emails, weak passwords, bad emails", async () => {
    await signUp("a@x.com");
    expect((await call(register.POST, req("/", "POST", { body: { email: "a@x.com", password: "password123" } }))).res.status).toBe(409);
    expect((await call(register.POST, req("/", "POST", { body: { email: "b@x.com", password: "short" } }))).res.status).toBe(400);
    expect((await call(register.POST, req("/", "POST", { body: { email: "nope", password: "password123" } }))).res.status).toBe(400);
  });

  it("login: right password works, wrong password and unknown email get the same 401", async () => {
    await signUp("a@x.com");
    expect((await call(login.POST, req("/", "POST", { body: { email: "a@x.com", password: "password123" } }))).res.status).toBe(200);
    const wrong = await call(login.POST, req("/", "POST", { body: { email: "a@x.com", password: "wrongpass1" } }));
    const unknown = await call(login.POST, req("/", "POST", { body: { email: "z@x.com", password: "password123" } }));
    expect(wrong.res.status).toBe(401);
    expect(unknown.res.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it("logout clears the cookie", async () => {
    const res = await logout.POST();
    expect(res.headers.get("set-cookie")).toMatch(/Max-Age=0/i);
  });

  it("every habit endpoint requires auth", async () => {
    const id = "a".repeat(24);
    const results = await Promise.all([
      habits.GET(req("/api/habits", "GET")),
      habits.POST(req("/api/habits", "POST", { body: { name: "x", type: "Daily" } })),
      habits.DELETE(req("/api/habits", "DELETE", { body: { ids: [id] } })),
      withId(habitById.PATCH, id)(req("/", "PATCH", { body: { name: "x" } })),
      withId(complete.POST, id)(req("/", "POST")),
      me.GET(req("/api/auth/me", "GET")),
    ]);
    expect(results.map((r) => r.status)).toEqual([401, 401, 401, 401, 401, 401]);
  });
});

describe("habits CRUD", () => {
  it("creates, lists (with server-computed fields) and never leaks userId", async () => {
    const cookie = await signUp("a@x.com");
    await newHabit(cookie, { name: "  Read  ", type: "Weekly", count: 3 });
    const { body } = await call(habits.GET, req("/api/habits", "GET", { cookie }));
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ name: "Read", type: "Weekly", count: 3, streak: 0, completed: false });
    expect(body[0].userId).toBeUndefined();
  });

  it("rejects invalid input on create", async () => {
    const cookie = await signUp("a@x.com");
    for (const bad of [{ name: "", type: "Daily" }, { name: "x", type: "Hourly" }, { name: "x", type: "Daily", count: -1 }, { name: "x", type: "Daily", count: "5" }]) {
      expect((await call(habits.POST, req("/", "POST", { cookie, body: bad }))).res.status).toBe(400);
    }
  });

  it("caps habits per user", async () => {
    const cookie = await signUp("a@x.com");
    for (let i = 0; i < 100; i++) await newHabit(cookie, { name: `h${i}`, type: "Daily" });
    expect((await call(habits.POST, req("/", "POST", { cookie, body: { name: "one too many", type: "Daily" } }))).res.status).toBe(400);
  }, 30_000);

  it("PATCH only changes whitelisted fields (mass-assignment is ignored)", async () => {
    const cookie = await signUp("a@x.com");
    const { _id } = await newHabit(cookie);
    const before = { ...fake.cols.habits.docs[0] };
    const { res, body } = await call(withId(habitById.PATCH, _id), req("/", "PATCH", {
      cookie, body: { name: "Run", userId: "f".repeat(24), createdAt: "2000-01-01", streak: 999, bestStreak: 999 },
    }));
    expect(res.status).toBe(200);
    expect(body.habit.name).toBe("Run");
    const after = fake.cols.habits.docs[0];
    expect(after.userId).toEqual(before.userId);
    expect(after.createdAt).toEqual(before.createdAt);
    expect(after.streak).toBe(0);
    expect(after.bestStreak).toBe(0);
  });

  it("PATCH validates input and rejects empty updates / bad ids / unknown habits", async () => {
    const cookie = await signUp("a@x.com");
    const { _id } = await newHabit(cookie);
    const patch = (id: string, body: object) => call(withId(habitById.PATCH, id), req("/", "PATCH", { cookie, body }));
    expect((await patch(_id, { name: "   " })).res.status).toBe(400);
    expect((await patch(_id, { type: "Yearly" })).res.status).toBe(400);
    expect((await patch(_id, {})).res.status).toBe(400);
    expect((await patch("not-an-id", { name: "x" })).res.status).toBe(400);
    expect((await patch("b".repeat(24), { name: "x" })).res.status).toBe(404);
  });

  it("deletes several at once", async () => {
    const cookie = await signUp("a@x.com");
    const a = await newHabit(cookie), b = await newHabit(cookie), c = await newHabit(cookie);
    const { body } = await call(habits.DELETE, req("/", "DELETE", { cookie, body: { ids: [a._id, b._id] } }));
    expect(body.deleted).toBe(2);
    expect(fake.cols.habits.docs).toHaveLength(1);
    expect(String(fake.cols.habits.docs[0]._id)).toBe(c._id);
  });
});

describe("tenant isolation", () => {
  it("user B cannot list, edit, complete or delete user A's habits", async () => {
    const a = await signUp("a@x.com");
    const b = await signUp("b@x.com");
    const { _id } = await newHabit(a);

    expect((await call(habits.GET, req("/", "GET", { cookie: b }))).body).toEqual([]);
    expect((await call(withId(habitById.PATCH, _id), req("/", "PATCH", { cookie: b, body: { name: "pwn" } }))).res.status).toBe(404);
    expect((await call(withId(complete.POST, _id), req("/", "POST", { cookie: b }))).res.status).toBe(404);
    expect((await call(habits.DELETE, req("/", "DELETE", { cookie: b, body: { ids: [_id] } }))).body.deleted).toBe(0);

    expect(fake.cols.habits.docs).toHaveLength(1);
    expect(fake.cols.habits.docs[0]).toMatchObject({ name: "Read", count: 0 });
  });
});

describe("completing habits", () => {
  it("increments once per period; a second tap is a 409", async () => {
    const cookie = await signUp("a@x.com");
    const { _id } = await newHabit(cookie, { name: "Read", type: "Daily", count: 10 });
    const first = await call(withId(complete.POST, _id), req("/", "POST", { cookie }));
    expect(first.res.status).toBe(200);
    expect(first.body.habit).toMatchObject({ count: 11, streak: 1, completed: true });
    expect((await call(withId(complete.POST, _id), req("/", "POST", { cookie }))).res.status).toBe(409);
    expect(fake.cols.habits.docs[0].count).toBe(11);
  });

  it("concurrent taps (e.g. two tabs) count exactly once", async () => {
    const cookie = await signUp("a@x.com");
    const { _id } = await newHabit(cookie);
    const results = await Promise.all(
      Array.from({ length: 8 }, () => withId(complete.POST, _id)(req("/", "POST", { cookie }))),
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(7);
    expect(fake.cols.habits.docs[0].count).toBe(1);
  });

  it("streak grows over consecutive days, decays after a gap, and uses the user's time zone", async () => {
    const cookie = await signUp("a@x.com");
    const { _id } = await newHabit(cookie);
    const tap = async (iso: string, tz = "UTC") => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(iso));
      const out = await call(withId(complete.POST, _id), req("/", "POST", { cookie, tz }));
      vi.useRealTimers();
      return out;
    };
    expect((await tap("2026-10-01T10:00:00Z")).body.habit.streak).toBe(1);
    expect((await tap("2026-10-02T10:00:00Z")).body.habit.streak).toBe(2);
    expect((await tap("2026-10-03T10:00:00Z")).body.habit.streak).toBe(3);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-05T10:00:00Z")); // missed Oct 4
    const { body } = await call(habits.GET, req("/", "GET", { cookie }));
    vi.useRealTimers();
    expect(body[0]).toMatchObject({ streak: 0, bestStreak: 3, completed: false });

    // 22:00 UTC Oct 5 is already Oct 6 in Kolkata: a new local day even though UTC says same day.
    expect((await tap("2026-10-05T10:00:00Z")).body.habit.streak).toBe(1);
    expect((await tap("2026-10-05T22:00:00Z", "Asia/Kolkata")).res.status).toBe(200);
  });

  it("changing the type through PATCH recomputes completion for the new cadence", async () => {
    const cookie = await signUp("a@x.com");
    const { _id } = await newHabit(cookie);
    await call(withId(complete.POST, _id), req("/", "POST", { cookie }));
    const { body } = await call(withId(habitById.PATCH, _id), req("/", "PATCH", { cookie, body: { type: "Monthly" } }));
    expect(body.habit).toMatchObject({ type: "Monthly", completed: true, streak: 1 });
  });
});
