import express, { Router, Request, Response } from 'express';
import type TruebitDatabase from '../db/database.js';

const router: Router = express.Router();

interface InvoiceRow {
  id: number;
  timestamp: string;
  event_type: string | null;
  slot_used: number | null;
  details: string | null;
  created_at: string;
}

export function createInvoicesRouter(db: TruebitDatabase): Router {
  // Get all invoices (paginated)
  router.get('/', (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const invoices = db.getInvoices(limit, offset) as InvoiceRow[];

      res.json({
        invoices: invoices.map(invoice => ({
          ...invoice,
          details: invoice.details ? JSON.parse(invoice.details) : null
        })),
        pagination: {
          limit,
          offset,
          hasMore: invoices.length === limit
        }
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get invoice count
  router.get('/count', (req: Request, res: Response) => {
    try {
      const count = db.getInvoiceCount();
      res.json({ count });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  return router;
}

export default createInvoicesRouter;
