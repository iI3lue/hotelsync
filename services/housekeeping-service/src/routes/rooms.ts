import { Router } from "express";
import { housekeepingController } from "../controllers/housekeeping.controller.js";
import { validate } from "../middleware/validate.js";
import {
  listRoomsQuerySchema,
  setRoomStatusSchema,
} from "../validators/housekeeping.js";

const router = Router();

router.get(
  "/",
  validate(listRoomsQuerySchema, "query"),
  housekeepingController.listRooms.bind(housekeepingController)
);
router.put(
  "/status",
  validate(setRoomStatusSchema),
  housekeepingController.setRoomStatus.bind(housekeepingController)
);

export default router;
