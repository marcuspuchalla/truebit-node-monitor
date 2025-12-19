import express, { Router, Request, Response, NextFunction } from 'express';
import type TruebitDatabase from '../db/database.js';

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

interface LogsRouterConfig {
  validateSessionToken?: (token: string) => boolean;
  getLogStatus?: () => { source: string | null; lastLogAt: string | null };
}

export function createLogsRouter(db: TruebitDatabase, config: LogsRouterConfig = {}): Router {
  const router: Router = express.Router();
  const { validateSessionToken, getLogStatus } = config;
  const requiresAuth = !!validateSessionToken;

  // Authentication middleware for logs endpoint - requires session token
  const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    if (!requiresAuth) {
      next();
      return;
    }

    const sessionToken = req.headers['x-session-token'] as string;
    if (sessionToken && validateSessionToken(sessionToken)) {
      next();
      return;
    }

    res.status(401).json({
      error: 'Authentication required',
      message: 'Logs access requires authentication. Please login first.'
    });
  };

  // Apply auth middleware to all routes
  router.use(authMiddleware);

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

  // Get log streaming status (source + last log time)
  router.get('/status', (_req: Request, res: Response) => {
    const status = getLogStatus ? getLogStatus() : { source: null, lastLogAt: null };
    res.json(status);
  });

  return router;
}

export default createLogsRouter;
