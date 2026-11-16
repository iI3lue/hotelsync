import { Router } from "express";
import type { Request } from "express";
import { authController } from "../controllers/auth.controller.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { validate } from "../middleware/validate.js";
import {
  federatedSchema,
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  requestCodeSchema,
  resetPasswordSchema,
} from "../validators/auth.js";

const router = Router();

const LOGIN_WINDOW_MS = 15 * 60 * 1000;

const loginByIp = rateLimit({
  key: (req: Request) => `login:ip:${req.ip ?? "unknown"}`,
  max: 20,
  windowMs: LOGIN_WINDOW_MS,
});

const loginByEmail = rateLimit({
  key: (req: Request) => {
    const email = (req.body as { email?: unknown } | undefined)?.email;
    const normalized =
      typeof email === "string" ? email.trim().toLowerCase() : "unknown";
    return `login:email:${normalized}`;
  },
  max: 5,
  windowMs: LOGIN_WINDOW_MS,
});

const registerByIp = rateLimit({
  key: (req: Request) => `register:ip:${req.ip ?? "unknown"}`,
  max: 5,
  windowMs: 60 * 60 * 1000,
});

router.post(
  "/register",
  registerByIp,
  validate(registerSchema),
  authController.register.bind(authController)
);
router.post("/password/forgot", validate(forgotPasswordSchema), authController.forgotPassword.bind(authController));
router.post("/password/reset", validate(resetPasswordSchema), authController.resetPassword.bind(authController));
router.post("/password/code", validate(requestCodeSchema), authController.requestCode.bind(authController));
router.post("/federated", validate(federatedSchema), authController.federated.bind(authController));
router.post(
  "/login",
  loginByIp,
  loginByEmail,
  validate(loginSchema),
  authController.login.bind(authController)
);
router.post("/refresh", validate(refreshSchema), authController.refresh.bind(authController));
router.post("/logout", validate(logoutSchema), authController.logout.bind(authController));

export default router;
