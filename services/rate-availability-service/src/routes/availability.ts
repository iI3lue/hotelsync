import { Router } from "express";
import { availabilityController } from "../controllers/availability.controller.js";
import { validate } from "../middleware/validate.js";
import { availabilityQuerySchema } from "../validators/availability.js";

const router = Router();

router.get(
  "/",
  validate(availabilityQuerySchema, "query"),
  availabilityController.get.bind(availabilityController)
);

export default router;