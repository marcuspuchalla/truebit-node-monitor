#!/bin/bash
#
# TrueBit Incident Monitor v2.1
# Monitors attack-related addresses AND X/Twitter for new information
# Spawns Claude Code instances with browser integration to analyze changes
#
# Runs every 5 minutes to check for:
# - Balance changes on monitored addresses
# - New outgoing transactions
# - New tweets about TrueBit on xcancel.com (via Chrome browser)
#

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
STATE_DIR="$PROJECT_DIR/.incident-monitor"
LOG_FILE="$STATE_DIR/monitor.log"
LAST_TWEET_FILE="$STATE_DIR/last_tweet.txt"
CHECK_INTERVAL=300  # 5 minutes in seconds

# Ethereum RPC endpoint
ETH_RPC="https://eth.llamarpc.com"

# Addresses to monitor (parallel arrays for bash 3.x compatibility)
ADDRESS_NAMES=(
  "attacker_eoa"
  "destination_a"
  "destination_b"
  "intermediary"
  "message_sender"
  "attack_contract"
  "victim_contract"
)

ADDRESS_VALUES=(
  "0x6C8EC8f14bE7C01672d31CFa5f2CEfeAB2562b50"
  "0x62AfDD1BD84F6b152572404BE90679Ae58Eb4862"
  "0x273589ca3713e7becf42069f9fb3f0c164ce850a"
  "0x6aEcB6ee5D7fa4f5b7B5553ED0173442F0EE5ccB"
  "0xa567c6a2ac472936ed92DfE6A84CE211e42047f9"
  "0x1De399967B206e446B4E9AeEb3Cb0A0991bF11b8"
  "0x764C64b2A09b09Acb100B80d8c505Aa6a0302EF2"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Initialize state directory
init_state() {
  mkdir -p "$STATE_DIR"
  touch "$LOG_FILE"

  for name in "${ADDRESS_NAMES[@]}"; do
    if [[ ! -f "$STATE_DIR/${name}_txcount" ]]; then
      echo "0" > "$STATE_DIR/${name}_txcount"
    fi
  done

  # Initialize last tweet marker if not exists
  if [[ ! -f "$LAST_TWEET_FILE" ]]; then
    echo "" > "$LAST_TWEET_FILE"
  fi
}

log() {
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo -e "${CYAN}[$timestamp]${NC} $1"
  echo "[$timestamp] $1" >> "$LOG_FILE"
}

log_alert() {
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo -e "${RED}[$timestamp] 🚨 $1${NC}"
  echo "[$timestamp] ALERT: $1" >> "$LOG_FILE"
}

log_success() {
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo -e "${GREEN}[$timestamp] ✓ $1${NC}"
  echo "[$timestamp] $1" >> "$LOG_FILE"
}

log_x() {
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo -e "${MAGENTA}[$timestamp] 🐦 $1${NC}"
  echo "[$timestamp] X: $1" >> "$LOG_FILE"
}

# Get transaction count for an address
get_tx_count() {
  local address=$1
  local response=$(curl -s -X POST "$ETH_RPC" \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_getTransactionCount\",\"params\":[\"$address\",\"latest\"]}")

  local hex_count=$(echo "$response" | grep -o '"result":"[^"]*"' | cut -d'"' -f4)
  if [[ -n "$hex_count" ]]; then
    printf "%d" "$hex_count" 2>/dev/null || echo "0"
  else
    echo "0"
  fi
}

# Get balance for an address
get_balance() {
  local address=$1
  local response=$(curl -s -X POST "$ETH_RPC" \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_getBalance\",\"params\":[\"$address\",\"latest\"]}")

  local hex_balance=$(echo "$response" | grep -o '"result":"[^"]*"' | cut -d'"' -f4)
  echo "$hex_balance"
}

# Check for new transactions on monitored addresses
check_addresses() {
  local changes_detected=false
  local changed_addresses=""
  local i=0

  for name in "${ADDRESS_NAMES[@]}"; do
    local address="${ADDRESS_VALUES[$i]}"
    local current_tx_count=$(get_tx_count "$address")
    local current_balance=$(get_balance "$address")
    local stored_tx_count=$(cat "$STATE_DIR/${name}_txcount" 2>/dev/null || echo "0")
    local stored_balance=$(cat "$STATE_DIR/${name}_balance" 2>/dev/null || echo "0x0")

    if [[ "$current_tx_count" != "$stored_tx_count" ]]; then
      log_alert "New outgoing transaction detected on $name ($address)"
      echo "$current_tx_count" > "$STATE_DIR/${name}_txcount"
      changes_detected=true
      changed_addresses="$changed_addresses $name:$address(outgoing)"
    fi

    if [[ "$current_balance" != "$stored_balance" ]]; then
      log_alert "Balance change detected on $name ($address)"
      echo "$current_balance" > "$STATE_DIR/${name}_balance"
      changes_detected=true
      changed_addresses="$changed_addresses $name:$address(balance)"
    fi

    i=$((i + 1))
  done

  if [[ "$changes_detected" == "true" ]]; then
    echo "$changed_addresses"
  else
    echo ""
  fi
}

# STAGE 1a: Analyze if address changes are significant
analyze_address_changes() {
  local changed_addresses=$1
  local timestamp=$(date '+%Y%m%d_%H%M%S')
  local analysis_file="$STATE_DIR/analysis_addr_${timestamp}.txt"

  log "STAGE 1a: Analyzing address changes..."

  cd "$PROJECT_DIR"

  claude --print "You are an analysis agent for the TrueBit hack monitoring system.

Changes detected on these addresses: $changed_addresses

YOUR TASK:
1. Use WebFetch to check Etherscan for the latest transactions on these addresses
2. Determine if there are SIGNIFICANT changes worth documenting:
   - Fund movements > 0.1 ETH
   - New on-chain messages
   - Transfers to new addresses
   - Any laundering activity (Tornado Cash, bridges, etc.)

RESPOND WITH EXACTLY ONE OF:
- 'SIGNIFICANT: <brief description of what changed>' if changes warrant a page update
- 'NOT_SIGNIFICANT: <brief reason>' if changes are minor (dust, gas, already known)

Be concise. Only respond with one line starting with SIGNIFICANT or NOT_SIGNIFICANT." > "$analysis_file" 2>&1

  local result=$(cat "$analysis_file" | grep -E "^(SIGNIFICANT|NOT_SIGNIFICANT):" | head -1)
  if [[ -z "$result" ]]; then
    result=$(cat "$analysis_file" | grep -E "(SIGNIFICANT|NOT_SIGNIFICANT)" | head -1)
  fi

  echo "$result"
  log "Analysis saved to: $analysis_file"
}

# STAGE 1b: Check X/Twitter via Chrome browser for new posts
check_x_for_news() {
  local last_tweet=$(cat "$LAST_TWEET_FILE" 2>/dev/null || echo "")
  local timestamp=$(date '+%Y%m%d_%H%M%S')
  local x_analysis_file="$STATE_DIR/analysis_x_${timestamp}.txt"

  log_x "STAGE 1b: Checking X/Twitter via Chrome browser..."

  cd "$PROJECT_DIR"

  claude --dangerously-skip-permissions --continue --chrome --print "You are an X/Twitter monitoring agent for the TrueBit hack investigation.

YOUR TASK:
1. Use the Chrome browser MCP tools to check xcancel.com for new TrueBit posts
2. Navigate to: https://xcancel.com/search?q=truebit&f=live
3. Use mcp__claude-in-chrome__tabs_context_mcp first to get tab context
4. Create a new tab or use existing one to navigate to the search
5. Take a screenshot to see the tweets
6. Scroll down to see more tweets if needed (2-3 scrolls max)
7. Look for tweets about: hack, exploit, fund movement, official statements, security alerts

LAST SEEN TWEET (stop if you see this):
$last_tweet

WHAT TO REPORT:
- If you find NEW tweets (posted after the last seen tweet) that are SIGNIFICANT:
  - Official TrueBit statements
  - Security firm alerts (Cyvers, CertiK, SlowMist, PeckShield, etc.)
  - Reports of fund movement
  - New transaction discoveries
  Then respond: 'X_SIGNIFICANT: <brief summary of new findings>'
  Also include: 'NEWEST_TWEET: <first line or identifier of the newest tweet you saw>'

- If no new significant tweets found:
  Respond: 'X_NOT_SIGNIFICANT: No new relevant posts'
  Still include: 'NEWEST_TWEET: <first line of newest tweet>' if different from last seen

Be concise. Focus on finding genuinely new and important information." > "$x_analysis_file" 2>&1

  local result=$(cat "$x_analysis_file" | grep -E "^(X_SIGNIFICANT|X_NOT_SIGNIFICANT):" | head -1)
  local newest=$(cat "$x_analysis_file" | grep -E "^NEWEST_TWEET:" | head -1)

  # Update last seen tweet if we got a new one
  if [[ -n "$newest" ]]; then
    local tweet_content="${newest#NEWEST_TWEET: }"
    echo "$tweet_content" > "$LAST_TWEET_FILE"
    log_x "Updated last seen tweet marker"
  fi

  if [[ -z "$result" ]]; then
    result=$(cat "$x_analysis_file" | grep -E "(X_SIGNIFICANT|X_NOT_SIGNIFICANT)" | head -1)
  fi

  echo "$result"
  log "X analysis saved to: $x_analysis_file"
}

# STAGE 2: Research and update the page
update_page() {
  local finding_description=$1
  local source=$2  # "address" or "x"
  local timestamp=$(date '+%Y%m%d_%H%M%S')

  # Get current UTC time for the update
  local utc_date=$(date -u '+%b %d, %Y')
  local utc_time=$(date -u '+%H:%M')
  local utc_timestamp="$utc_date - $utc_time UTC"

  log "STAGE 2: Researching and updating page (source: $source)..."
  log "UTC timestamp for update: $utc_timestamp"

  cd "$PROJECT_DIR"

  local research_instructions=""
  local claude_cmd="claude --dangerously-skip-permissions"
  if [[ "$source" == "x" ]]; then
    research_instructions="1. Use Chrome browser MCP tools to revisit xcancel.com and get full details of the new posts
2. Extract: usernames, timestamps, key information, any linked transactions
3. Verify any mentioned transactions on Etherscan via WebFetch"
    claude_cmd="claude --dangerously-skip-permissions --continue --chrome"
  else
    research_instructions="1. Research the change in detail using Etherscan (WebFetch)
2. Find transaction hashes, amounts, destinations, any messages"
  fi

  $claude_cmd "You are an autonomous research agent for the TrueBit hack investigation.

A significant change was detected: $finding_description
Source: $source

CURRENT UTC TIMESTAMP: $utc_timestamp

=== YOUR TASKS ===
$research_instructions
3. Update the SecurityIncident.vue page with a new entry

=== STRICT RULES - YOU MUST FOLLOW THESE ===

1. ONLY modify these files:
   - monitor/frontend/src/views/SecurityIncident.vue
   - monitor/frontend/package.json (version bump only)

2. DO NOT modify any other files in the project.

3. NEVER remove or modify existing content. Only ADD new entries.

4. When adding a new update entry:
   - Read the file first to find the highest existing ID in the updates array
   - Use the next sequential ID (e.g., if highest is 9, use 10)
   - Add to the BEGINNING of the updates array (newest first display)
   - Use this EXACT timestamp for the entry: '$utc_timestamp'
   - Include links to sources (Etherscan for transactions, tweet links if from X)
   - If from X, mention the source accounts (e.g., 'Reported by @CertiKAlert')
   - Include this note at the end of the content:
     '<p class=\"text-xs text-slate-500 mt-2 italic\">This update was generated automatically by the tru.watch monitoring system running every 5 minutes.</p>'

5. Update the timeline array if adding significant events:
   - Add new entries at the BEGINNING (newest first)
   - Renumber the timeline IDs sequentially from 1
   - Link to the correct updateId

6. Update these timestamps to EXACTLY '$utc_timestamp':
   - lastResearchTime = '$utc_timestamp'
   - pageLastUpdated = '$utc_timestamp'

7. Version bump:
   - Only bump monitor/frontend/package.json version
   - Increment patch version (e.g., 0.1.14 -> 0.1.15)
   - Do NOT bump backend or aggregator versions

8. Commit message format (use HEREDOC):
   feat(auto): <brief description of finding>

   Generated by tru.watch autonomous monitoring
   Source: $source

   Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

9. After committing, push to origin main.

=== END RULES ===

Proceed with the research and update." 2>&1 | tee -a "$LOG_FILE"

  log_success "Page update complete"
}

# Main monitoring loop
main() {
  echo -e "${CYAN}"
  echo "╔═══════════════════════════════════════════════════════════════╗"
  echo "║          TrueBit Incident Monitor v2.1                        ║"
  echo "║  Monitoring ${#ADDRESS_NAMES[@]} addresses + X/Twitter every 5 minutes          ║"
  echo "║                                                               ║"
  echo "║  Two-stage process:                                           ║"
  echo "║    1a. Analyze address changes (via RPC + Etherscan)          ║"
  echo "║    1b. Check X/Twitter (via Chrome browser)                   ║"
  echo "║    2.  Research and update page only if warranted             ║"
  echo "╚═══════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"

  init_state

  log "State directory: $STATE_DIR"
  log "Log file: $LOG_FILE"
  log "Check interval: ${CHECK_INTERVAL} seconds (5 minutes)"
  echo ""

  # Initial state capture
  log "Capturing initial address state..."
  local i=0
  for name in "${ADDRESS_NAMES[@]}"; do
    local address="${ADDRESS_VALUES[$i]}"
    local tx_count=$(get_tx_count "$address")
    local balance=$(get_balance "$address")
    echo "$tx_count" > "$STATE_DIR/${name}_txcount"
    echo "$balance" > "$STATE_DIR/${name}_balance"
    log "  $name: txcount=$tx_count"
    i=$((i + 1))
  done
  echo ""
  log_success "Initial state captured. Starting monitoring loop..."
  echo ""

  local check_count=0

  while true; do
    check_count=$((check_count + 1))
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "Check #$check_count"

    local updates_made=false

    # === PART 1: Check addresses ===
    log "Checking addresses for changes..."
    local address_changes=$(check_addresses)

    if [[ -n "$address_changes" ]]; then
      log_alert "ADDRESS CHANGES DETECTED!"
      log "Changed: $address_changes"

      local addr_analysis=$(analyze_address_changes "$address_changes")
      log "Address analysis: $addr_analysis"

      if [[ "$addr_analysis" == SIGNIFICANT:* ]]; then
        local description="${addr_analysis#SIGNIFICANT: }"
        log_alert "Address change is SIGNIFICANT: $description"
        update_page "$description" "address"
        updates_made=true
      else
        log_success "Address change not significant, skipping"
      fi
    else
      log_success "No address changes"
    fi

    echo ""

    # === PART 2: Check X/Twitter ===
    log_x "Checking X/Twitter for news..."
    local x_analysis=$(check_x_for_news)
    log_x "X analysis: $x_analysis"

    if [[ "$x_analysis" == X_SIGNIFICANT:* ]]; then
      local x_description="${x_analysis#X_SIGNIFICANT: }"
      log_alert "X news is SIGNIFICANT: $x_description"
      update_page "$x_description" "x"
      updates_made=true
    else
      log_success "No significant X news"
    fi

    echo ""

    if [[ "$updates_made" == "false" ]]; then
      log_success "No updates needed this cycle"
    fi

    log "Next check in $CHECK_INTERVAL seconds (5 minutes)... (Ctrl+C to stop)"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    sleep "$CHECK_INTERVAL"
  done
}

# Handle Ctrl+C gracefully
trap 'echo -e "\n${YELLOW}Monitor stopped by user${NC}"; exit 0' INT

# Run main
main "$@"
