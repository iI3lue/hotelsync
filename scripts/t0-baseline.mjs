#!/usr/bin/env node
/**
 * T0 baseline smoke for the HotelSync BFF.
 *
 * Records the current HTTP behavior (status + latency) of every BFF prefix so
 * the API gateway rollout can be compared against a concrete oracle.
 *
 * Usage:
 *   node scripts/t0-baseline.mjs                  # read-only checks
 *   node scripts/t0-baseline.mjs --with-flows     # adds booking/check-in/check-out
 *   node scripts/t0-baseline.mjs --json out.json  # custom output path
 *
 * Env:
 *   BFF_URL (default http://localhost:3000)
 *   T0_ADMIN_EMAIL / T0_ADMIN_PASSWORD (seeded SUPER_ADMIN)
 */

import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const WITH_FLOWS = args.includes("--with-flows");
const jsonFlag = args.indexOf("--json");
const OUTPUT = jsonFlag >= 0 && args[jsonFlag + 1]
  ? resolve(args[jsonFlag + 1])
  : resolve(ROOT, "docs/api-gateway-baseline.json");

const BASE = (process.env.BFF_URL || "http://localhost:3000").replace(/\/$/, "");
const EMAIL = process.env.T0_ADMIN_EMAIL || "admin@hotelsync.local";
const PASSWORD = process.env.T0_ADMIN_PASSWORD || "Admin123!";

const HOTEL_ID = "11111111-1111-4111-8111-111111111111";
const ROOM_TYPE_ID = "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1";
const PHYSICAL_ROOM = "1001";

const today = new Date().toISOString().slice(0, 10);
const inDays = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

const results = [];
let cookies = "";

async function probe({ method = "GET", path, body, auth = true, timeout = 15_000 }) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth && cookies) headers.Cookie = cookies;

  const started = performance.now();
  let status = null;
  let payload = null;
  let error = null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
    status = res.status;
    const text = await res.text();
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text.slice(0, 200);
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  return { status, payload, error, latency: Math.round(performance.now() - started) };
}

function record(name, { method = "GET", path, expected }, outcome, extra = {}) {
  const expectedList = Array.isArray(expected) ? expected : [expected];
  const ok = outcome.error === null && expectedList.includes(outcome.status);
  results.push({
    name,
    method,
    path,
    expected: expectedList,
    status: outcome.status,
    latency_ms: outcome.latency,
    ok,
    error: outcome.error,
    note: summarize(outcome.payload),
    ...extra,
  });
  const label = ok ? "PASS" : "FAIL";
  console.log(`${label} ${String(outcome.status ?? "ERR").padEnd(4)} ${String(outcome.latency).padStart(5)}ms ${method.padEnd(4)} ${path}  -> expect ${expectedList.join("|")}${extra.attempts ? ` (${extra.attempts} intentos)` : ""}`);
  return { ...outcome, ok };
}

async function call(name, options) {
  return record(name, options, await probe(options));
}

async function poll(name, options, { attempts = 20, delayMs = 500 } = {}) {
  let outcome;
  for (let i = 0; i < attempts; i += 1) {
    outcome = await probe(options);
    const expectedList = Array.isArray(options.expected) ? options.expected : [options.expected];
    if (outcome.error === null && expectedList.includes(outcome.status)) {
      return record(name, options, outcome, { attempts: i + 1 });
    }
    if (i < attempts - 1) await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
  }
  return record(name, options, outcome, { attempts });
}

function summarize(payload) {
  if (payload === null || payload === undefined) return null;
  if (Array.isArray(payload)) return `array(${payload.length})`;
  if (typeof payload === "object") {
    const keys = Object.keys(payload);
    return keys.slice(0, 6).join(",");
  }
  return String(payload).slice(0, 80);
}

function setCookiesFrom(res) {
  const setCookies = typeof res.headers.getSetCookie === "function"
    ? res.headers.getSetCookie()
    : [res.headers.get("set-cookie")].filter(Boolean);
  cookies = setCookies.map((c) => c.split(";")[0]).join("; ");
}

async function main() {
  console.log(`T0 baseline against ${BASE} (flows=${WITH_FLOWS})\n`);

  await call("warmup", { path: "/api/warmup", auth: false, expected: 200, timeout: 30_000 });

  const loginStarted = performance.now();
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    signal: AbortSignal.timeout(15_000),
  });
  const loginBody = await login.json().catch(() => null);
  setCookiesFrom(login);
  const loginOk = login.status === 200 && cookies.length > 0;
  results.push({
    name: "login",
    method: "POST",
    path: "/api/auth/login",
    expected: [200],
    status: login.status,
    latency_ms: Math.round(performance.now() - loginStarted),
    ok: loginOk,
    error: loginOk ? null : "missing session cookies",
    note: cookies ? "hs_access+hs_refresh" : null,
  });
  console.log(`${loginOk ? "PASS" : "FAIL"} ${login.status} login as ${EMAIL} (cookies=${cookies ? "yes" : "no"})`);
  void loginBody;

  await call("auth.me", { path: "/api/auth/me", expected: 200 });
  await call("auth.me (no session)", { path: "/api/auth/me", auth: false, expected: 401 });

  await call("property.hotels", { path: "/api/property/hotels", auth: false, expected: 200 });
  await call("rate.rates", { path: `/api/rate/rates?room_type_id=${ROOM_TYPE_ID}`, auth: false, expected: 200 });
  await call("users.staff", { path: "/api/users/staff", expected: 200 });
  await call("users.staff (no session)", { path: "/api/users/staff", auth: false, expected: 401 });
  await call("booking.list", { path: `/api/booking/bookings?hotel_id=${HOTEL_ID}`, expected: 200 });
  await call("front-desk.arrivals", { path: `/api/front-desk/arrivals?hotel_id=${HOTEL_ID}&date=${today}`, expected: 200 });
  await call("housekeeping.tasks", { path: `/api/housekeeping/tasks?hotel_id=${HOTEL_ID}`, expected: 200 });
  await call("billing.folios", { path: `/api/billing/folios?hotel_id=${HOTEL_ID}`, expected: 200 });
  await call("loyalty.levels", { path: "/api/loyalty/levels", expected: 200 });
  await call("payments.checkout.missing", { path: "/api/payments/checkout/00000000-0000-4000-8000-000000000000", expected: [404] });
  await call("analytics.dashboard", {
    path: `/api/analytics/dashboard/${HOTEL_ID}?from=${inDays(-7)}&to=${inDays(1)}`,
    expected: 200,
  });
  await call("simulator.unauthorized", {
    method: "POST",
    path: "/api/simulator/reservations",
    auth: false,
    body: {},
    expected: 403,
  });
  await call("unknown.prefix", { path: "/api/does-not-exist/probe", auth: false, expected: 404 });

  if (WITH_FLOWS) {
    console.log("\n-- reservation / check-in / check-out flow --");
    const checkIn = inDays(45);
    const checkOut = inDays(47);
    const created = await call("flow.booking.create", {
      method: "POST",
      path: "/api/booking/bookings",
      auth: false,
      expected: 201,
      body: {
        hotel_id: HOTEL_ID,
        room_type_id: ROOM_TYPE_ID,
        check_in: checkIn,
        check_out: checkOut,
        channel: "direct",
        total_amount: 8500,
        guest: {
          name: "T0 Baseline",
          email: `t0-baseline-${Date.now()}@hotelsync.local`,
          phone: "+5491100000000",
        },
      },
    });

    const bookingId = created.payload?.booking_id ?? created.payload?.id;
    if (!bookingId) {
      results.push({ name: "flow.booking.confirm", method: "POST", path: "-", expected: [200], status: null, latency_ms: 0, ok: false, error: "booking_id missing from create response", note: null });
      console.log("FAIL booking_id missing; skipping confirm/check-in/check-out");
    } else {
      await call("flow.booking.confirm", { method: "POST", path: `/api/booking/bookings/${bookingId}/confirm`, expected: 200 });
      await call("flow.check-in", {
        method: "POST",
        path: "/api/front-desk/check-in",
        expected: [200, 201],
        body: { booking_id: bookingId, physical_room_number: PHYSICAL_ROOM },
      });
      // El folio lo abre billing al consumir booking.confirmed: consistencia eventual.
      await poll("flow.billing.by-booking", { path: `/api/billing/folios/by-booking/${bookingId}`, expected: 200 });
      await call("flow.check-out", {
        method: "POST",
        path: "/api/front-desk/check-out",
        expected: [200, 201],
        body: { booking_id: bookingId },
      });
    }
  }

  const failed = results.filter((r) => !r.ok);
  const report = {
    generated_at: new Date().toISOString(),
    base_url: BASE,
    with_flows: WITH_FLOWS,
    summary: { total: results.length, passed: results.length - failed.length, failed: failed.length },
    results,
  };
  await writeFile(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`\n${report.summary.passed}/${report.summary.total} passed. Baseline written to ${OUTPUT}`);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
