import type { NextFunction, Request, Response } from "express";
import { checkRateLimit } from "../lib/rate-limit.js";

export interface RateLimitOptions {
  key: (req: Request) => string;
  max: number;
  windowMs: number;
  message?: string;
}

/**
 * Rate limit por clave (IP o email) usando el contador en memoria del
 * servicio. Devuelve 429 con `Retry-After`.
 */
export function rateLimit(options: RateLimitOptions) {
  const retryAfterSeconds = String(Math.ceil(options.windowMs / 1000));

  return (req: Request, res: Response, next: NextFunction): void => {
    // Los tests existentes hacen varios logins legítimos: el contador se
    // activa solo cuando el test lo pide explícitamente.
    if (
      process.env.NODE_ENV === "test" &&
      process.env.ENABLE_RATE_LIMITS_IN_TESTS !== "true"
    ) {
      next();
      return;
    }

    if (checkRateLimit(options.key(req), options.max, options.windowMs)) {
      next();
      return;
    }

    res.setHeader("Retry-After", retryAfterSeconds);
    res.status(429).json({
      error: "Too Many Requests",
      message: options.message ?? "Demasiados intentos, probá más tarde",
      statusCode: 429,
    });
  };
}
