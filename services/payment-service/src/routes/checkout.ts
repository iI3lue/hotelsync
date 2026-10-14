import { Router } from "express";
import { checkout, checkoutStatus } from "../controllers/checkout.controller";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { CheckoutSchema } from "../validators/payment";

const router = Router();
router.use(requireAuth);
router.post("/", validate(CheckoutSchema), checkout);
router.get("/:bookingId", checkoutStatus);
export { router as checkoutRouter };
