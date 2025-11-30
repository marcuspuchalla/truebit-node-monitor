import express, { Router, Request, Response } from 'express';
import type TruebitDatabase from '../db/database.js';

const router: Router = express.Router();

interface LogRow {
  id: number;
  timestamp: string;
  timestamp_original: string | null;
  level: string;
  type: string | null;
  message: string;
  execution_id: string | null;
  data: string | null;
  created_at: string;
}

export function createLogsRouter(db: TruebitDatabase): Router {
  // Get logs (paginated, filterable)
  router.get('/', (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const level = (req.query.level as string) || null;
      const type = (req.query.type as string) || null;
      const search = (req.query.search as string) || null;

      const logs = db.getLogs(limit, offset, level, type, search) as LogRow[];

      res.json({
        logs: logs.map(log => ({
          ...log,
          data: log.data ? JSON.parse(log.data) : null
        })),
        pagination: {
          limit,
          offset,
          hasMore: logs.length === limit
        }
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  return router;
}

export default createLogsRouter;
