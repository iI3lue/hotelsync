import { Request, Response, NextFunction } from "express";
import { housekeepingService } from "../services/housekeeping.service.js";
import { AuthRequest } from "../lib/auth.js";

export class HousekeepingController {
  async listTasks(req: Request, res: Response, next: NextFunction) {
    try {
      const tasks = await housekeepingService.listTasks(req.query as never);
      res.json(tasks);
    } catch (err) {
      next(err);
    }
  }

  async listMine(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = (req as AuthRequest).auth;
      const tasks = await housekeepingService.listMine(
        auth?.sub as string,
        req.query as never
      );
      res.json(tasks);
    } catch (err) {
      next(err);
    }
  }

  async assignTask(req: Request, res: Response, next: NextFunction) {
    try {
      const task = await housekeepingService.assignTask(
        req.params.id as string,
        req.body,
        req.headers.authorization
      );
      res.json(task);
    } catch (err) {
      next(err);
    }
  }

  async startTask(req: Request, res: Response, next: NextFunction) {
    try {
      const task = await housekeepingService.startTask(req.params.id as string);
      res.json(task);
    } catch (err) {
      next(err);
    }
  }

  async completeTask(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = (req as AuthRequest).auth;
      const task = await housekeepingService.completeTask(
        req.params.id as string,
        auth?.sub,
        auth
      );
      res.json(task);
    } catch (err) {
      next(err);
    }
  }

  async listRoomStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const rooms = await housekeepingService.listRoomStatus(req.query as never);
      res.json(rooms);
    } catch (err) {
      next(err);
    }
  }

  async setRoomStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const room = await housekeepingService.setRoomStatus(
        req.params.id as string,
        req.body
      );
      res.json(room);
    } catch (err) {
      next(err);
    }
  }
}

export const housekeepingController = new HousekeepingController();
