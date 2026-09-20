import { Router } from "express";
import { availabilityController } from "../controllers/availability.controller.js";
import { validate } from "../middleware/validate.js";
import { availabilityQuerySchema } from "../validators/availability.js";
import { reserveSchema, releaseSchema } from "../validators/reserve.js";

const router = Router();

router.get(
  "/",
  validate(availabilityQuerySchema, "query"),
  availabilityController.get.bind(availabilityController)
);
router.post(
  "/reserve",
  validate(reserveSchema),
  availabilityController.reserve.bind(availabilityController)
);
router.post(
  "/release",
  validate(releaseSchema),
  availabilityController.release.bind(availabilityController)
);

export default router;
