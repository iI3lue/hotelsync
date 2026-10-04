import { Router } from "express";
import { frontDeskController } from "../controllers/front-desk.controller.js";
import { requireAuth, requireRole } from "../lib/auth.js";
import { validate } from "../middleware/validate.js";
import { checkInSchema } from "../validators/front-desk.js";

const router = Router();

const requireDesk = requireRole("RECEPTIONIST", "MANAGER", "SUPER_ADMIN");

router.post(
  "/",
  requireAuth,
  requireDesk,
  validate(checkInSchema),
  frontDeskController.checkIn.bind(frontDeskController)
);

export default router;
