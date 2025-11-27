import express from 'express';

const router = express.Router();

export function createStatusRouter(db, dockerClient) {
  // Get current node status
  router.get('/', async (req, res) => {
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
      res.status(500).json({ error: error.message });
    }
  });

  // Get node statistics
  router.get('/stats', async (req, res) => {
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
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

export default createStatusRouter;
