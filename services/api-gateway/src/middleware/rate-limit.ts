import type { NextFunction, Request, Response } from "express";

export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  exemptPaths?: readonly string[];
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Límite global por IP en memoria (una sola instancia free en Render).
 * Protege al gateway y a los servicios de ráfagas y de fuerza bruta
 * distribuida antes de llegar a los handlers.
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const exempt = new Set(options.exemptPaths ?? []);
  const buckets = new Map<string, Bucket>();
  const windowMs = options.windowMs;

  return (req: Request, res: Response, next: NextFunction): void => {
    if (options.limit <= 0 || exempt.has(req.path)) {
      next();
      return;
    }

    const now = Date.now();
    const key = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (bucket.count < options.limit) {
      bucket.count += 1;
      next();
      return;
    }

    res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
    res.status(429).json({
      error: "Too Many Requests",
      message: "Demasiadas peticiones, probá más tarde",
      statusCode: 429,
    });
  };
}
