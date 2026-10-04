import { createHmac, timingSafeEqual } from "node:crypto";
import { Request, Response, NextFunction } from "express";
import { AppError } from "../middleware/error-handler.js";

export interface AuthClaims {
  sub: string;
  email: string;
  role: string;
  hotel_id: string | null;
  scope: "global" | "hotel";
  iat: number;
  exp: number;
}

/**
 * Verificacion local de access tokens HS256 (misma firma que user-service).
 * Duplicado intencional por database-per-service: la implementacion canonica
 * vive en `services/user-service/src/lib/tokens.ts`.
 */
function getSecret(): string {
  const secret = process.env.AUTH_JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "test") {
    return "test-secret-for-unit-tests-only-32b!";
  }
  throw new Error("AUTH_JWT_SECRET must be set (min 32 chars)");
}

export function verifyAccessToken(token: string): AuthClaims {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new AppError(401, "Invalid token", "Unauthorized");
  }
  const [header, payload, signature] = parts;
  const expected = createHmac("sha256", getSecret())
    .update(`${header}.${payload}`)
    .digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new AppError(401, "Invalid token", "Unauthorized");
  }
  const claims = JSON.parse(
    Buffer.from(payload, "base64url").toString("utf8")
  ) as AuthClaims;
  if (!claims.sub || !claims.exp || Date.now() / 1000 > claims.exp) {
    throw new AppError(401, "Token expired", "Unauthorized");
  }
  return claims;
}

export interface AuthRequest extends Request {
  auth?: AuthClaims;
}

/** Exige un access token valido y lo deja en `req.auth`. */
export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new AppError(401, "Missing bearer token", "Unauthorized");
    }
    (req as AuthRequest).auth = verifyAccessToken(
      header.slice("Bearer ".length).trim()
    );
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Adjunta el actor si hay un Bearer valido; sin token sigue anonimo.
 * Para el alta anonima con `booked_by_user_id` opcional.
 */
export function attachAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const header = req.headers.authorization;
    if (header && header.startsWith("Bearer ")) {
      (req as AuthRequest).auth = verifyAccessToken(
        header.slice("Bearer ".length).trim()
      );
    }
    next();
  } catch {
    next();
  }
}
