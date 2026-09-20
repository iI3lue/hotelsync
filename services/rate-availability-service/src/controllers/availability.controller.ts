import { Request, Response, NextFunction } from "express";
import { inventoryService } from "../services/inventory.service.js";

export class AvailabilityController {
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const { room_type_id, date } = req.query as { room_type_id: string; date: string };
      const availability = await inventoryService.getAvailability(room_type_id, date);
      res.json(availability);
    } catch (err) {
      next(err);
    }
  }
}

export const availabilityController = new AvailabilityController();