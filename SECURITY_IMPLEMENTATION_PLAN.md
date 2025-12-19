# Security Audit Implementation Plan

**Document Version:** 2.0
**Date:** 2025-12-19
**Status:** Ready for Implementation

This document consolidates findings from two rounds of expert security analysis and provides a comprehensive implementation roadmap.

---

## Executive Summary

The Truebit Node Monitor security audit identified **9 security findings** and **2 quality observations**. This implementation plan prioritizes fixes based on risk (exploitability x impact) and provides detailed remediation steps.

### Risk Matrix Summary

| Finding | Severity | Exploitability | Impact | Risk Score | Status |
|---------|----------|----------------|--------|------------|--------|
| F-001 | HIGH | Easy | Critical | 9.0 | CRITICAL |
| F-002 | HIGH | Easy | High | 8.0 | CRITICAL |
| F-005 | MEDIUM | Easy | Medium | 6.0 | HIGH |
| F-006 | MEDIUM | Easy | Medium | 6.0 | HIGH |
| F-003 | MEDIUM | Medium | Medium | 4.0 | MEDIUM |
| F-004 | MEDIUM | Medium | Low | 3.0 | MEDIUM |
| F-007 | LOW | Hard | High | 3.0 | LOW |
| F-009 | LOW | Hard | Medium | 2.0 | LOW |
| F-008 | LOW | N/A | Low | 1.0 | LOW |

---

## Phase 1: Critical Security Fixes (Week 1)

### F-001: Federation Endpoints Unauthenticated

**Severity:** HIGH
**Risk Score:** 9.0 (Easy exploitability, Critical impact)

**Attack Scenario:** An attacker with network access can:
1. Enable federation and redirect to malicious NATS server
2. Capture all anonymized task data
3. Inject malicious statistics
4. Block legitimate peers
5. Reset all federation data

**Files to Modify:**

1. **`monitor/backend/src/index.ts`**
   - Remove CSRF bypass for federation (lines 305-309)
   - Pass auth validator to federation router (line 809)

2. **`monitor/backend/src/routes/federation.ts`**
   - Add authentication middleware
   - Apply to POST /enable, POST /disable, PUT /settings, POST /reset, POST /peers/:nodeId/block

**Implementation:**

```typescript
// monitor/backend/src/routes/federation.ts - Add after imports

interface AuthConfig {
  validateSessionToken?: (token: string) => boolean;
}

function requireFederationAuth(config: AuthConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const sessionToken = req.headers['x-session-token'] as string;
    if (!sessionToken || !config.validateSessionToken?.(sessionToken)) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'Federation endpoints require a valid session token'
      });
      return;
    }
    next();
  };
}

// Update createFederationRouter signature
export function createFederationRouter(
  db: TruebitDatabase,
  federation: FederationHolder,
  recreateClient: () => Promise<void>,
  authConfig?: AuthConfig
): Router {
  const authMiddleware = authConfig?.validateSessionToken
    ? requireFederationAuth(authConfig)
    : (_req: Request, _res: Response, next: NextFunction) => next();

  // Apply to state-changing endpoints:
  router.post('/enable', authMiddleware, async (req, res) => { ... });
  router.post('/disable', authMiddleware, async (req, res) => { ... });
  router.put('/settings', authMiddleware, validate(...), async (req, res) => { ... });
  router.post('/reset', authMiddleware, async (req, res) => { ... });
  router.post('/peers/:nodeId/block', authMiddleware, validate(...), (req, res) => { ... });
}
```

```typescript
// monitor/backend/src/index.ts - Remove CSRF bypass

// DELETE lines 305-309:
// if (req.path.startsWith('/federation/')) {
//   return next();
// }

// Update line 809:
app.use('/api/federation', createFederationRouter(db, federation, createFederationClient, {
  validateSessionToken
}));
```

**Decision:** Federation endpoints will accept **session token only** (no API_KEY) as the
strongest operator‑interactive control. Automations should use the session token flow.

**Testing:**
```bash
# Must return 401
curl -X POST http://localhost:8090/api/federation/enable
curl -X POST http://localhost:8090/api/federation/disable
curl -X PUT http://localhost:8090/api/federation/settings -d '{}'
curl -X POST http://localhost:8090/api/federation/reset
```

---

### F-002: Origin Allowlist Bypass via startsWith

**Severity:** HIGH
**Risk Score:** 8.0 (Easy exploitability, High impact)

**Attack Scenario:** Attacker registers `https://example.com.evil.com` which bypasses `https://example.com` allowlist due to `startsWith` check.

**Files to Modify:**

1. **`monitor/backend/src/index.ts`** (lines 181-201)
2. **`monitor/backend/src/websocket/server.ts`** (lines 54-68)

**Implementation:**

```typescript
// monitor/backend/src/index.ts - Replace CORS origin callback

// Add helper function before CORS middleware
function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  try {
    const originUrl = new URL(origin);
    for (const allowed of allowedOrigins) {
      try {
        const allowedUrl = new URL(allowed);
        // Exact match: protocol + hostname + port
        if (originUrl.origin === allowedUrl.origin) {
          return true;
        }
      } catch {
        console.warn(`[CONFIG] Invalid ALLOWED_ORIGINS entry: ${allowed}`);
      }
    }
    return false;
  } catch {
    return false;
  }
}

// Replace CORS origin callback
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.length > 0) {
      if (isOriginAllowed(origin, ALLOWED_ORIGINS)) {
        callback(null, true);
      } else {
        console.warn(`[SECURITY] CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
      return;
    }

    callback(null, true);
  },
  credentials: true
}));
```

```typescript
// monitor/backend/src/websocket/server.ts - Replace origin check

// In verifyClient callback:
const isAllowed = allowedOrigins.some(allowed => {
  try {
    const originUrl = new URL(origin);
    const allowedUrl = new URL(allowed);
    return originUrl.origin === allowedUrl.origin;
  } catch {
    return false;
  }
});

if (isAllowed) {
  callback(true);
} else {
  console.warn(`WebSocket connection rejected from origin: ${origin}`);
  callback(false, 403, 'Forbidden');
}
```

**Testing:**
```bash
# Must be REJECTED
curl -H "Origin: https://example.com.evil.com" http://localhost:8090/api/status
curl -H "Origin: https://sub.example.com" http://localhost:8090/api/status

# Must be ALLOWED
curl -H "Origin: https://example.com" http://localhost:8090/api/status
```

---

## Phase 2: High Priority Fixes (Week 2)

### F-005: CORS Defaults Allow All Origins

**Severity:** MEDIUM
**Risk Score:** 6.0

**Implementation:**

```typescript
// monitor/backend/src/index.ts

// Add new environment variable
const CORS_ALLOW_ALL = process.env.CORS_ALLOW_ALL === 'true';

// Update CORS callback
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    // Explicit opt-in for dev only
    if (CORS_ALLOW_ALL) {
      console.warn('[SECURITY] CORS_ALLOW_ALL enabled - DO NOT USE IN PRODUCTION');
      return callback(null, true);
    }

    // If no origins configured, allow same-origin only (UI works out of box)
    if (ALLOWED_ORIGINS.length === 0) {
      try {
        const originUrl = new URL(origin);
        const host = req.get('host');
        const scheme = req.protocol;
        const expectedOrigin = host ? `${scheme}://${host}` : '';
        if (originUrl.origin === expectedOrigin) {
          return callback(null, true);
        }
      } catch {
        // fall through
      }
      console.warn(`[SECURITY] CORS blocked (no allowlist): ${origin}`);
      callback(new Error('CORS not configured'));
      return;
    }

    if (isOriginAllowed(origin, ALLOWED_ORIGINS)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
```

**Behavior:** Without `ALLOWED_ORIGINS`, only same‑origin requests are allowed.

**Migration:**
```bash
# Add to .env for production
ALLOWED_ORIGINS=https://monitor.yourdomain.com

# Or for development only
CORS_ALLOW_ALL=true
```

---

### F-006: Aggregator Rate Limiting Bypass

**Severity:** MEDIUM
**Risk Score:** 6.0

**Attack Scenario:** Flood aggregator with messages lacking `nodeId` to bypass rate limiting.

**Files to Modify:** `aggregator/src/index.ts`

**Implementation:**

```typescript
// aggregator/src/index.ts

// Add global rate limiter
let globalMessageCount = { count: 0, windowStart: Date.now() };
const GLOBAL_RATE_LIMIT = parseInt(process.env.GLOBAL_RATE_LIMIT || '1000', 10);
const GLOBAL_RATE_WINDOW = 1000;

function isRateLimited(nodeId: string | undefined): boolean {
  const now = Date.now();

  // Global rate limit (all messages)
  if (now - globalMessageCount.windowStart >= GLOBAL_RATE_WINDOW) {
    globalMessageCount = { count: 1, windowStart: now };
  } else {
    globalMessageCount.count++;
    if (globalMessageCount.count > GLOBAL_RATE_LIMIT) {
      console.error('[SECURITY] Global rate limit exceeded');
      return true;
    }
  }

  // CRITICAL FIX: Reject messages without nodeId
  if (!nodeId) {
    console.warn('[SECURITY] Rejecting message without nodeId');
    return true;  // Changed from false to true
  }

  // Per-node rate limit (existing logic)
  const entry = nodeMessageCounts.get(nodeId);
  if (!entry || now - entry.windowStart >= config.rateLimitWindow) {
    nodeMessageCounts.set(nodeId, { count: 1, windowStart: now });
    return false;
  }

  entry.count++;
  if (entry.count > config.rateLimitPerNode) {
    console.warn(`[SECURITY] Rate limit exceeded for node ${nodeId.slice(0, 12)}...`);
    return true;
  }

  return false;
}

// Update handlers to always check rate limit
function handleTaskReceived(data: unknown, _subject: string): void {
  const msg = data as FederationMessage;
  if (isRateLimited(msg.nodeId)) return;  // Removed conditional
  // ...
}
```

---

## Phase 3: Medium Priority Fixes (Week 3)

### F-003: WebSocket Broadcasts Leak executionId

**Severity:** MEDIUM
**Risk Score:** 4.0

**Files to Modify:** `monitor/backend/src/websocket/server.ts`

**Implementation:**

```typescript
// monitor/backend/src/websocket/server.ts - Update sanitizeForBroadcast

private sanitizeForBroadcast(type: string, data: Record<string, unknown>): Record<string, unknown> {
  if (type === 'task') {
    // SECURITY FIX: Strip both snake_case and camelCase variants
    const {
      input_data, output_data, error_data,
      execution_id, executionId,  // Added executionId
      inputData, outputData, errorData,
      ...safe
    } = data;
    return safe;
  } else if (type === 'log') {
    const {
      nodeAddress, node_address,
      executionId, execution_id,  // Added both variants
      ...safe
    } = data;
    return safe;
  } else if (type === 'node_status') {
    const { address, ...safe } = data;
    if (address && typeof address === 'string') {
      (safe as Record<string, unknown>).addressHash = crypto
        .createHash('sha256')
        .update(address)
        .digest('hex')
        .slice(0, 16);
    }
    return safe;
  }

  // Strip execution IDs from all other types
  const { executionId, execution_id, ...safe } = data;
  return safe;
}
```

---

### F-004: WebSocket Auth Unusable

**Severity:** MEDIUM
**Risk Score:** 3.0

**Decision:** Implement full WebSocket auth handshake.

**Implementation Outline:**
1) Client sends `{ type: 'auth', token: sessionToken }` on connect and reconnect.
2) Server validates via `validateSessionToken` and responds with `auth_success` or `auth_failed`.
3) Server disconnects unauthenticated clients after `AUTH_TIMEOUT_MS`.

---

## Phase 4: Low Priority Fixes (Week 4)

### F-007: Container Exec Shell Injection

**Severity:** LOW
**Risk Score:** 3.0

**Files to Modify:**
- `monitor/backend/src/docker/logfile-reader.ts`
- `monitor/backend/src/docker/eventdb-reader.ts`

**Implementation:**

```typescript
// Replace execCommand with array-based version

private async execCommandArray(cmdArray: string[]): Promise<string> {
  const exec = await this.container.exec({
    Cmd: cmdArray,  // Direct array, no shell
    AttachStdout: true,
    AttachStderr: true
  });
  // ...
}

// Usage:
await this.execCommandArray(['ls', '-1', this.logBasePath]);
await this.execCommandArray(['cat', filePath]);
await this.execCommandArray(['tail', '-n', String(tailLines), logFile]);
```

---

### F-009: CSP Uses unsafe-inline/unsafe-eval

**Severity:** LOW
**Risk Score:** 2.0

**Implementation:**

```typescript
// Environment-based CSP
const isProduction = process.env.NODE_ENV === 'production';

const cspDirectives = {
  scriptSrc: isProduction
    ? ["'self'"]  // Strict in production
    : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],  // Relaxed in dev
  styleSrc: ["'self'", "'unsafe-inline'"],  // Required for Tailwind
  // ...
};
```

---

### F-008: Dead Registration Code

**Severity:** LOW
**Risk Score:** 1.0

**Recommendation:** Remove unused code.

```typescript
// Remove from monitor/backend/src/index.ts:
// - handleRegistration function
// - Registration case from switch statement

// Remove from monitor/backend/src/parsers/log-parser.ts:
// - nodeRegistration pattern
// - Registration type detection
```

---

## Phase 5: Quality Improvements (Ongoing)

### Q-001: Duplicated Auth Hashing Logic

**Create shared utility:**

```typescript
// monitor/frontend/src/utils/auth.ts

export async function hashWithChallenge(challenge: string, password: string): Promise<string> {
  const message = challenge + password;
  // ... SHA-256 implementation
}

export async function authenticateWithChallenge(password: string): Promise<AuthResult> {
  // Challenge-response flow
}

export const SessionStorage = {
  setSession(token: string): void { ... },
  getSessionToken(): string | null { ... },
  clearSession(): void { ... }
};
```

---

### Q-002: Minimal Test Coverage

**Priority Test Suites:**

1. **Authentication Flow Tests** (Critical)
   - Challenge generation/expiry
   - Session token management
   - Rate limiting

2. **Federation Authorization Tests** (Critical)
   - All endpoints require auth
   - CSRF protection

3. **WebSocket Sanitization Tests** (High)
   - executionId stripping
   - All sensitive fields removed

4. **Origin Validation Tests** (High)
   - Bypass prevention
   - Exact matching

---

## Implementation Schedule

| Week | Phase | Findings | Effort |
|------|-------|----------|--------|
| 1 | Critical | F-001, F-002 | 2-3 days |
| 2 | High | F-005, F-006 | 2 days |
| 3 | Medium | F-003, F-004 | 2 days |
| 4 | Low | F-007, F-008, F-009 | 2 days |
| 5+ | Quality | Q-001, Q-002 | Ongoing |

---

## Testing Requirements

### Before Deployment Checklist

- [ ] F-001: All federation endpoints return 401 without auth
- [ ] F-002: Origin bypass attempts are rejected
- [ ] F-003: WebSocket messages contain no executionId
- [ ] F-005: Empty ALLOWED_ORIGINS rejects cross-origin
- [ ] F-006: Messages without nodeId are rejected
- [ ] All unit tests pass
- [ ] npm audit shows no high/critical vulnerabilities

### Automated Testing

```bash
# Run security regression tests
npm run test:security

# Run full test suite
npm test

# Check dependencies
npm audit
```

---

## Rollback Procedures

### Per-Fix Rollback

Each fix can be rolled back independently by reverting the specific code changes.

### Emergency Full Rollback

```bash
# Revert to last known good commit
git revert HEAD~n

# Or checkout specific commit
git checkout <commit-hash>

# Rebuild and deploy
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## Monitoring After Deployment

### Key Metrics

- Authentication failure rate (alert if > 5/min)
- CORS rejection rate
- WebSocket connection failures
- Rate limit violations
- Federation connection status

### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Auth failures/min | 5 | 20 |
| Rate limit violations/min | 10 | 50 |
| WebSocket rejections/min | 10 | 50 |

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-19 | Initial security audit findings |
| 2.0 | 2025-12-19 | Added implementation details from expert analysis |
