import { Router } from "express";
import { registerManualPayment } from "../controllers/admin.controller";
import { requireAuth, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { FrontDeskPaymentSchema } from "../validators/payment";

const router = Router();
router.use(requireAuth, requireRole(["RECEPTIONIST", "MANAGER", "SUPER_ADMIN"]));
router.post("/payments", validate(FrontDeskPaymentSchema), registerManualPayment);
export { router as adminRouter };
