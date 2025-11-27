import express from 'express';

const router = express.Router();

export function createLogsRouter(db) {
  // Get logs (paginated, filterable)
  router.get('/', (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const offset = parseInt(req.query.offset) || 0;
      const level = req.query.level || null;
      const type = req.query.type || null;
      const search = req.query.search || null;

      const logs = db.getLogs(limit, offset, level, type, search);

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
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

export default createLogsRouter;
