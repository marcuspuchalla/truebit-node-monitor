import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import DockerClient from './docker/client.js';
import EventDBReader from './docker/eventdb-reader.js';
import LogFileReader from './docker/logfile-reader.js';
import LogParser from './parsers/log-parser.js';
import TruebitDatabase from './db/database.js';
import TruebitWebSocketServer from './websocket/server.js';
import { createStatusRouter } from './routes/status.js';
import { createTasksRouter } from './routes/tasks.js';
import { createInvoicesRouter } from './routes/invoices.js';
import { createLogsRouter } from './routes/logs.js';
import { createFederationRouter } from './routes/federation.js';
import FederationClient from './federation/client.js';
import FederationAnonymizer from './federation/anonymizer.js';

dotenv.config();

const app = express();
const server = createServer(app);

// Configuration
const PORT = process.env.PORT || 8090;
const HOST = process.env.HOST || '0.0.0.0';
const CONTAINER_NAME = process.env.CONTAINER_NAME || 'runner-node';
const DB_PATH = process.env.DB_PATH || './data/truebit-monitor.db';
const DOCKER_SOCKET = process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:8090'];

// Helper function to hash node addresses for privacy
function hashNodeAddress(address) {
  if (!address) return null;
  return crypto.createHash('sha256').update(address).digest('hex').slice(0, 16);
}

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "wss://f.tru.watch:9086", "ws://localhost:*"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false // Allow loading external resources
}));

// CORS configuration - only allow specified origins
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Rate limiting - 100 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);

// Body parser with size limit
app.use(express.json({ limit: '1mb' }));

// Initialize components
const db = new TruebitDatabase(DB_PATH);
const dockerClient = new DockerClient(CONTAINER_NAME, DOCKER_SOCKET);
const logParser = new LogParser();
const wsServer = new TruebitWebSocketServer(server);

// Federation client holder (allows late initialization)
const federation = {
  client: null
};

// EventDBReader and LogFileReader will be initialized after dockerClient
let eventDBReader;
let logFileReader;

// Current task tracking (in-memory)
const activeTasks = new Map();

// Process parsed log
function processLog(parsed, broadcast = false) {
  if (!parsed) return;

  // Store ALL logs in database (including raw), skip duplicates silently
  try {
    db.insertLog({
      timestamp: parsed.timestamp?.toISOString() || new Date().toISOString(),
      timestampOriginal: parsed.timestampOriginal || null,
      level: parsed.level || 'info',
      type: parsed.type,
      message: parsed.message || parsed.raw || '',
      executionId: parsed.executionId || null,
      data: parsed.data || null
    });
  } catch (error) {
    // Silently ignore all database errors during log insert (likely duplicates)
    // Don't log these errors to avoid spam during historical log processing
  }

  // Only broadcast to WebSocket if requested (for real-time logs)
  if (broadcast) {
    wsServer.sendLog(parsed);
  }

  // Handle specific event types (skip for raw logs)
  if (parsed.type === 'raw') return;

  switch (parsed.type) {
    case 'task_received':
      handleTaskReceived(parsed);
      break;

    case 'task_start':
      handleTaskStart(parsed);
      break;

    case 'task_completed':
      handleTaskCompleted(parsed);
      break;

    case 'execution_output':
      handleExecutionOutput(parsed);
      break;

    case 'invoice':
      handleInvoice(parsed);
      break;

    case 'semaphore':
      handleSemaphore(parsed);
      break;

    case 'registration':
      handleRegistration(parsed);
      break;
  }
}

function handleTaskReceived(parsed) {
  if (!parsed.executionId || !parsed.data) return;

  const taskData = parsed.data.payload || parsed.data;

  try {
    // Extract task information
    const task = {
      executionId: parsed.executionId,
      receivedAt: parsed.timestamp.toISOString(),
      status: 'received',
      taskType: taskData.taskType || 'unknown',
      taskHash: taskData.taskHash || taskData.taskPath,
      chainId: taskData.chainId,
      blockNumber: taskData.blockNumber,
      blockHash: taskData.blockHash,
      inputData: taskData.input ? JSON.parse(taskData.input) : null
    };

    // Store in database (ignore if duplicate)
    try {
      db.insertTask(task);
    } catch (dbError) {
      if (!dbError.message.includes('UNIQUE constraint')) {
        throw dbError;
      }
      // Duplicate task, skip
      return;
    }

    // Track in memory
    activeTasks.set(parsed.executionId, task);

    // Broadcast task event
    wsServer.sendTask({ ...task, event: 'received' });

    // Publish to federation (if enabled and connected)
    if (federation.client && federation.client.isHealthy()) {
      const dbTask = db.getTask(task.executionId);
      if (dbTask) {
        federation.client.publishTaskReceived(dbTask).catch(err => {
          console.error('Failed to publish task to federation:', err.message);
        });
      }
    }

    console.log(`📥 Task received: ${parsed.executionId}`);
  } catch (error) {
    console.error('Error handling task received:', error.message);
  }
}

function handleTaskStart(parsed) {
  if (!parsed.executionId) return;

  try {
    db.updateTaskStart(parsed.executionId, parsed.timestamp.toISOString());

    const task = activeTasks.get(parsed.executionId);
    if (task) {
      task.status = 'executing';
      task.startedAt = parsed.timestamp.toISOString();
    }

    wsServer.sendTask({ executionId: parsed.executionId, event: 'started' });

    console.log(`▶️  Task started: ${parsed.executionId}`);
  } catch (error) {
    console.error('Error handling task start:', error.message);
  }
}

function handleTaskCompleted(parsed) {
  if (!parsed.executionId) return;

  const task = activeTasks.get(parsed.executionId);
  if (task) {
    task.status = 'completed';
    task.completedAt = parsed.timestamp.toISOString();
    activeTasks.delete(parsed.executionId);
  }

  wsServer.sendTask({ executionId: parsed.executionId, event: 'completed' });

  // Publish to federation (if enabled and connected)
  if (federation.client && federation.client.isHealthy()) {
    const dbTask = db.getTask(parsed.executionId);
    if (dbTask && dbTask.completed_at) {
      federation.client.publishTaskCompleted(dbTask).catch(err => {
        console.error('Failed to publish task completion to federation:', err.message);
      });
    }
  }

  console.log(`✅ Task completed: ${parsed.executionId}`);
}

function handleExecutionOutput(parsed) {
  if (!parsed.data) return;

  // Find the most recent active task (if execution ID not in parsed)
  let executionId = parsed.executionId;

  if (!executionId && activeTasks.size > 0) {
    // Get the most recently added task
    const tasks = Array.from(activeTasks.values());
    executionId = tasks[tasks.length - 1]?.executionId;
  }

  if (!executionId) return;

  try {
    const metrics = logParser.parseExecutionMetrics(parsed.data);

    if (metrics) {
      db.updateTaskComplete(executionId, {
        completedAt: new Date().toISOString(),
        status: metrics.exitCode === 0 ? 'completed' : 'failed',
        elapsedMs: metrics.elapsed,
        gasLimit: metrics.gas?.limit,
        gasUsed: metrics.gas?.used,
        memoryLimit: metrics.memory?.limit,
        memoryPeak: metrics.memory?.peak,
        exitCode: metrics.exitCode,
        cached: metrics.cached
      });

      wsServer.sendTask({
        executionId,
        event: 'metrics',
        metrics
      });

      console.log(`📊 Task metrics: ${executionId} - ${metrics.elapsed.toFixed(2)}ms`);
    }
  } catch (error) {
    console.error('Error handling execution output:', error.message);
  }
}

function handleInvoice(parsed) {
  // Only create invoice records if we have actual invoice data
  // Invoice-related semaphore messages don't contain invoice details
  if (!parsed.data) {
    return;
  }

  try {
    const invoice = {
      timestamp: parsed.timestamp.toISOString(),
      eventType: 'invoice_received',
      slotUsed: parsed.semaphore?.current || null,
      details: parsed.data
    };

    db.insertInvoice(invoice);
    wsServer.sendInvoice(invoice);

    console.log(`💰 Invoice event received`);
  } catch (error) {
    console.error('Error handling invoice:', error.message);
  }
}

function handleSemaphore(parsed) {
  if (!parsed.semaphore) return;

  try {
    const { current, total } = parsed.semaphore;
    db.updateNodeSlots(current, total);
    wsServer.sendSemaphore({ current, total, action: parsed.semaphore.action });

    console.log(`🔄 Semaphore: ${current}/${total} slots`);
  } catch (error) {
    console.error('Error handling semaphore:', error.message);
  }
}

function handleRegistration(parsed) {
  if (!parsed.nodeAddress) return;

  try {
    // Hash node address for privacy in logs
    const hashedAddress = hashNodeAddress(parsed.nodeAddress);

    const status = {
      address: parsed.nodeAddress, // Store real address in DB
      version: parsed.version,
      totalCores: 4, // Default, can be extracted from logs
      registered: parsed.message.includes('successfully'),
      lastSeen: parsed.timestamp.toISOString()
    };

    db.updateNodeStatus(status);
    wsServer.sendNodeStatus(status);

    // Log with hashed address for privacy
    console.log(`🔗 Node registration: ${hashedAddress}...`);
  } catch (error) {
    console.error('Error handling registration:', error.message);
  }
}

// API Routes
app.use('/api/status', createStatusRouter(db, dockerClient));
app.use('/api/tasks', createTasksRouter(db));
app.use('/api/invoices', createInvoicesRouter(db));
app.use('/api/logs', createLogsRouter(db));
// Federation route is registered in start() after client is created

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    docker: dockerClient.container ? 'connected' : 'disconnected'
  });
});

// Static files and catch-all are set up in start() after all API routes

// Initialize and start
async function start() {
  try {
    console.log('🚀 Starting TrueBit Monitor...\n');

    // Initialize database
    await db.initialize();

    // Initialize federation settings
    const anonymizer = new FederationAnonymizer();
    const credentials = anonymizer.getNodeCredentials();
    db.initializeFederationSettings(credentials.nodeId, credentials.salt);

    // Function to create/recreate federation client
    const createFederationClient = async () => {
      const fedSettings = db.getFederationSettings();
      if (!fedSettings) return;

      federation.client = new FederationClient({
        nodeId: fedSettings.node_id,
        salt: fedSettings.salt,
        servers: fedSettings.nats_servers ? JSON.parse(fedSettings.nats_servers) : [],
        token: fedSettings.nats_token,
        tls: !!fedSettings.tls_enabled
      });

      // Set up federation message handlers
      federation.client.on('message', ({ subject, data }) => {
        try {
          // Store received message
          db.insertFederationMessage(data);

          // Update peer information
          if (data.nodeId) {
            db.upsertFederationPeer(data.nodeId);
          }

          // Broadcast to WebSocket clients (optional)
          wsServer.broadcast('federation_message', data);
        } catch (error) {
          console.error('Error handling federation message:', error.message);
        }
      });

      console.log(`🌐 Federation client created with servers: ${fedSettings.nats_servers || '(none configured)'}`);
    };

    // Create initial federation client
    await createFederationClient();

    // Register federation routes with recreateClient callback
    app.use('/api/federation', createFederationRouter(db, federation, createFederationClient));

    // NOW register static files and catch-all (AFTER all API routes)
    const frontendPath = path.join(__dirname, '..', 'public');
    app.use(express.static(frontendPath));

    // Catch-all route for client-side routing (Vue Router) - must be LAST
    app.get('*', (req, res) => {
      res.sendFile(path.join(frontendPath, 'index.html'));
    });

    // Auto-connect if federation is enabled and servers are configured
    const fedSettings = db.getFederationSettings();
    if (fedSettings?.enabled && fedSettings?.nats_servers) {
      const servers = JSON.parse(fedSettings.nats_servers);
      if (servers.length > 0) {
        console.log('🌐 Federation is enabled, connecting...');
        try {
          await federation.client.connect();

          // Subscribe to all federation messages
          await federation.client.subscribeToFederation({
            taskReceived: (data) => console.log('📨 Federation: Task received from', data.nodeId),
            taskCompleted: (data) => console.log('✅ Federation: Task completed by', data.nodeId),
            heartbeat: (data) => console.log('💓 Federation: Heartbeat from', data.nodeId)
          });
        } catch (error) {
          console.error('⚠️  Failed to connect to federation:', error.message);
        }
      }
    }

    // Check Docker connection
    const dockerOk = await dockerClient.ping();
    if (!dockerOk) {
      throw new Error('Docker daemon is not accessible');
    }

    // Initialize Docker client
    await dockerClient.initialize();

    // Initialize readers with container object
    eventDBReader = new EventDBReader(dockerClient.container);
    logFileReader = new LogFileReader(dockerClient.container);

    // Get container info and update node status
    const containerInfo = await dockerClient.getContainerInfo();
    if (containerInfo.startedAt) {
      db.updateNodeStartTime(containerInfo.startedAt);
    }

    // === STEP 1: Process EventDB (Structured JSON) ===
    console.log('📊 Reading EventDB (structured data)...');
    const eventDB = await eventDBReader.readEventDB();
    const parsedEvents = eventDBReader.parseEventDB(eventDB);

    console.log(`   Tasks: ${parsedEvents.tasks.length}`);
    console.log(`   Outcomes: ${parsedEvents.outcomes.length}`);
    console.log(`   Invoices: ${parsedEvents.invoices.length}`);

    // Process EventDB tasks
    for (const task of parsedEvents.tasks) {
      try {
        db.insertTask({
          executionId: task.executionId,
          receivedAt: task.timestamp.toISOString(),
          status: 'received',
          taskType: task.taskId,
          taskHash: task.taskId,
          chainId: task.chainId,
          blockNumber: task.blockNumber,
          blockHash: task.blockHash,
          inputData: task.input
        });
        console.log(`   ✓ Imported task: ${task.executionId}`);
      } catch (error) {
        if (!error.message.includes('UNIQUE')) {
          console.error(`   ✗ Failed to import task: ${error.message}`);
        }
      }
    }

    // Process EventDB outcomes
    for (const outcome of parsedEvents.outcomes) {
      try {
        db.updateTaskComplete(outcome.executionId, {
          completedAt: new Date().toISOString(),
          status: 'completed'
        });
      } catch (error) {
        // Task might not exist yet, skip
      }
    }

    // Process EventDB invoices
    for (const invoice of parsedEvents.invoices) {
      try {
        db.insertInvoice({
          timestamp: invoice.taskCreatedTimestamp.toISOString(),
          eventType: 'invoice',
          slotUsed: null,
          details: invoice
        });

        // Update task with execution metrics
        if (invoice.executionId && invoice.totalStepsComputed) {
          db.updateTaskComplete(invoice.executionId, {
            completedAt: invoice.taskCreatedTimestamp.toISOString(),
            status: 'completed',
            gasUsed: invoice.totalStepsComputed,
            memoryPeak: invoice.peakMemoryUsed
          });
        }

        console.log(`   ✓ Imported invoice: ${invoice.invoiceId}`);
      } catch (error) {
        if (!error.message.includes('UNIQUE')) {
          console.error(`   ✗ Failed to import invoice: ${error.message}`);
        }
      }
    }

    console.log();

    // === STEP 2: Process Historical Log Files ===
    console.log('📁 Reading historical log files (.log.gz)...');
    const historicalLogs = await logFileReader.readHistoricalLogs();
    const historicalLines = historicalLogs.split('\n').filter(line => line.trim());

    console.log(`   Aggregating ${historicalLines.length} historical log lines...`);
    const aggregatedHistorical = logParser.aggregateLines(historicalLines);

    console.log(`   Processing ${aggregatedHistorical.length} aggregated log entries...`);
    let historicalProcessed = 0;

    for (const line of aggregatedHistorical) {
      const parsed = logParser.parseLine(line);
      if (parsed) {
        processLog(parsed, false); // Don't broadcast historical logs
        historicalProcessed++;
      }
    }

    console.log(`   ✓ Processed ${historicalProcessed} historical log entries`);
    console.log();

    // === STEP 3: Process Current Day Log ===
    console.log('📄 Reading current day log file...');
    const currentLog = await logFileReader.readCurrentLog(200);
    const currentLines = currentLog.split('\n').filter(line => line.trim());

    console.log(`   Aggregating ${currentLines.length} current log lines...`);
    const aggregatedCurrent = logParser.aggregateLines(currentLines);

    console.log(`   Processing ${aggregatedCurrent.length} aggregated log entries...`);
    let currentProcessed = 0;

    for (const line of aggregatedCurrent) {
      const parsed = logParser.parseLine(line);
      if (parsed) {
        processLog(parsed, false);
        currentProcessed++;
      }
    }

    console.log(`   ✓ Processed ${currentProcessed} current log entries`);
    console.log();

    // === STEP 4: Start Real-time Monitoring ===
    console.log('🔴 Starting real-time log monitoring...');

    // Buffer for real-time log aggregation
    let lineBuffer = '';

    // Tail current log file for new entries
    logFileReader.on('line', (logLine) => {
      const cleanLine = logLine
        .replace(/\x1b\[[0-9;]*m/g, '') // Remove ANSI codes
        .replace(/^runner-node\s+\|\s+/, ''); // Remove container prefix

      // Check if this line starts with a timestamp (new log entry)
      const hasTimestamp = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(cleanLine);

      if (hasTimestamp) {
        // Process buffered entry if exists
        if (lineBuffer) {
          const parsed = logParser.parseLine(lineBuffer);
          if (parsed) {
            processLog(parsed, true); // Broadcast real-time logs
          }
        }
        // Start new buffer with this line
        lineBuffer = logLine;
      } else if (lineBuffer) {
        // Continuation line - append to buffer
        lineBuffer += '\n' + logLine;
      }
    });

    logFileReader.tailCurrentLog();
    console.log('   ✓ Tailing current log file for real-time updates');
    console.log();

    // Start server
    server.listen(PORT, HOST, () => {
      console.log(`\n✅ TrueBit Monitor running!`);
      console.log(`   📡 API Server: http://${HOST}:${PORT}`);
      console.log(`   🔌 WebSocket: ws://${HOST}:${PORT}`);
      console.log(`   🐳 Container: ${CONTAINER_NAME}`);
      console.log(`   💾 Database: ${DB_PATH}\n`);
    });

    // Cleanup on exit
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down...');
      logFileReader.stopTailing();
      if (federation.client) await federation.client.disconnect();
      db.close();
      wsServer.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Shutting down...');
      logFileReader.stopTailing();
      if (federation.client) await federation.client.disconnect();
      db.close();
      wsServer.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start:', error.message);
    process.exit(1);
  }
}

start();
