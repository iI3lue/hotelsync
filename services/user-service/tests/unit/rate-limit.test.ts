import express from "express";
import request from "supertest";
import { rateLimit } from "../../src/middleware/rate-limit.js";
import { clearRateLimits } from "../../src/lib/rate-limit.js";

const app = express();
app.use(express.json());
app.post(
  "/login",
  rateLimit({
    key: (req) => `test:${req.ip ?? "unknown"}`,
    max: 2,
    windowMs: 60_000,
  }),
  (_req, res) => {
    res.json({ ok: true });
  }
);

afterEach(() => {
  delete process.env.ENABLE_RATE_LIMITS_IN_TESTS;
  clearRateLimits();
});

describe("rateLimit middleware", () => {
  it("is disabled in tests unless explicitly enabled", async () => {
    clearRateLimits();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const res = await request(app).post("/login").send({});
      expect(res.status).toBe(200);
    }
  });

  it("returns 429 with Retry-After after the limit", async () => {
    process.env.ENABLE_RATE_LIMITS_IN_TESTS = "true";
    clearRateLimits();

    expect((await request(app).post("/login").send({})).status).toBe(200);
    expect((await request(app).post("/login").send({})).status).toBe(200);

    const blocked = await request(app).post("/login").send({});

    expect(blocked.status).toBe(429);
    expect(blocked.body).toMatchObject({ statusCode: 429 });
    expect(blocked.headers["retry-after"]).toBe("60");
  });
});
