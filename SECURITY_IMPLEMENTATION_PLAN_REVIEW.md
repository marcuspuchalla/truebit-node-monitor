# Review: SECURITY_IMPLEMENTATION_PLAN.md

This review focuses on risks, gaps, and clarifications in the implementation
plan. Findings are ordered by severity.

## Findings

### Critical
- **Auth scope mismatch for federation endpoints**
  - **Where**: Plan “F-001: Federation Endpoints Unauthenticated”
  - **Issue**: The proposed auth only checks `X-Session-Token`, but the backend
    already supports `API_KEY` (Bearer) for API auth. If `API_KEY` is enabled,
    federation endpoints should accept either `X-Session-Token` or `Authorization`
    bearer to avoid breaking headless/automation flows.
  - **Why fix**: Operators using API keys will be locked out; any tooling that
    relies on API_KEY would fail post‑change.
  - **Suggestion**: Implement a unified auth helper that accepts session token
    OR API key when enabled, and reuse it across routes.

### High
- **Origin allowlist logic does not handle `*` and non‑URL allowlist entries**
  - **Where**: Plan “F-002: Origin Allowlist Bypass via startsWith”
  - **Issue**: The new `URL()` parsing will throw for `*` and for entries missing
    scheme (e.g., `example.com`). The existing websocket code currently allows
    `*`; the plan removes that behavior inadvertently.
  - **Why fix**: Legitimate configs will be rejected, causing production outages.
  - **Suggestion**: Explicitly handle `*` and document required allowlist format
    (full origin `https://host:port`). Optionally normalize missing scheme.

- **CORS secure default may block same‑origin UI**
  - **Where**: Plan “F-005: CORS Defaults Allow All Origins”
  - **Issue**: When `ALLOWED_ORIGINS` is empty, the plan rejects all cross‑origin,
    but browser requests from the same UI origin still send an `Origin` header.
    This will break the built‑in UI unless ALLOWED_ORIGINS is always set.
  - **Why fix**: This is a breaking change for default deployments.
  - **Suggestion**: Allow same‑origin when `origin` matches the request host, or
    explicitly require ALLOWED_ORIGINS in deployment docs and include a startup
    warning that the UI will not work without it.

### Medium
- **Aggregator rate limiting order and validation flow**
  - **Where**: Plan “F-006: Aggregator Rate Limiting Bypass”
  - **Issue**: The proposed change checks `nodeId` before validating message
    structure. Handlers currently call `validateMessage()` first. Using `msg` before
    validation risks processing malformed data and may log misleading info.
  - **Why fix**: Prevents bad data from affecting rate limiter state and reduces
    error noise.
  - **Suggestion**: Keep `validateMessage()` first, then call `isRateLimited()`
    using the validated `nodeId`.

- **WebSocket auth decision incomplete**
  - **Where**: Plan “F-004: WebSocket Auth Unusable”
  - **Issue**: The plan recommends removing auth or fully implementing it, but
    does not specify which path is chosen or how to handle reconnections and
    session expiry if auth is kept.
  - **Why fix**: Incomplete decision blocks implementation and test plans.
  - **Suggestion**: Pick one option. If implementing, define a handshake with
    session tokens, retry on reconnect, and document token expiry behavior.

### Low
- **Container exec hardening should cover all command paths**
  - **Where**: Plan “F-007: Container Exec Shell Injection”
  - **Issue**: Plan suggests switching to argument arrays for `execCommand`, but
    `tail -f` in `tailCurrentLog()` still uses an array already; ensure all uses
    of `sh -c` are removed, including in `eventdb-reader.ts`.
  - **Why fix**: Partial changes may leave the injection risk intact.
  - **Suggestion**: Enumerate all `execCommand` usages and replace with array‑based
    exec, or centralize exec in a safe helper.

## Additional Notes
- **Testing plan assumes new scripts**: `npm run test:security` is referenced but
  does not exist today. Add or remove these commands to avoid confusion.
- **Risk matrix vs. plan count**: Plan references 9 security findings + 2 quality
  observations; ensure it matches the current `SECURITY_AUDIT.md` contents and
  terminology (e.g., executionId leak, origin bypass).

## Questions / Clarifications
- Should federation endpoints accept API_KEY auth in addition to session tokens?
- Is the UI expected to work out‑of‑the‑box without setting `ALLOWED_ORIGINS`?
- Which WS auth path is preferred: remove auth or implement handshake?
