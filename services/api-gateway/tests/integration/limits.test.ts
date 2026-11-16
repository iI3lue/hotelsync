import request from "supertest";
import { createApp } from "../../src/app.js";
import { TEST_SECRET, testConfig } from "../helpers/config.js";

jest.mock("../../src/logger.js", () => ({ log: jest.fn() }));

const ENV_KEYS = ["RENDER", "RENDER_SERVICE_ID", "METRICS_TOKEN"] as const;
const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (ORIGINAL_ENV[key] === undefined) delete process.env[key];
    else process.env[key] = ORIGINAL_ENV[key];
  }
});

describe("gateway resource limits", () => {
  it("rejects bodies above MAX_BODY_BYTES with 413", async () => {
    const app = createApp(testConfig({ MAX_BODY_BYTES: 1_024 }));

    const res = await request(app)
      .post("/property/bookings")
      .set("x-gateway-secret", TEST_SECRET)
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ pad: "x".repeat(2_000) }));

    expect(res.status).toBe(413);
    expect(res.body).toMatchObject({ statusCode: 413 });
  });

  it("rejects oversized URLs with 414", async () => {
    const app = createApp(testConfig());

    const res = await request(app)
      .get(`/property/${"a".repeat(2_100)}`)
      .set("x-gateway-secret", TEST_SECRET);

    expect(res.status).toBe(414);
    expect(res.body).toMatchObject({ statusCode: 414 });
  });

  it("rate limits after the per-minute budget", async () => {
    const app = createApp(testConfig({ RATE_LIMIT_PER_MINUTE: 2 }));

    expect((await request(app).get("/nope")).status).toBe(401);
    expect((await request(app).get("/nope")).status).toBe(401);

    const blocked = await request(app).get("/nope");

    expect(blocked.status).toBe(429);
    expect(blocked.headers["retry-after"]).toBeDefined();
  });

  it("hides /metrics on Render without a token and requires it when set", async () => {
    process.env.RENDER = "true";
    delete process.env.METRICS_TOKEN;

    expect((await request(createApp(testConfig())).get("/metrics")).status).toBe(404);

    process.env.METRICS_TOKEN = "metrics-token-0123456789";

    expect((await request(createApp(testConfig())).get("/metrics")).status).toBe(401);

    const ok = await request(createApp(testConfig()))
      .get("/metrics")
      .set("Authorization", "Bearer metrics-token-0123456789");

    expect(ok.status).toBe(200);
  });
});
