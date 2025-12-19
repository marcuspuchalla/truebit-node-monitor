# Security Review Plan 2.0

This review reflects the current code state after recent changes. It lists the
status of prior findings, identifies new gaps, and defines the next fixes.

## Summary

The audit now shows the remaining P1/P2 items have been implemented: federation
endpoints are session‑token only, WebSocket auth handshake is enabled, same‑origin
CORS works without `ALLOWED_ORIGINS`, container exec uses array‑based commands,
and the dead registration flow is removed. Optional CSP tightening remains.

## Findings and Status

### Fixed
- **F-002: Origin allowlist bypass**  
  - **Where**: `monitor/backend/src/index.ts`, `monitor/backend/src/websocket/server.ts`  
  - **Status**: Fixed. Uses URL parsing and exact origin matching.

- **F-003: WebSocket broadcast leaks executionId**  
  - **Where**: `monitor/backend/src/websocket/server.ts`  
  - **Status**: Fixed. Strips `executionId` and `execution_id` across message types.

- **F-006: Aggregator rate limiting bypass**  
  - **Where**: `aggregator/src/index.ts`  
  - **Status**: Fixed. Global limiter added; messages without `nodeId` rejected.

- **F-009: CSP unsafe-eval in production**  
  - **Where**: `monitor/backend/src/index.ts`  
  - **Status**: Partially improved. `unsafe-eval` removed in production, still
    allows `unsafe-inline`.

- **F-001: Federation endpoints unauthenticated (policy mismatch)**  
  - **Where**: `monitor/backend/src/routes/federation.ts`  
  - **Status**: Fixed. Session token only.

- **F-004: WebSocket auth handshake**  
  - **Where**: `monitor/backend/src/websocket/server.ts`,
    `monitor/frontend/src/services/websocket.ts`  
  - **Status**: Fixed. Auth handshake added; unauthenticated clients time out.

- **F-005: CORS default blocks UI**  
  - **Where**: `monitor/backend/src/index.ts`  
  - **Status**: Fixed. Same‑origin allowed when no allowlist is configured.

- **F-007: Container exec shell injection**  
  - **Where**: `monitor/backend/src/docker/logfile-reader.ts`,
    `monitor/backend/src/docker/eventdb-reader.ts`  
  - **Status**: Fixed. Array‑based exec used throughout.

- **F-008: Dead registration flow**  
  - **Where**: `monitor/backend/src/parsers/log-parser.ts`,
    `monitor/backend/src/index.ts`  
  - **Status**: Fixed. Registration parsing removed.

### Not Yet Fixed / Regressed
- **F-009: CSP unsafe-inline in production**  
  - **Where**: `monitor/backend/src/index.ts`  
  - **Issue**: CSP still allows `unsafe-inline`, which weakens script/style
    protections.  
  - **Risk**: Increased XSS impact if an injection path is found.

## Plan 2.0 (Next Fixes)

### P1 (Immediate)
1) **CSP tightening**  
   - Evaluate removing `unsafe-inline` in production with nonces/hashes.  
   - File: `monitor/backend/src/index.ts`

## Verification Checklist

- Federation endpoints reject API key and accept session token only.
- WebSocket rejects unauthenticated clients after timeout; auth succeeds via
  session token; reconnects re‑authenticate.
- UI works out‑of‑the‑box without `ALLOWED_ORIGINS` and WS accepts same‑origin.
- Container exec paths no longer use `sh -c`.
- No `executionId`/`execution_id` fields appear in WS payloads.

## Notes

- If same‑origin CORS allowance is implemented, document it in deployment docs
  and add a startup warning when `ALLOWED_ORIGINS` is unset.
