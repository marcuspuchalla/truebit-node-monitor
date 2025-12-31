import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import DockerClient from './docker/client.js';
import EventDBReader from './docker/eventdb-reader.js';
import LogFileReader from './docker/logfile-reader.js';
import LogParser, { type ParsedLog } from './parsers/log-parser.js';
import TruebitDatabase, { type Task, type NodeStatus } from './db/database.js';
import TruebitWebSocketServer from './websocket/server.js';
import { createStatusRouter } from './routes/status.js';
import { createTasksRouter } from './routes/tasks.js';
import { createInvoicesRouter } from './routes/invoices.js';
import { createLogsRouter } from './routes/logs.js';
import { createFederationRouter } from './routes/federation.js';
import { createTokenRouter } from './routes/token.js';
import { createAnalyticsRouter } from './routes/analytics.js';
import { analyticsService } from './services/analyticsService.js';
import TokenService from './services/tokenService.js';
import FederationClient from './federation/client.js';
import FederationAnonymizer from './federation/anonymizer.js';
import { resolveLocationBucket } from './utils/location.js';

dotenv.config();

const app = express();
const server = createServer(app);

// Trust first proxy (Traefik/nginx) - required for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Configuration
const PORT = process.env.PORT || 8090;
const HOST = process.env.HOST || '0.0.0.0';
const CONTAINER_NAME = process.env.CONTAINER_NAME || 'runner-node';
const DB_PATH = process.env.DB_PATH || './data/truebit-monitor.db';
const DOCKER_SOCKET = process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock';
const MAX_OUTPUT_DATA_BYTES = parseInt(process.env.MAX_OUTPUT_DATA_BYTES || '102400', 10); // 100KB
const WASM_HASH_PATTERN = /^[a-f0-9]{64}$/i;
const NODE_CONTINENT = process.env.NODE_CONTINENT || '';

// CORS: Only allow same-origin by default. Set ALLOWED_ORIGINS env var for cross-origin access.
// Example: ALLOWED_ORIGINS=https://tru.watch,https://www.tru.watch
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || [];

// Security: API Authentication (optional, enabled via API_KEY env var)
// Default token provided for convenience - CHANGE IN PRODUCTION!
const API_KEY = process.env.API_KEY || 'truebit-monitor-default-key';
const API_AUTH_ENABLED = !!process.env.API_KEY; // Only enabled if explicitly set

// Security: Task data password (protects access to task input/output data)
// If not set via env var, generate a random one and display it at startup
const TASK_DATA_PASSWORD_FROM_ENV = process.env.TASK_DATA_PASSWORD;
const TASK_DATA_PASSWORD = TASK_DATA_PASSWORD_FROM_ENV || crypto.randomBytes(24).toString('base64');
const TASK_DATA_AUTH_ENABLED = true; // Always enabled - password is either from env or auto-generated

// Security: CSRF token (generated on startup, returned via /api/csrf-token)
const CSRF_SECRET = crypto.randomBytes(32).toString('hex');

// Security: Challenge-response auth - store active challenges with expiration
const authChallenges = new Map<string, { challenge: string; expiresAt: number }>();
const CHALLENGE_EXPIRY_MS = 60000; // 1 minute

// Security: Session tokens - issued on successful auth, used for protected API calls
// This replaces storing plaintext passwords on the client
const sessionTokens = new Map<string, { expiresAt: number }>();
const SESSION_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// Generate a secure session token
function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Validate a session token
function validateSessionToken(token: string): boolean {
  const session = sessionTokens.get(token);
  if (!session) return false;
  if (session.expiresAt < Date.now()) {
    sessionTokens.delete(token);
    return false;
  }
  return true;
}

// Cleanup expired challenges and sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of authChallenges.entries()) {
    if (value.expiresAt < now) {
      authChallenges.delete(key);
    }
  }
  for (const [key, value] of sessionTokens.entries()) {
    if (value.expiresAt < now) {
      sessionTokens.delete(key);
    }
  }
}, 30000); // Cleanup every 30 seconds

// Helper function to hash node addresses for privacy
function hashNodeAddress(address: string | undefined): string | null {
  if (!address) return null;
  return crypto.createHash('sha256').update(address).digest('hex').slice(0, 16);
}

// ===== AUDIT LOGGING =====
interface AuditLogEntry {
  timestamp: string;
  event: string;
  ip: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}

const auditLog: AuditLogEntry[] = [];
const MAX_AUDIT_LOG_SIZE = 1000;

function logAuditEvent(event: string, req: express.Request, details?: Record<string, unknown>): void {
  const entry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    event,
    ip: req.ip || req.socket.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent'),
    details
  };

  auditLog.push(entry);

  // Keep only last N entries
  if (auditLog.length > MAX_AUDIT_LOG_SIZE) {
    auditLog.shift();
  }

  // Log security-relevant events to console
  if (event.startsWith('AUTH_') || event.startsWith('SECURITY_')) {
    console.log(`[AUDIT] ${entry.timestamp} ${event} from ${entry.ip}`);
  }
}

// Security Middleware - Helmet with CSP
// CSP can be disabled via CSP_DISABLED=true for environments that inject tracking scripts
const isHttps = process.env.HTTPS_ENABLED === 'true';
const cspDisabled = process.env.CSP_DISABLED === 'true';
const isProduction = process.env.NODE_ENV === 'production';

// SECURITY: CSP configuration - stricter in production
// In development, 'unsafe-inline' and 'unsafe-eval' are allowed for Vue hot reload
// In production, these should be removed if possible (requires build-time nonce injection)
const cspDirectives = {
  defaultSrc: ["'self'"],
  // Production: Remove unsafe-eval if Vue build doesn't require it
  // Note: Pre-built Vue apps typically don't need eval, but check your build
  scriptSrc: isProduction
    ? ["'self'", "'unsafe-inline'"] // Production: no unsafe-eval
    : ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Development: allow for hot reload
  styleSrc: ["'self'", "'unsafe-inline'"], // Required for Tailwind
  imgSrc: ["'self'", "data:", "blob:"],
  fontSrc: ["'self'"],
  connectSrc: ["'self'", "ws:", "wss:"], // WebSocket connections
  frameAncestors: ["'none'"], // Prevent clickjacking
  formAction: ["'self'"],
  baseUri: ["'self'"],
  objectSrc: ["'none'"],
  scriptSrcAttr: ["'none'"],
  // Only upgrade insecure requests when behind HTTPS - critical for HTTP-only deployments
  ...(isHttps ? { upgradeInsecureRequests: [] } : {})
};

app.use(helmet({
  contentSecurityPolicy: cspDisabled ? false : {
    useDefaults: false, // Disable defaults to have full control
    directives: cspDirectives
  },
  crossOriginEmbedderPolicy: false, // Required for some Vue features
  crossOriginOpenerPolicy: false, // Disable for HTTP compatibility
  originAgentCluster: false, // Disable for HTTP compatibility
  // Only enable HSTS when behind HTTPS proxy
  hsts: isHttps ? {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  } : false
}));

// CORS configuration
// SECURITY: Secure defaults - cross-origin requests are blocked unless ALLOWED_ORIGINS is set
// Set CORS_ALLOW_ALL=true for development only (DO NOT USE IN PRODUCTION)
const CORS_ALLOW_ALL = process.env.CORS_ALLOW_ALL === 'true';

/**
 * SECURITY: Properly validate origin using URL parsing
 * Prevents bypass via subdomain/path manipulation (e.g., example.com.evil.com)
 */
function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  // Check for wildcard first
  if (allowedOrigins.includes('*')) {
    return true;
  }

  try {
    const originUrl = new URL(origin);
    for (const allowed of allowedOrigins) {
      // Handle entries that might be missing scheme
      let allowedUrl: URL;
      try {
        // First try parsing as-is
        allowedUrl = new URL(allowed);
      } catch {
        // If it fails, try adding https://
        try {
          allowedUrl = new URL(`https://${allowed}`);
        } catch {
          console.warn(`[CONFIG] Invalid ALLOWED_ORIGINS entry: ${allowed}`);
          continue;
        }
      }
      // SECURITY: Exact match on origin (protocol + hostname + port)
      if (originUrl.origin === allowedUrl.origin) {
        return true;
      }
    }
    return false;
  } catch {
    // Invalid origin URL
    return false;
  }
}

app.use(cors((req, callback) => {
  const origin = req.header('Origin');
  const corsOptions = { credentials: true, origin: false as boolean };

  // Allow requests with no origin (same-origin, mobile apps, curl, direct IP access)
  if (!origin) {
    corsOptions.origin = true;
    return callback(null, corsOptions);
  }

  // Explicit dev mode bypass (SECURITY WARNING: never use in production)
  if (CORS_ALLOW_ALL) {
    console.warn('[SECURITY] CORS_ALLOW_ALL enabled - DO NOT USE IN PRODUCTION');
    corsOptions.origin = true;
    return callback(null, corsOptions);
  }

  // If ALLOWED_ORIGINS is configured, use strict whitelist mode
  if (ALLOWED_ORIGINS.length > 0) {
    if (isOriginAllowed(origin, ALLOWED_ORIGINS)) {
      corsOptions.origin = true;
      return callback(null, corsOptions);
    }
    console.warn(`[SECURITY] CORS blocked origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  }

  // No allowlist configured: allow same-origin only
  const host = req.get('host');
  const expectedOrigin = host ? `${req.protocol}://${host}` : '';
  if (origin === expectedOrigin) {
    corsOptions.origin = true;
    return callback(null, corsOptions);
  }

  console.warn(`[SECURITY] CORS blocked (no allowlist configured): ${origin}`);
  return callback(new Error('CORS not configured - set ALLOWED_ORIGINS env var'));
}));

// Rate limiting - 500 requests per minute per IP
// Higher limit needed because frontend makes many parallel requests
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 500,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

// Strict rate limiting for authentication endpoints
// Prevents brute force attacks on password
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Only 10 auth attempts per 15 minutes per IP
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false // Count all requests, not just failures
});

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);

// Apply strict rate limiting to auth endpoints
app.use('/api/auth/', authLimiter);

// Body parser with size limit
app.use(express.json({ limit: '1mb' }));

// ===== SECURITY: API Authentication Middleware =====
// Only enabled if API_KEY environment variable is set
if (API_AUTH_ENABLED) {
  app.use('/api/', (req, res, next) => {
    // Skip auth for CSRF token endpoint (needed to get token first)
    if (req.path === '/csrf-token') {
      return next();
    }

    // Skip auth for health check
    if (req.path === '/health') {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${API_KEY}`) {
      logAuditEvent('AUTH_FAILED', req, { path: req.path });
      res.status(401).json({ error: 'Unauthorized - Invalid or missing API key' });
      return;
    }

    next();
  });
  console.log('🔐 API authentication enabled (API_KEY required)');
}

// ===== SECURITY: CSRF Protection =====
// Generate CSRF tokens for state-changing operations
const csrfTokens = new Map<string, { token: string; expires: number }>();

function generateCSRFToken(sessionId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + 3600000; // 1 hour
  csrfTokens.set(sessionId, { token, expires });

  // Cleanup expired tokens periodically
  if (csrfTokens.size > 1000) {
    const now = Date.now();
    for (const [key, value] of csrfTokens.entries()) {
      if (value.expires < now) {
        csrfTokens.delete(key);
      }
    }
  }

  return token;
}

function validateCSRFToken(sessionId: string, token: string): boolean {
  const stored = csrfTokens.get(sessionId);
  if (!stored) return false;
  if (stored.expires < Date.now()) {
    csrfTokens.delete(sessionId);
    return false;
  }
  return stored.token === token;
}

// CSRF token endpoint
app.get('/api/csrf-token', (req, res) => {
  const sessionId = req.ip || 'anonymous';
  const token = generateCSRFToken(sessionId);
  res.json({ csrfToken: token });
});

// CSRF validation middleware for state-changing operations
app.use('/api/', (req, res, next) => {
  // Only validate CSRF for state-changing methods
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    return next();
  }

  // SECURITY: Federation endpoints now have their own auth middleware
  // so they go through CSRF validation like other state-changing endpoints

  // Skip CSRF for auth endpoints (they have their own security: challenge-response)
  if (req.path.startsWith('/auth/')) {
    return next();
  }
  // Skip CSRF for read-only federation lookup
  if (req.path === '/federation/location-lookup' && req.method === 'GET') {
    return next();
  }

  const csrfToken = req.headers['x-csrf-token'] as string;
  const sessionId = req.ip || 'anonymous';

  if (!csrfToken || !validateCSRFToken(sessionId, csrfToken)) {
    logAuditEvent('CSRF_VALIDATION_FAILED', req, { path: req.path, method: req.method });
    res.status(403).json({
      error: 'CSRF validation failed',
      message: 'Invalid or missing CSRF token. Please refresh the page and try again.'
    });
    return;
  }

  next();
});

// Audit log endpoint (read-only, for security monitoring) - PROTECTED
app.get('/api/audit-log', (req, res) => {
  // Require authentication via session token or password
  const sessionToken = req.headers['x-session-token'] as string;
  const providedPassword = req.headers['x-auth-password'] as string;

  const isAuth = (sessionToken && validateSessionToken(sessionToken)) ||
                 (providedPassword && providedPassword === TASK_DATA_PASSWORD);

  if (!isAuth) {
    logAuditEvent('SECURITY_AUDIT_LOG_ACCESS_DENIED', req);
    res.status(401).json({
      error: 'Authentication required',
      message: 'Audit log access requires authentication. Please login first.'
    });
    return;
  }

  const limit = Math.min(parseInt(req.query.limit as string) || 100, MAX_AUDIT_LOG_SIZE);
  const events = auditLog.slice(-limit);
  res.json({
    entries: events,
    total: auditLog.length,
    maxSize: MAX_AUDIT_LOG_SIZE
  });
});

// Initialize components
const db = new TruebitDatabase(DB_PATH);
const dockerClient = new DockerClient(CONTAINER_NAME, DOCKER_SOCKET);
const logParser = new LogParser();
const wsServer = new TruebitWebSocketServer(server, { validateSessionToken });

// Federation client holder (allows late initialization)
interface FederationHolder {
  client: FederationClient | null;
  heartbeatInterval?: ReturnType<typeof setInterval>;
}

const federation: FederationHolder = {
  client: null
};

// EventDBReader and LogFileReader will be initialized after dockerClient
let eventDBReader: EventDBReader;
let logFileReader: LogFileReader;

// Current task tracking (in-memory)
const activeTasks = new Map<string, Task & { status: string; startedAt?: string }>();
let lastLogAt: string | null = null;
let activeLogSource: 'file' | 'docker' | null = null;

// Process parsed log
function processLog(parsed: ParsedLog | null, broadcast: boolean = false): void {
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
  } catch {
    // Silently ignore all database errors during log insert (likely duplicates)
    // Don't log these errors to avoid spam during historical log processing
  }

  // Only broadcast to WebSocket if requested (for real-time logs)
  if (broadcast) {
    wsServer.sendLog(parsed as unknown as Record<string, unknown>);
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

    // F-008: Registration handling removed - nodeAddress is never extracted for privacy
  }
}

function handleTaskReceived(parsed: ParsedLog): void {
  if (!parsed.executionId || !parsed.data) return;

  const taskData = (parsed.data as { payload?: Record<string, unknown> }).payload || parsed.data as Record<string, unknown>;

  try {
    // Extract task information
    const task: Task & { status: string } = {
      executionId: parsed.executionId,
      receivedAt: parsed.timestamp!.toISOString(),
      status: 'received',
      taskType: (taskData.taskType as string) || 'unknown',
      taskHash: (taskData.taskHash as string) || (taskData.taskPath as string),
      chainId: taskData.chainId as string,
      blockNumber: taskData.blockNumber as number,
      blockHash: taskData.blockHash as string,
      inputData: taskData.input ? JSON.parse(taskData.input as string) : null
    };

    // Store in database (ignore if duplicate)
    try {
      db.insertTask(task);
    } catch (dbError) {
      if (!(dbError as Error).message.includes('UNIQUE constraint')) {
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
      const dbTask = db.getTask(task.executionId) as Record<string, unknown> | undefined;
      if (dbTask) {
        federation.client.publishTaskReceived(dbTask as unknown as import('./federation/anonymizer.js').TaskData).catch(err => {
          console.error('Failed to publish task to federation:', (err as Error).message);
        });
      }
    }

    console.log(`📥 Task received: ${parsed.executionId}`);
  } catch (error) {
    console.error('Error handling task received:', (error as Error).message);
  }
}

function handleTaskStart(parsed: ParsedLog): void {
  if (!parsed.executionId) return;

  try {
    db.updateTaskStart(parsed.executionId, parsed.timestamp!.toISOString());

    const task = activeTasks.get(parsed.executionId);
    if (task) {
      task.status = 'executing';
      task.startedAt = parsed.timestamp!.toISOString();
    }

    wsServer.sendTask({ executionId: parsed.executionId, event: 'started' });

    console.log(`▶️  Task started: ${parsed.executionId}`);
  } catch (error) {
    console.error('Error handling task start:', (error as Error).message);
  }
}

function handleTaskCompleted(parsed: ParsedLog): void {
  if (!parsed.executionId) return;

  const task = activeTasks.get(parsed.executionId);
  if (task) {
    task.status = 'completed';
    activeTasks.delete(parsed.executionId);
  }

  wsServer.sendTask({ executionId: parsed.executionId, event: 'completed' });

  // Publish to federation (if enabled and connected)
  if (federation.client && federation.client.isHealthy()) {
    const dbTask = db.getTask(parsed.executionId) as { completed_at?: string } | undefined;
    if (dbTask && dbTask.completed_at) {
      federation.client.publishTaskCompleted(dbTask as unknown as import('./federation/anonymizer.js').TaskData).catch(err => {
        console.error('Failed to publish task completion to federation:', (err as Error).message);
      });
    }
  }

  console.log(`✅ Task completed: ${parsed.executionId}`);
}

function handleExecutionOutput(parsed: ParsedLog): void {
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
      let outputData: unknown | undefined;
      try {
        const payload = parsed.data;
        if (payload) {
          const serialized = JSON.stringify(payload);
          if (Buffer.byteLength(serialized, 'utf8') <= MAX_OUTPUT_DATA_BYTES) {
            outputData = payload;
          }
        }
      } catch {
        // Ignore serialization errors for output payloads
      }

      db.updateTaskComplete(executionId, {
        completedAt: new Date().toISOString(),
        status: metrics.exitCode === 0 ? 'completed' : 'failed',
        outputData,
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

      // Best-effort: map wasm hash to artifact and store metadata
      if (metrics.wasm?.hash && WASM_HASH_PATTERN.test(metrics.wasm.hash)) {
        void (async () => {
          const artifact = await dockerClient.findWasmArtifact(metrics.wasm!.hash as string);
          if (artifact) {
            db.upsertTaskArtifact({
              executionId,
              artifactType: 'wasm_prepared',
              hash: metrics.wasm!.hash as string,
              path: artifact.path,
              sizeBytes: artifact.sizeBytes
            });
          }
        })();
      }
    }
  } catch (error) {
    console.error('Error handling execution output:', (error as Error).message);
  }
}

function handleInvoice(parsed: ParsedLog): void {
  // Only create invoice records if we have actual invoice data
  // Invoice-related semaphore messages don't contain invoice details
  if (!parsed.data) {
    return;
  }

  try {
    const invoice = {
      timestamp: parsed.timestamp!.toISOString(),
      eventType: 'invoice_received',
      slotUsed: parsed.semaphore?.current || null,
      details: parsed.data
    };

    db.insertInvoice(invoice);
    wsServer.sendInvoice(invoice as unknown as Record<string, unknown>);

    console.log(`💰 Invoice event received`);
  } catch (error) {
    console.error('Error handling invoice:', (error as Error).message);
  }
}

function handleSemaphore(parsed: ParsedLog): void {
  if (!parsed.semaphore) return;

  try {
    const { current, total } = parsed.semaphore;
    db.updateNodeSlots(current, total);
    wsServer.sendSemaphore({ current, total, action: parsed.semaphore.action });

    console.log(`🔄 Semaphore: ${current}/${total} slots`);
  } catch (error) {
    console.error('Error handling semaphore:', (error as Error).message);
  }
}

// F-008: handleRegistration function removed
// The function was dead code because log-parser.ts never sets nodeAddress
// (intentionally redacted for privacy protection)

// API Routes
app.use('/api/status', createStatusRouter(db, dockerClient));
app.use('/api/tasks', createTasksRouter(db, {
  validateSessionToken,
  readArtifactFile: (path: string, maxBytes: number) => dockerClient.readFile(path, maxBytes),
  maxArtifactBytes: parseInt(process.env.MAX_ARTIFACT_BYTES || '20971520', 10)
}));
app.use('/api/invoices', createInvoicesRouter(db));
app.use('/api/logs', createLogsRouter(db, {
  validateSessionToken,
  getLogStatus: () => ({ source: activeLogSource, lastLogAt })
}));

// Token analytics service and route (db passed later after initialization)
const tokenService = new TokenService(db);
app.use('/api/token', createTokenRouter({ tokenService }));

// Analytics routes (cached on-chain data for staking, nodes)
app.use('/api/analytics', createAnalyticsRouter());

// Federation route is registered in start() after client is created

// Challenge-response authentication endpoints
// Step 1: Client requests a challenge
app.get('/api/auth/challenge', (req, res) => {
  // Generate a unique challenge ID and random challenge
  const challengeId = crypto.randomBytes(16).toString('hex');
  const challenge = crypto.randomBytes(32).toString('hex');

  // Store the challenge with expiration
  authChallenges.set(challengeId, {
    challenge,
    expiresAt: Date.now() + CHALLENGE_EXPIRY_MS
  });

  res.json({ challengeId, challenge });
});

// Step 2: Client sends hash of (challenge + password)
app.post('/api/auth/verify', express.json(), (req, res) => {
  const { challengeId, hash } = req.body;

  // Validate input
  if (!challengeId || !hash) {
    return res.status(400).json({ success: false, message: 'Challenge ID and hash required' });
  }

  // Get and validate the challenge
  const challengeData = authChallenges.get(challengeId);
  if (!challengeData) {
    logAuditEvent('AUTH_FAILED', req, { type: 'app_login', reason: 'invalid_challenge' });
    return res.status(401).json({ success: false, message: 'Invalid or expired challenge' });
  }

  // Check if challenge has expired
  if (challengeData.expiresAt < Date.now()) {
    authChallenges.delete(challengeId);
    logAuditEvent('AUTH_FAILED', req, { type: 'app_login', reason: 'expired_challenge' });
    return res.status(401).json({ success: false, message: 'Challenge expired' });
  }

  // Compute expected hash: SHA-256(challenge + password)
  // NOTE: Do NOT delete challenge yet - delete AFTER verification to prevent timing attacks
  const expectedHash = crypto
    .createHash('sha256')
    .update(challengeData.challenge + TASK_DATA_PASSWORD)
    .digest('hex');

  // Compare hashes using timing-safe comparison
  const hashBuffer = Buffer.from(hash, 'hex');
  const expectedBuffer = Buffer.from(expectedHash, 'hex');

  if (hashBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(hashBuffer, expectedBuffer)) {
    // Delete challenge on failure (one-time use)
    authChallenges.delete(challengeId);
    logAuditEvent('AUTH_FAILED', req, { type: 'app_login', reason: 'invalid_hash' });
    return res.status(401).json({ success: false, message: 'Invalid password' });
  }

  // Delete challenge on success (one-time use)
  authChallenges.delete(challengeId);

  // Generate session token for subsequent API calls
  // This allows the client to make authenticated requests without storing the password
  const sessionToken = generateSessionToken();
  sessionTokens.set(sessionToken, {
    expiresAt: Date.now() + SESSION_TOKEN_EXPIRY_MS
  });

  logAuditEvent('AUTH_SUCCESS', req, { type: 'app_login' });
  return res.json({
    success: true,
    message: 'Authentication successful',
    sessionToken, // Client stores this instead of password
    expiresIn: SESSION_TOKEN_EXPIRY_MS
  });
});

// Health check endpoints (both /health and /api/health for Docker health checks)
const healthHandler = (req: express.Request, res: express.Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    docker: dockerClient.container ? 'connected' : 'disconnected'
  });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// Static files and catch-all are set up in start() after all API routes

// Initialize and start
async function start(): Promise<void> {
  try {
    console.log('🚀 Starting TrueBit Monitor...\n');

    // Initialize database
    await db.initialize();

    // Initialize federation settings
    const anonymizer = new FederationAnonymizer();
    const credentials = anonymizer.getNodeCredentials();
    db.initializeFederationSettings(credentials.nodeId, credentials.salt);

    // Initialize token analytics (async, non-blocking)
    console.log('📊 Initializing TRU token analytics...');
    tokenService.initialize().then(() => {
      // Load from cache, then sync new burns
      return tokenService.syncBurns();
    }).then(async result => {
      console.log(`   ✓ Loaded ${result.totalBurns} burn events`);
      // Pre-cache token metrics
      try {
        await tokenService.getMetrics(true);
        console.log('   ✓ Token metrics pre-cached');
      } catch (err) {
        console.error('   ✗ Token metrics pre-cache failed:', err);
      }
      // Set up periodic sync (every 3 minutes for metrics, 10 minutes for burns)
      setInterval(() => {
        tokenService.getMetrics(true).catch(err => {
          console.error('Token metrics refresh error:', err);
        });
      }, 3 * 60 * 1000);
      setInterval(() => {
        tokenService.syncBurns().catch(err => {
          console.error('Token sync error:', err);
        });
      }, 10 * 60 * 1000);
    }).catch(err => {
      console.error('   ✗ Token sync failed:', err);
    });

    // Function to create/recreate federation client
    const createFederationClient = async (): Promise<void> => {
      const fedSettings = db.getFederationSettings();
      if (!fedSettings) return;

      // Parse credentials from nats_token (stored as "user:password" or just use env vars)
      let natsUser: string | null = process.env.FEDERATION_NATS_USER || null;
      let natsPass: string | null = process.env.FEDERATION_NATS_PASSWORD || null;

      // If stored in DB as "user:password", parse it
      if (fedSettings.nats_token && fedSettings.nats_token.includes(':')) {
        const [user, pass] = fedSettings.nats_token.split(':');
        natsUser = user;
        natsPass = pass;
      } else if (fedSettings.nats_token) {
        // If just a token, use as-is
        natsPass = fedSettings.nats_token;
      }

      federation.client = new FederationClient({
        nodeId: fedSettings.node_id,
        salt: fedSettings.salt,
        servers: fedSettings.nats_servers ? JSON.parse(fedSettings.nats_servers) : [],
        user: natsUser,
        pass: natsPass,
        tls: !!fedSettings.tls_enabled
      });

      // Set up federation message handlers
      interface FederationMessageData {
        nodeId?: string;
        type?: string;
        data?: {
          continentBucket?: string;
          locationBucket?: string;
        };
      }
      federation.client.on('message', ({ subject, data }: { subject: string; data: FederationMessageData }) => {
        try {
          // Skip messages without nodeId (e.g., network_stats from aggregator)
          // These are handled by specific callbacks
          if (!data.nodeId) {
            return;
          }

          // Store received message
          db.insertFederationMessage(data as unknown as import('./db/database.js').FederationMessage);

          // Update peer information with location data (safely validated in upsertFederationPeer)
          db.upsertFederationPeer(data.nodeId, {
            continentBucket: data.data?.continentBucket,
            locationBucket: data.data?.locationBucket
          });

          // Broadcast to WebSocket clients (optional)
          wsServer.broadcast('federation_message', data as unknown as Record<string, unknown>);
        } catch (error) {
          console.error('Error handling federation message:', (error as Error).message);
        }
      });

      console.log(`🌐 Federation client created with servers: ${fedSettings.nats_servers || '(none configured)'}`);
    };

    // Create initial federation client
    await createFederationClient();

    // Register federation routes with recreateClient callback and auth config
    // SECURITY: Pass auth config to enable authentication on state-changing endpoints
    app.use('/api/federation', createFederationRouter(db, federation, createFederationClient, {
      validateSessionToken
    }));

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
          await federation.client!.connect();

          // Subscribe to all federation messages
          await federation.client!.subscribeToFederation({
            taskReceived: (data: unknown) => console.log('📨 Federation: Task received from', (data as { nodeId?: string }).nodeId),
            taskCompleted: (data: unknown) => console.log('✅ Federation: Task completed by', (data as { nodeId?: string }).nodeId),
            heartbeat: (data: unknown) => console.log('💓 Federation: Heartbeat from', (data as { nodeId?: string }).nodeId)
          });

          // Start heartbeat interval to announce node presence
          const HEARTBEAT_INTERVAL = 30000; // 30 seconds
          const publishHeartbeat = async (): Promise<void> => {
            if (!federation.client || !federation.client.isHealthy()) {
              return;
            }

            try {
              // Get node status from database
              const nodeStatus = db.getNodeStatus();
              const taskStats = db.getTaskStats();
              const invoiceCount = db.getInvoiceCount();
              const fedSettings = db.getFederationSettings();
              const location = await resolveLocationBucket({
                locationEnabled: fedSettings?.location_enabled,
                locationLabel: fedSettings?.location_label,
                locationLat: fedSettings?.location_lat,
                locationLon: fedSettings?.location_lon
              });

              const heartbeatData = {
                connected: federation.client.connected,
                activeTasks: activeTasks.size,
                totalTasks: taskStats?.total || 0,
                totalInvoices: invoiceCount,
                continent: NODE_CONTINENT,
                locationBucket: location?.bucket
              };

              await federation.client.publishHeartbeat(heartbeatData);
              console.log('💓 Heartbeat published to federation');
            } catch (error) {
              console.error('Failed to publish heartbeat:', (error as Error).message);
            }
          };

          // Publish node joined event
          await federation.client!.publishNodeJoined();
          console.log('🟢 Node joined event published to federation');

          // Publish initial heartbeat immediately
          await publishHeartbeat();

          // Set up interval for subsequent heartbeats
          federation.heartbeatInterval = setInterval(publishHeartbeat, HEARTBEAT_INTERVAL);
          console.log(`   ✓ Heartbeat interval started (every ${HEARTBEAT_INTERVAL / 1000}s)`);

          // Set up stale peer cleanup (every 5 minutes)
          // This removes peers that haven't sent a heartbeat in 5+ minutes
          const STALE_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
          const STALE_THRESHOLD_MINUTES = 5; // Consider stale after 5 minutes without heartbeat
          const BATCH_SIZE = 5; // Process 5 stale peers at a time
          const BATCH_DELAY = 1000; // 1 second between batches

          const cleanupStalePeers = async () => {
            try {
              const stalePeers = db.getStalePeers(STALE_THRESHOLD_MINUTES);

              if (stalePeers.length === 0) {
                return;
              }

              console.log(`🧹 Found ${stalePeers.length} stale peers, cleaning up...`);

              // Process in batches to avoid overwhelming the system
              for (let i = 0; i < stalePeers.length; i += BATCH_SIZE) {
                const batch = stalePeers.slice(i, i + BATCH_SIZE);

                for (const nodeId of batch) {
                  db.removePeer(nodeId);
                  console.log(`   Removed stale peer: ${nodeId.slice(0, 17)}...`);
                }

                // Delay between batches if more remain
                if (i + BATCH_SIZE < stalePeers.length) {
                  await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
                }
              }

              console.log(`✅ Cleaned up ${stalePeers.length} stale peers`);
            } catch (error) {
              console.error('Failed to cleanup stale peers:', (error as Error).message);
            }
          };

          // Run initial cleanup after a short delay
          setTimeout(cleanupStalePeers, 30000); // 30 seconds after startup

          // Then run periodically
          setInterval(cleanupStalePeers, STALE_CHECK_INTERVAL);
          console.log(`   ✓ Stale peer cleanup scheduled (every ${STALE_CHECK_INTERVAL / 60000}m)`);
        } catch (error) {
          console.error('⚠️  Failed to connect to federation:', (error as Error).message);
        }
      }
    }

    // Check Docker connection (optional - continue without it for analytics-only mode)
    let dockerAvailable = false;
    try {
      const dockerOk = await dockerClient.ping();
      if (dockerOk) {
        await dockerClient.initialize();
        dockerAvailable = true;

        // Initialize readers with container object
        eventDBReader = new EventDBReader(dockerClient.container!);
        logFileReader = new LogFileReader(dockerClient.container!);
      }
    } catch (dockerError) {
      console.warn('⚠️  Docker/container not available:', (dockerError as Error).message);
      console.log('   Running in analytics-only mode (Token, Staking, Node Registry)');
      console.log('   Node monitoring features disabled.\n');
    }

    // Get container info and update node status (only if Docker available)
    if (dockerAvailable) {
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
          executionId: task.executionId!,
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
        if (!(error as Error).message.includes('UNIQUE')) {
          console.error(`   ✗ Failed to import task: ${(error as Error).message}`);
        }
      }
    }

    // Process EventDB outcomes
    for (const outcome of parsedEvents.outcomes) {
      try {
        db.updateTaskComplete(outcome.executionId!, {
          completedAt: new Date().toISOString(),
          status: 'completed'
        });
      } catch {
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
        if (!(error as Error).message.includes('UNIQUE')) {
          console.error(`   ✗ Failed to import invoice: ${(error as Error).message}`);
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
    activeLogSource = null;
    let dockerLogsStarted = false;

    const handleStreamingLine = (logLine: string, source: 'file' | 'docker'): void => {
      if (activeLogSource && activeLogSource !== source) {
        return;
      }
      if (!activeLogSource) {
        activeLogSource = source;
      }
      lastLogAt = new Date().toISOString();

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
    };

    const startDockerLogStream = async (): Promise<void> => {
      if (dockerLogsStarted) return;
      dockerLogsStarted = true;
      console.log('   ↪ Falling back to Docker logs stream');

      dockerClient.on('log', (chunk: string) => {
        const lines = chunk.split('\n').filter(line => line.trim());
        for (const line of lines) {
          handleStreamingLine(line, 'docker');
        }
      });

      try {
        await dockerClient.streamLogs({ follow: true, timestamps: true, tail: 200 });
        console.log('   ✓ Streaming logs from Docker');
      } catch (error) {
        console.error('   ✗ Failed to stream Docker logs:', (error as Error).message);
      }
    };

    // Tail current log file for new entries
    logFileReader.on('line', (logLine: string) => {
      handleStreamingLine(logLine, 'file');
    });

    // If file tailing fails, fall back to Docker logs
    logFileReader.on('tail-error', () => {
      if (!activeLogSource || activeLogSource === 'file') {
        activeLogSource = 'docker';
        logFileReader.stopTailing();
        void startDockerLogStream();
      }
    });

    const tailOk = await logFileReader.tailCurrentLog();
    if (tailOk) {
      console.log('   ✓ Tailing current log file for real-time updates');
    } else {
      activeLogSource = 'docker';
      await startDockerLogStream();
    }
    console.log();
    } // End of dockerAvailable block

    // Start server
    server.listen(PORT, () => {
      console.log(`\n✅ TrueBit Monitor running!`);
      console.log(`   📡 API Server: http://${HOST}:${PORT}`);
      console.log(`   🔌 WebSocket: ws://${HOST}:${PORT}`);
      console.log(`   🐳 Container: ${CONTAINER_NAME}`);
      console.log(`   💾 Database: ${DB_PATH}`);

      // Display task data password (important for node operators to know)
      console.log();
      console.log('   🔐 Task Data Password Protection: ENABLED');
      if (TASK_DATA_PASSWORD_FROM_ENV) {
        console.log('   📝 Password: (set via TASK_DATA_PASSWORD env var)');
      } else {
        // Write auto-generated password to a secure file instead of logging to console
        // This prevents password exposure in Docker logs, log aggregators, etc.
        const dataDir = path.dirname(DB_PATH);
        const passwordFile = path.join(dataDir, '.password');
        try {
          // Ensure data directory exists
          if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
          }
          // Write password with restrictive permissions (owner read/write only)
          fs.writeFileSync(passwordFile, TASK_DATA_PASSWORD, { mode: 0o600 });
          console.log(`   📝 Auto-generated password saved to: ${passwordFile}`);
          console.log('   ⚠️  IMPORTANT: Back up this file! Password is NOT shown in logs.');
          console.log('   💡 Or set TASK_DATA_PASSWORD env var to use your own password');
        } catch (err) {
          // Fallback: if we can't write the file, we must display the password
          console.warn('   ⚠️  Could not write password file, displaying in log (less secure):');
          console.log(`   🔑 ${TASK_DATA_PASSWORD}`);
          console.log('   💡 Set TASK_DATA_PASSWORD env var to use your own password');
        }
      }
      console.log();

      // Initialize analytics cache on startup
      analyticsService.initialize().then(() => {
        console.log('   📊 Analytics cache initialized');
      }).catch(err => {
        console.error('   ⚠️  Analytics cache initialization failed:', err);
      });
    });

    // Graceful shutdown handler
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n🛑 Shutting down (${signal})...`);
      if (logFileReader) logFileReader.stopTailing();
      analyticsService.stopAutoRefresh();
      if (federation.heartbeatInterval) clearInterval(federation.heartbeatInterval);

      // Publish node_left event before disconnecting
      if (federation.client && federation.client.connected) {
        try {
          console.log('🔴 Publishing node left event...');
          await federation.client.publishNodeLeft();
          // Small delay to ensure message is sent
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error('Failed to publish node left:', (error as Error).message);
        }
        await federation.client.disconnect();
      }

      db.close();
      wsServer.close();
      process.exit(0);
    };

    // Cleanup on exit
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    // Also handle uncaught exceptions gracefully
    process.on('uncaughtException', async (error) => {
      console.error('Uncaught exception:', error);
      await gracefulShutdown('uncaughtException');
    });

  } catch (error) {
    console.error('❌ Failed to start:', (error as Error).message);
    process.exit(1);
  }
}

start();
