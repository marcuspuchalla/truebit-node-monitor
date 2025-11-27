import express from 'express';

const router = express.Router();

export function createInvoicesRouter(db) {
  // Get all invoices (paginated)
  router.get('/', (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;

      const invoices = db.getInvoices(limit, offset);

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
      res.status(500).json({ error: error.message });
    }
  });

  // Get invoice count
  router.get('/count', (req, res) => {
    try {
      const count = db.getInvoiceCount();
      res.json({ count });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

export default createInvoicesRouter;
