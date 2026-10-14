import { Request, Response, NextFunction } from "express";
import { processFrontDeskPayment } from "../services/payment.service";

export const registerManualPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { booking_id, method } = req.body;
    const tx = await processFrontDeskPayment(booking_id, method, "FRONT_DESK");
    res.status(201).json({ data: tx });
  } catch (error) {
    next(error);
  }
};
