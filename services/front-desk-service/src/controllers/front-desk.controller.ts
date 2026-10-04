import { Request, Response, NextFunction } from "express";
import {
  frontDeskService,
  incidentService,
} from "../services/front-desk.service.js";
import { AuthRequest } from "../lib/auth.js";

export class FrontDeskController {
  async arrivals(req: Request, res: Response, next: NextFunction) {
    try {
      const arrivals = await frontDeskService.getArrivals(req.query as never);
      res.json(arrivals);
    } catch (err) {
      next(err);
    }
  }

  async checkIn(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = (req as AuthRequest).auth;
      const assignment = await frontDeskService.checkIn(
        req.body,
        auth ?? { sub: "", email: "", role: "", hotel_id: null, scope: "global", iat: 0, exp: 0 }
      );
      res.status(201).json(assignment);
    } catch (err) {
      next(err);
    }
  }

  async checkOut(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = (req as AuthRequest).auth;
      const assignment = await frontDeskService.checkOut(
        req.body,
        auth ?? { sub: "", email: "", role: "", hotel_id: null, scope: "global", iat: 0, exp: 0 }
      );
      res.json(assignment);
    } catch (err) {
      next(err);
    }
  }
}

export class IncidentController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { booking_id } = req.query as { booking_id?: string };
      const incidents = await incidentService.list(booking_id);
      res.json(incidents);
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const incident = await incidentService.create(req.body);
      res.status(201).json(incident);
    } catch (err) {
      next(err);
    }
  }

  async setStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const incident = await incidentService.setStatus(id, req.body.status);
      res.json(incident);
    } catch (err) {
      next(err);
    }
  }
}

export const frontDeskController = new FrontDeskController();
export const incidentController = new IncidentController();
