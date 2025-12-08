# Security Audit Report: TrueBit Node Monitor

**Audit Date**: December 1, 2025
**Version**: 1.0
**Overall Risk Level**: MEDIUM (Acceptable for production with remediation plan)

---

## Executive Summary

A comprehensive security audit was conducted across all three components of the TrueBit Node Monitor system:
- **Monitor Backend** (Node.js/Express)
- **Frontend** (Vue.js)
- **Federation Aggregator** (Node.js)

The audit identified **30+ security findings** ranging from Critical to Low severity. The codebase demonstrates strong privacy-first design with excellent anonymization and data protection. However, several areas require attention before the application can be considered fully production-hardened.

### Key Findings

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 2 | Requires immediate attention |
| High | 8 | Should fix before production |
| Medium | 12 | Plan for remediation |
| Low | 10 | Nice to have |

---

## Critical Findings

### 1. SQL Injection in Aggregator `getDistribution()` Method

**Component**: Federation Aggregator
**File**: `federation-aggregator/src/database.ts:339-354`
**Severity**: CRITICAL

**Issue**: Column and table names are interpolated directly into SQL queries:
```typescript
const stmt = this.db.prepare(`
  SELECT ${column} as bucket, COUNT(*) as count
  FROM ${table}
  WHERE ${column} IS NOT NULL
  GROUP BY ${column}
`);
```

**Risk**: If column/table parameters are ever sourced from user input or network messages, this enables SQL injection attacks.

**Remediation**:
```typescript
const ALLOWED_COLUMNS = new Set(['execution_time_bucket', 'gas_used_bucket', 'chain_id']);
const ALLOWED_TABLES = new Set(['aggregated_tasks', 'aggregated_invoices']);

if (!ALLOWED_COLUMNS.has(column) || !ALLOWED_TABLES.has(table)) {
  throw new Error('Invalid column or table name');
}
```

**Priority**: IMMEDIATE

---

### 2. Wallet Address Stored in Plaintext (Local Database)

**Component**: Monitor Backend
**File**: `backend/src/db/database.ts:495-512`
**Severity**: CRITICAL (for local database security)

**Issue**: Node status table stores wallet addresses without encryption:
```typescript
return stmt.run(
  status.address,  // Raw wallet address stored
  ...
);
```

**Risk**: If the database file is compromised (via Docker escape, backup theft, etc.), wallet addresses are exposed.

**Mitigation Already in Place**:
- Wallet never transmitted to federation (blocked by validator)
- Federation only receives hashed values
- Database is in Docker volume

**Recommended Enhancement**:
- Hash wallet addresses in database
- Or implement SQLite encryption (SQLCipher)
- Document this as a known limitation

**Priority**: HIGH (for defense in depth)

---

## High Severity Findings

### 3. No API Authentication

**Component**: Monitor Backend
**File**: `backend/src/index.ts:380-385`

**Issue**: All REST API endpoints are publicly accessible without authentication.

**Exposed Endpoints**:
- `/api/status` - Node status and metrics
- `/api/tasks` - Task history
- `/api/invoices` - Invoice data
- `/api/federation/settings` - Federation configuration
- `/api/federation/enable` - Can enable/disable federation

**Remediation Options**:
1. **Minimal**: API key in Authorization header
2. **Better**: JWT authentication
3. **Best**: OAuth2 with proper session management

**Recommended Quick Fix**:
```typescript
const API_KEY = process.env.API_KEY;
if (API_KEY) {
  app.use('/api/', (req, res, next) => {
    if (req.headers.authorization !== `Bearer ${API_KEY}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  });
}
```

---

### 4. Weak WebSocket Authentication

**Component**: Monitor Backend
**File**: `backend/src/websocket/server.ts:6-119`

**Issues**:
- Random token generated if `WS_AUTH_TOKEN` not set (different on each restart)
- Authentication can be disabled entirely
- No token expiration

**Remediation**:
- Require explicit token configuration in production
- Implement token expiration/refresh
- Log authentication failures for monitoring

---

### 5. Missing Input Validation in Federation Messages

**Component**: Federation Aggregator
**File**: `federation-aggregator/src/index.ts:56-119`

**Issue**: Message handlers accept data without runtime validation:
```typescript
function handleTaskReceived(data: FederationMessage, _subject: string): void {
  db.upsertTask({
    taskIdHash: data.data?.taskIdHash,  // No validation
    ...
  });
}
```

**Remediation**: Implement Zod schema validation:
```typescript
import { z } from 'zod';

const TaskMessageSchema = z.object({
  data: z.object({
    taskIdHash: z.string().max(64).regex(/^[a-f0-9]+$/),
    chainId: z.string().max(10).optional(),
  }).optional()
});

function handleTaskReceived(data: unknown, _subject: string): void {
  const parsed = TaskMessageSchema.safeParse(data);
  if (!parsed.success) return; // Invalid message
  db.upsertTask(parsed.data.data);
}
```

---

### 6. No Rate Limiting on Federation Messages

**Component**: Federation Aggregator
**File**: `federation-aggregator/src/nats-client.ts:83-90`

**Issue**: Messages processed without rate limiting. A compromised node could flood the aggregator.

**Remediation**:
```typescript
const rateLimiter = new Map<string, number[]>();
const MAX_PER_SECOND = 100;

function isRateLimited(nodeId: string): boolean {
  const now = Date.now();
  const times = rateLimiter.get(nodeId) || [];
  const recent = times.filter(t => now - t < 1000);
  if (recent.length >= MAX_PER_SECOND) return true;
  recent.push(now);
  rateLimiter.set(nodeId, recent);
  return false;
}
```

---

### 7. Hardcoded NATS Server URL

**Component**: Multiple
**Files**: `backend/src/federation/client.ts:27`, `federation-aggregator/src/index.ts:42`

**Issue**: Default NATS server hardcoded in source code:
```typescript
const DEFAULT_NATS_SERVER = 'wss://f.tru.watch';
```

**Risk**: If domain is compromised, all nodes default to malicious server.

**Remediation**:
- Require explicit configuration (fail if not set)
- Implement certificate pinning
- Document that users should verify the default server

---

### 8. Console Logging of Sensitive Data

**Component**: Frontend
**File**: `frontend/src/stores/federation.ts:156-164`

**Issue**: Federation settings and status logged to browser console:
```typescript
console.log('Store: settings after enable:', this.settings);
console.log('Store: status after enable:', this.status);
```

**Risk**: Sensitive configuration visible in DevTools.

**Remediation**: Remove all `console.log()` statements or use conditional logging:
```typescript
const DEBUG = import.meta.env.MODE === 'development';
if (DEBUG) console.log(...);
```

---

## Medium Severity Findings

### 9. Missing Content Security Policy

**Component**: Frontend
**File**: `frontend/index.html`

**Issue**: No CSP headers configured.

**Remediation**: Add to index.html:
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  connect-src 'self' ws: wss:;
  frame-ancestors 'none';
">
```

---

### 10. Helmet CSP Disabled

**Component**: Monitor Backend
**File**: `backend/src/index.ts:51-56`

**Issue**: CSP explicitly disabled in Helmet:
```typescript
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
```

**Remediation**: Re-enable with permissive settings for Vue:
```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  }
}));
```

---

### 11. Infinite NATS Reconnection Loop

**Component**: Federation Aggregator
**File**: `federation-aggregator/src/nats-client.ts:46`

**Issue**: `maxReconnectAttempts: -1` causes infinite retry loop.

**Remediation**:
```typescript
maxReconnectAttempts: 10,
reconnectTimeWait: 5000,
```

---

### 12. Insufficient Query Parameter Validation

**Component**: Monitor Backend
**Files**: `backend/src/routes/logs.ts:22-26`, `tasks.ts:50-54`, `invoices.ts:18-20`

**Issue**: Query parameters parsed without validation middleware.

**Remediation**: Apply existing Zod validation middleware to all routes.

---

### 13. Path Traversal Risk in Container Log Reading

**Component**: Monitor Backend
**File**: `backend/src/docker/logfile-reader.ts:30-48`

**Issue**: Shell commands constructed for Docker exec. Currently safe but fragile.

**Remediation**: Use command arrays instead of shell strings where possible.

---

### 14. Docker Socket Full Access

**Component**: Monitor Backend
**File**: `backend/src/docker/client.ts:30-34`

**Issue**: Full Docker API access, though only read operations used.

**Remediation**:
- Document that only read operations are performed
- Consider implementing ACL checks
- Run with Docker socket proxy if high security required

---

### 15. Container Name Loose Matching

**Component**: Monitor Backend
**File**: `backend/src/docker/client.ts:40-48`

**Issue**: `includes()` match could match wrong container.

**Remediation**: Use exact or prefix matching with boundaries.

---

### 16. Missing CSRF Protection

**Component**: Frontend
**File**: `frontend/src/services/api.ts`

**Issue**: State-changing operations don't include CSRF tokens.

**Remediation**: Implement CSRF token handling:
```typescript
xsrfCookieName: 'XSRF-TOKEN',
xsrfHeaderName: 'X-XSRF-TOKEN'
```

---

### 17. Error Messages Exposed to UI

**Component**: Frontend
**File**: Multiple stores

**Issue**: Backend error messages directly displayed to users.

**Remediation**: Map errors to user-friendly messages:
```typescript
catch (error) {
  this.error = 'Operation failed. Please try again.';
  console.error('Technical details:', error);
}
```

---

### 18. No Client-Side API Rate Limiting

**Component**: Frontend
**File**: `frontend/src/services/api.ts`

**Issue**: Unlimited API requests from frontend.

**Remediation**: Implement request queue with rate limiting.

---

### 19. Missing TLS Certificate Validation

**Component**: Monitor Backend
**File**: `backend/src/federation/client.ts:168-176`

**Issue**: TLS CA certificate optional, could accept any certificate.

**Remediation**: Require CA certificate in production environments.

---

### 20. Environment Variable Parsing Without Validation

**Component**: Federation Aggregator
**File**: `federation-aggregator/src/index.ts:41-47`

**Issue**: `parseInt()` without NaN checks, no range validation.

**Remediation**: Validate all environment variables at startup.

---

## Low Severity Findings

### 21. Debug Logging in Production

Multiple files contain `console.log()` statements that should be removed or conditionalized.

### 22. No Error Context in Catch Blocks

Stack traces lost in many error handlers.

### 23. Missing Transaction Safety

Database operations not wrapped in transactions.

### 24. Dependency Version Pinning

Using caret (`^`) versions allows unexpected updates.

### 25. Global State Mutation

WebSocket global assignment in aggregator.

### 26. No HTTPS Enforcement

WebSocket protocol selection doesn't enforce HTTPS in production.

### 27. Search Input Length Not Limited

Search fields could accept very long strings.

### 28. Information Disclosure in Logs

Configuration details logged on startup.

### 29. No Structured Logging

Console logging without consistent format.

### 30. Missing Audit Trail

No logging of security-relevant events.

---

## Privacy Assessment

### Strengths (Excellent)

1. **Wallet Address Protection**: Never transmitted to federation, blocked by validator
2. **Private Key Security**: No access to secrets directory, read-only Docker socket
3. **Anonymization**: SHA256 hashing with per-node salt
4. **Metric Bucketing**: 5-8 ranges per metric prevents fingerprinting
5. **Timestamp Rounding**: 5-minute intervals prevent timing correlation
6. **IP Privacy**: NATS leaf node protocol hides peer IPs
7. **Privacy Validator**: Active blocking of sensitive data patterns
8. **WebSocket Sanitization**: Input/output data stripped before broadcast

### Weaknesses (Moderate)

1. **No Message Batching**: Real-time publishing enables timing attacks
2. **Centralized Aggregator**: Single point stores all message history
3. **Salt Storage**: Salt stored alongside hashes in database

### Privacy Rating: 8.5/10

---

## Remediation Roadmap

### Phase 1: Immediate (Week 1)

| Priority | Finding | Effort |
|----------|---------|--------|
| CRITICAL | #1 SQL Injection in getDistribution | 1 hour |
| HIGH | #3 Add basic API authentication | 4 hours |
| HIGH | #8 Remove console.log statements | 2 hours |
| HIGH | #5 Add Zod validation to aggregator | 4 hours |

### Phase 2: Short-term (Weeks 2-3)

| Priority | Finding | Effort |
|----------|---------|--------|
| HIGH | #4 Strengthen WebSocket auth | 8 hours |
| HIGH | #6 Add rate limiting | 4 hours |
| MEDIUM | #9 Add CSP headers | 2 hours |
| MEDIUM | #10 Re-enable Helmet CSP | 2 hours |
| MEDIUM | #12 Add query validation | 4 hours |

### Phase 3: Medium-term (Weeks 4-6)

| Priority | Finding | Effort |
|----------|---------|--------|
| CRITICAL | #2 Encrypt wallet in database | 8 hours |
| MEDIUM | #16 Add CSRF protection | 4 hours |
| MEDIUM | #17 Sanitize error messages | 4 hours |
| MEDIUM | #11 Fix NATS reconnect | 1 hour |

### Phase 4: Long-term (Ongoing)

| Priority | Finding | Effort |
|----------|---------|--------|
| LOW | Implement structured logging | 8 hours |
| LOW | Add audit trail | 16 hours |
| LOW | Add message batching for privacy | 16 hours |
| LOW | Implement dependency auditing | 2 hours |

---

## Recommendations for Maximum Security

### For Node Operators

1. **Enable WebSocket Authentication**
   ```bash
   export WS_AUTH_REQUIRED=true
   export WS_AUTH_TOKEN=$(openssl rand -hex 32)
   ```

2. **Restrict Network Access**
   - Run behind firewall
   - Use VPN for remote access
   - Whitelist allowed origins

3. **Regular Updates**
   - Pull latest changes frequently
   - Review changelog for security fixes

### For Infrastructure Operators

1. **Docker Security**
   - Use Docker socket proxy (e.g., docker-socket-proxy)
   - Run with user namespaces
   - Apply seccomp profiles

2. **Network Isolation**
   - Place monitor in isolated Docker network
   - Use reverse proxy with rate limiting
   - Enable TLS for all connections

3. **Monitoring**
   - Set up log aggregation
   - Alert on authentication failures
   - Monitor for unusual API patterns

### For Developers

1. **Code Quality**
   - Run `npm audit` regularly
   - Enable TypeScript strict mode
   - Use ESLint security plugins

2. **Testing**
   - Add security-focused unit tests
   - Perform penetration testing
   - Test with malformed inputs

3. **Documentation**
   - Document all security decisions
   - Maintain threat model
   - Keep dependencies documented

---

## Conclusion

The TrueBit Node Monitor demonstrates **strong security fundamentals** with excellent privacy protection. The critical findings are addressable with moderate effort, and the overall architecture is sound.

**Recommended Actions**:
1. Fix Critical finding #1 (SQL injection) immediately
2. Implement basic API authentication before public deployment
3. Follow the remediation roadmap over the next 6 weeks

**Risk Assessment After Remediation**: LOW

---

## Appendix: Security Checklist

### Pre-Deployment Checklist

- [ ] Fix SQL injection in aggregator
- [ ] Enable API authentication
- [ ] Remove debug console.log statements
- [ ] Add federation message validation
- [ ] Configure allowed origins
- [ ] Set WebSocket authentication token
- [ ] Review Docker socket permissions
- [ ] Test with security scanner (OWASP ZAP)

### Ongoing Security Tasks

- [ ] Weekly dependency audit
- [ ] Monthly security review
- [ ] Quarterly penetration testing
- [ ] Log review for anomalies

---

*Report generated by security audit team. For questions, open an issue on GitHub.*
