import express from 'express';

const router = express.Router();

/**
 * Format task data for local API responses
 * Note: For federation, the anonymizer strips sensitive data separately
 */
function formatTaskForAPI(task) {
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

export function createTasksRouter(db) {
  // Get all tasks (paginated)
  router.get('/', (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;
      const status = req.query.status || null;

      const tasks = db.getTasks(limit, offset, status);

      res.json({
        tasks: tasks.map(task => formatTaskForAPI(task)),
        pagination: {
          limit,
          offset,
          hasMore: tasks.length === limit
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get specific task
  router.get('/:executionId', (req, res) => {
    try {
      const task = db.getTask(req.params.executionId);

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      res.json(formatTaskForAPI(task));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get task statistics
  router.get('/stats/summary', (req, res) => {
    try {
      const stats = db.getTaskStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

export default createTasksRouter;
