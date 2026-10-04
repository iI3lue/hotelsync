import { Request, Response, NextFunction } from "express";
import { bookingService, BookingAccess } from "../services/booking.service.js";
import { AuthRequest } from "../lib/auth.js";

function accessFrom(req: Request): BookingAccess {
  return {
    actor: (req as AuthRequest).auth,
    token: (req.query as { token?: string }).token,
  };
}

export class BookingController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const bookings = await bookingService.list(req.query as never);
      res.json(bookings);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const booking = await bookingService.getByIdWithAccess(
        id,
        accessFrom(req)
      );
      res.json(booking);
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = (req as AuthRequest).auth;
      const booking = await bookingService.create(req.body, actor);
      res.status(201).json(booking);
    } catch (err) {
      next(err);
    }
  }

  async confirm(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const booking = await bookingService.confirm(id, accessFrom(req));
      res.json(booking);
    } catch (err) {
      next(err);
    }
  }

  async listMine(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = (req as AuthRequest).auth;
      const bookings = await bookingService.listByUser(
        auth?.sub as string,
        auth?.email as string
      );
      res.json(bookings);
    } catch (err) {
      next(err);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const booking = await bookingService.cancel(id, accessFrom(req));
      res.json(booking);
    } catch (err) {
      next(err);
    }
  }
}

export const bookingController = new BookingController();
