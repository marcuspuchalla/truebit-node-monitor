import express, { Router, Request, Response } from 'express';
import type TruebitDatabase from '../db/database.js';
import type DockerClient from '../docker/client.js';

const router: Router = express.Router();

export function createStatusRouter(db: TruebitDatabase, dockerClient: DockerClient): Router {
  // Get current node status
  router.get('/', async (req: Request, res: Response) => {
    try {
      const dbStatus = db.getNodeStatus();
      const containerInfo = await dockerClient.getContainerInfo();
      const containerStats = await dockerClient.getContainerStats();

      res.json({
        node: dbStatus,
        container: containerInfo,
        stats: containerStats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get node statistics
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const taskStats = db.getTaskStats();
      const invoiceCount = db.getInvoiceCount();
      const nodeStatus = db.getNodeStatus();

      res.json({
        tasks: taskStats,
        invoices: { total: invoiceCount },
        node: nodeStatus,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  return router;
}

export default createStatusRouter;
