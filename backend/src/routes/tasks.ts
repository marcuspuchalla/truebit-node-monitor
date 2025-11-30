import express, { Router, Request, Response } from 'express';
import type TruebitDatabase from '../db/database.js';

const router: Router = express.Router();

interface TaskRow {
  id: number;
  execution_id: string;
  chain_id: string | null;
  block_number: number | null;
  block_hash: string | null;
  task_hash: string | null;
  task_type: string | null;
  status: string;
  received_at: string;
  started_at: string | null;
  completed_at: string | null;
  elapsed_ms: number | null;
  gas_used: number | null;
  exit_code: number | null;
  cached: number | null;
}

/**
 * Format task data for local API responses
 * Note: For federation, the anonymizer strips sensitive data separately
 */
function formatTaskForAPI(task: TaskRow): Record<string, unknown> {
  return {
    id: task.id,
    execution_id: task.execution_id,
    chain_id: task.chain_id,
    block_number: task.block_number,
    block_hash: task.block_hash,
    task_hash: task.task_hash,
    task_type: task.task_type,
    status: task.status,
    received_at: task.received_at,
    started_at: task.started_at,
    completed_at: task.completed_at,
    elapsed_ms: task.elapsed_ms,
    gas_used: task.gas_used,
    exit_code: task.exit_code,
    cached: task.cached
  };
}

export function createTasksRouter(db: TruebitDatabase): Router {
  // Get all tasks (paginated)
  router.get('/', (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const status = (req.query.status as string) || null;

      const tasks = db.getTasks(limit, offset, status) as TaskRow[];

      res.json({
        tasks: tasks.map(task => formatTaskForAPI(task)),
        pagination: {
          limit,
          offset,
          hasMore: tasks.length === limit
        }
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get specific task
  router.get('/:executionId', (req: Request, res: Response) => {
    try {
      const task = db.getTask(req.params.executionId) as TaskRow | undefined;

      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      res.json(formatTaskForAPI(task));
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get task statistics
  router.get('/stats/summary', (req: Request, res: Response) => {
    try {
      const stats = db.getTaskStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  return router;
}

export default createTasksRouter;
