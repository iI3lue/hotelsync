import { Request, Response, NextFunction } from "express";
import { getPaymentByBooking, processWebPayment } from "../services/payment.service";

export const checkout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { booking_id, card } = req.body;
    const tx = await processWebPayment(userId, booking_id, card);
    res.status(201).json({ data: tx });
  } catch (error) {
    next(error);
  }
};

export const checkoutStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tx = await getPaymentByBooking(req.params.bookingId);
    if (!tx) {
      res.status(404).json({ error: "NotFound", message: "Sin pagos para esta reserva", statusCode: 404 });
      return;
    }
    res.json({ data: tx });
  } catch (error) {
    next(error);
  }
};
