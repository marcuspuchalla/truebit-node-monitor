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
  input_data: string | null;
  output_data: string | null;
}

interface TasksRouterConfig {
  validateSessionToken?: (token: string) => boolean;
  readArtifactFile?: (path: string, maxBytes: number) => Promise<Buffer>;
  maxArtifactBytes?: number;
}

/**
 * Format task data for local API responses
 * Note: For federation, the anonymizer strips sensitive data separately
 * Input/output data is LOCAL ONLY and never sent to federation
 */
function formatTaskForAPI(task: TaskRow, includeInputOutput = false): Record<string, unknown> {
  const formatted: Record<string, unknown> = {
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

  // Include input/output data for individual task view (LOCAL ONLY - never sent to federation)
  if (includeInputOutput) {
    if (task.input_data) {
      try {
        formatted.inputData = JSON.parse(task.input_data);
      } catch {
        formatted.inputData = task.input_data;
      }
    }
    if (task.output_data) {
      try {
        formatted.outputData = JSON.parse(task.output_data);
      } catch {
        formatted.outputData = task.output_data;
      }
    }
  }

  return formatted;
}

export function createTasksRouter(db: TruebitDatabase, config: TasksRouterConfig = {}): Router {
  const { validateSessionToken, readArtifactFile, maxArtifactBytes } = config;
  const requiresAuth = !!validateSessionToken;

  // Helper to validate authentication via session token
  const isAuthenticated = (req: Request): boolean => {
    if (!validateSessionToken) return false;
    const sessionToken = req.headers['x-session-token'] as string;
    return !!(sessionToken && validateSessionToken(sessionToken));
  };

  // Get all tasks (paginated) - does NOT include input/output data
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

  // Get specific task - basic info without sensitive data
  router.get('/:executionId', (req: Request, res: Response) => {
    try {
      const task = db.getTask(req.params.executionId) as TaskRow | undefined;

      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      // Return basic task info without input/output
      // Also indicate if sensitive data is available and whether auth is required
      const response = formatTaskForAPI(task, false);
      response.hasSensitiveData = !!(task.input_data || task.output_data);
      response.sensitiveDataRequiresAuth = requiresAuth;

      res.json(response);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get sensitive task data (input/output) - requires authentication if TASK_DATA_PASSWORD is set
  router.get('/:executionId/data', (req: Request, res: Response) => {
    try {
      // Check authentication if required
      if (requiresAuth && !isAuthenticated(req)) {
        res.status(401).json({
          error: 'Authentication required',
          message: 'Please provide a valid session token via X-Session-Token header or authenticate via the login page'
        });
        return;
      }

      const task = db.getTask(req.params.executionId) as TaskRow | undefined;

      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      // Return only the sensitive data
      const sensitiveData: Record<string, unknown> = {
        execution_id: task.execution_id
      };

      if (task.input_data) {
        try {
          sensitiveData.inputData = JSON.parse(task.input_data);
        } catch {
          sensitiveData.inputData = task.input_data;
        }
      }

      if (task.output_data) {
        try {
          sensitiveData.outputData = JSON.parse(task.output_data);
        } catch {
          sensitiveData.outputData = task.output_data;
        }
      }

      res.json(sensitiveData);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get task artifacts metadata (e.g., wasm hashes) - requires authentication
  router.get('/:executionId/artifacts', (req: Request, res: Response) => {
    try {
      if (requiresAuth && !isAuthenticated(req)) {
        res.status(401).json({
          error: 'Authentication required',
          message: 'Artifacts access requires authentication.'
        });
        return;
      }

      const artifacts = db.getTaskArtifacts(req.params.executionId);
      res.json({ artifacts });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Download a specific artifact by hash - requires authentication
  router.get('/:executionId/artifacts/:hash', async (req: Request, res: Response) => {
    try {
      if (requiresAuth && !isAuthenticated(req)) {
        res.status(401).json({
          error: 'Authentication required',
          message: 'Artifacts access requires authentication.'
        });
        return;
      }

      const hash = req.params.hash;
      if (!/^[a-f0-9]{64}$/i.test(hash)) {
        res.status(400).json({ error: 'Invalid artifact hash' });
        return;
      }

      const artifacts = db.getTaskArtifacts(req.params.executionId) as Array<{ hash?: string; path?: string }>;
      const artifact = artifacts.find(a => a.hash?.toLowerCase() === hash.toLowerCase());
      if (!artifact || !artifact.path) {
        res.status(404).json({ error: 'Artifact not found' });
        return;
      }

      // Basic path safety: only allow wasm cache paths
      if (!artifact.path.startsWith('/app/build/wasm-files/')) {
        res.status(403).json({ error: 'Artifact path not allowed' });
        return;
      }

      if (!readArtifactFile) {
        res.status(501).json({ error: 'Artifact download not configured' });
        return;
      }

      const maxBytes = maxArtifactBytes || 20 * 1024 * 1024;
      const data = await readArtifactFile(artifact.path, maxBytes);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Length', data.length);
      res.send(data);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Check if user is authenticated (used to validate session tokens)
  router.get('/auth/status', (req: Request, res: Response) => {
    const authenticated = isAuthenticated(req);
    res.json({
      authenticated,
      authRequired: requiresAuth,
      message: authenticated
        ? 'Session token is valid.'
        : requiresAuth
          ? 'Authentication required. Please login to get a session token.'
          : 'Authentication not configured.'
    });
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
