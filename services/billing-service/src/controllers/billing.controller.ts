import { Request, Response, NextFunction } from "express";
import { billingService } from "../services/billing.service.js";

export class BillingController {
  async listFolios(req: Request, res: Response, next: NextFunction) {
    try {
      const folios = await billingService.listFolios(req.query as never);
      res.json(folios);
    } catch (err) {
      next(err);
    }
  }

  async getFolio(req: Request, res: Response, next: NextFunction) {
    try {
      const folio = await billingService.getFolio(req.params.id as string);
      res.json(folio);
    } catch (err) {
      next(err);
    }
  }

  async addCharge(req: Request, res: Response, next: NextFunction) {
    try {
      const charge = await billingService.addCharge(
        req.params.id as string,
        req.body
      );
      res.status(201).json(charge);
    } catch (err) {
      next(err);
    }
  }

  async closeFolio(req: Request, res: Response, next: NextFunction) {
    try {
      const invoice = await billingService.closeFolio(
        req.params.id as string,
        req.body
      );
      res.json(invoice);
    } catch (err) {
      next(err);
    }
  }

  async listInvoices(req: Request, res: Response, next: NextFunction) {
    try {
      const invoices = await billingService.listInvoices(req.query as never);
      res.json(invoices);
    } catch (err) {
      next(err);
    }
  }

  async getInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const invoice = await billingService.getInvoice(req.params.id as string);
      res.json(invoice);
    } catch (err) {
      next(err);
    }
  }
}

export const billingController = new BillingController();
