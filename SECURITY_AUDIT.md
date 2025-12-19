# Truebit Node Monitor - Security and Quality Findings

This document lists findings from a code review of the Truebit node monitor and
aggregator. Each item includes what/where the issue is, why it should be fixed,
and a concrete recommendation.

## Findings

### F-001: Federation control endpoints are unauthenticated (High)
- **Where**: `monitor/backend/src/index.ts`, `monitor/backend/src/routes/federation.ts`
- **Problem**: `/api/federation/*` endpoints (enable/disable, settings update,
  reset, peer block) are not protected by session auth or API key and are
  excluded from CSRF checks. If the API is reachable, anyone can change
  federation settings or redirect the node to attacker-controlled servers.
- **Why fix**: This enables remote control of federation connectivity and data
  flows, which can lead to data exposure, service disruption, or node
  manipulation.
- **Recommendation**: Require authentication (session token or API key) on all
  federation endpoints and enforce CSRF for state-changing actions. Consider a
  separate “admin token” for federation changes.

### F-002: Origin allowlist bypass via `startsWith` (High)
- **Where**: `monitor/backend/src/index.ts`, `monitor/backend/src/websocket/server.ts`
- **Problem**: Origin checks use `origin.startsWith(allowed)` which allows
  `https://example.com.evil.com` if `https://example.com` is allowlisted.
- **Why fix**: This allows hostile domains to pass origin checks and access API
  or WebSocket data.
- **Recommendation**: Parse origins with `new URL()` and compare the exact
  `origin` (scheme + host + port). Only allow exact matches.

### F-003: WebSocket task broadcasts leak `executionId` (Medium)
- **Where**: `monitor/backend/src/websocket/server.ts`
- **Problem**: Sanitizer removes `execution_id` but not `executionId`, so
  real‑time task broadcasts include full execution IDs.
- **Why fix**: Execution IDs can be sensitive and are explicitly avoided in
  federation publishing. Broadcasting them leaks internal identifiers to any WS
  client.
- **Recommendation**: Strip both `execution_id` and `executionId` fields before
  broadcasting.

### F-004: WebSocket auth is unusable in practice (Medium)
- **Where**: `monitor/backend/src/websocket/server.ts`,
  `monitor/frontend/src/services/websocket.ts`
- **Problem**: When `WS_AUTH_REQUIRED=true`, the server expects an auth message,
  but the frontend never sends one. Operators will likely disable WS auth.
- **Why fix**: Leads to insecure defaults or broken functionality.
- **Recommendation**: Add client‑side auth handshake support, or remove WS auth
  and document that WS is unauthenticated while restricting access by network
  policy.

### F-005: CORS defaults allow all origins (Medium)
- **Where**: `monitor/backend/src/index.ts`
- **Problem**: If `ALLOWED_ORIGINS` is not set, all origins are allowed and
  credentials are enabled.
- **Why fix**: Broad CORS makes CSRF harder to control and increases exposure if
  any browser‑based auth or cookies are added in the future.
- **Recommendation**: Default to same‑origin only and require explicit
  allowlist for cross‑origin access.

### F-006: Aggregator rate limiting can be bypassed (Medium)
- **Where**: `aggregator/src/index.ts`
- **Problem**: Rate limiting only applies when `nodeId` is present. A flood of
  messages without `nodeId` bypasses the limiter.
- **Why fix**: Enables memory/DB amplification and log spam, degrading service.
- **Recommendation**: Reject messages without a valid `nodeId` or implement a
  global limiter and message size caps.

### F-007: Container exec uses `sh -c` with unescaped filenames (Low)
- **Where**: `monitor/backend/src/docker/logfile-reader.ts`,
  `monitor/backend/src/docker/eventdb-reader.ts`
- **Problem**: Log/event file paths from `ls` are interpolated into `sh -c`
  commands. A malicious filename inside the container could inject shell
  commands.
- **Why fix**: If the container is compromised, this can escalate within the
  container and affect the monitor process.
- **Recommendation**: Use exec with argument arrays (no shell) or robustly
  escape/quote file paths.

### F-008: Registration flow is dead code (Low)
- **Where**: `monitor/backend/src/parsers/log-parser.ts`,
  `monitor/backend/src/index.ts`
- **Problem**: `handleRegistration` expects `parsed.nodeAddress`, but the parser
  never sets it (commented out). Registration events are never processed.
- **Why fix**: Dead code increases maintenance risk and can lead to false
  assumptions about data coverage.
- **Recommendation**: Either extract and hash the address in the parser or
  remove the unused path.

### F-009: CSP uses `unsafe-inline` and `unsafe-eval` (Low)
- **Where**: `monitor/backend/src/index.ts`
- **Problem**: CSP allows `unsafe-inline`/`unsafe-eval`, which weakens the CSP
  and increases XSS impact.
- **Why fix**: It reduces protection against script injection.
- **Recommendation**: Restrict CSP for production builds and use nonces or
  hashes if needed.

## Quality Observations (non‑security)

### Q-001: Duplicated auth hashing logic (Maintainability)
- **Where**: `monitor/frontend/src/composables/usePreloader.ts`,
  `monitor/frontend/src/views/ProtectedRoute.vue`
- **Problem**: SHA‑256 hashing and challenge handling logic is duplicated.
- **Why fix**: Duplication increases bug risk and makes changes harder.
- **Recommendation**: Extract to a shared utility module.

### Q-002: Minimal test coverage (Maintainability)
- **Where**: Only `monitor/backend/src/federation/anonymizer.test.ts` exists.
- **Problem**: Critical flows (auth, federation settings, WS redaction) lack
  automated tests.
- **Why fix**: Raises regression risk for security‑critical features.
- **Recommendation**: Add tests for auth endpoints, federation settings
  authorization, and WebSocket redaction.
