import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from "prom-client";
import type { NextFunction, Request, Response } from "express";
import { SERVICE_ROUTES } from "../routes.js";

export const registry = new Registry();

collectDefaultMetrics({ register: registry, prefix: "hotelsync_" });

const httpRequestDuration = new Histogram({
  name: "hotelsync_http_request_duration_seconds",
  help: "Duración de las peticiones HTTP en segundos",
  labelNames: ["method", "route", "status"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [registry],
});

const httpRequestsTotal = new Counter({
  name: "hotelsync_http_requests_total",
  help: "Total de peticiones HTTP",
  labelNames: ["method", "route", "status"],
  registers: [registry],
});

const httpRequestsInFlight = new Gauge({
  name: "hotelsync_http_requests_in_flight",
  help: "Peticiones HTTP en curso",
  registers: [registry],
});

const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KNOWN_PREFIXES: Set<string> = new Set(SERVICE_ROUTES.map((route) => route.prefix));

function routeLabel(req: Request): string {
  const normalized = req.path
    .split("/")
    .map((segment) => (UUID_SEGMENT.test(segment) || /^\d+$/.test(segment) ? ":id" : segment))
    .join("/");
  if (normalized === "/health" || normalized === "/health/") return "/health";
  const [, firstSegment] = normalized.split("/");
  if (!KNOWN_PREFIXES.has(`/${firstSegment}`)) return "unmatched";
  return normalized;
}

export function httpMetrics(req: Request, res: Response, next: NextFunction): void {
  if (req.path === "/metrics") return next();

  httpRequestsInFlight.inc();
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const labels = {
      method: req.method,
      route: routeLabel(req),
      status: String(res.statusCode),
    };
    httpRequestDuration.observe(labels, Number(process.hrtime.bigint() - start) / 1e9);
    httpRequestsTotal.inc(labels);
    httpRequestsInFlight.dec();
  });

  next();
}

export async function metricsHandler(_req: Request, res: Response): Promise<void> {
  res.setHeader("Content-Type", registry.contentType);
  res.end(await registry.metrics());
}
