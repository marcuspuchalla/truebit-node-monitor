#!/bin/bash
#
# TrueBit Incident Monitor
# Continuously monitors attack-related addresses and X for new information
# Spawns Claude Code instances to analyze and update the site when changes detected
#

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
STATE_DIR="$PROJECT_DIR/.incident-monitor"
LOG_FILE="$STATE_DIR/monitor.log"
CHECK_INTERVAL=60  # seconds

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

# X/Twitter search terms
SEARCH_TERMS=("truebit%20hack" "truebit%20exploit" "truebit%20security")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Initialize state directory
init_state() {
  mkdir -p "$STATE_DIR"
  touch "$LOG_FILE"

  # Initialize transaction counts if not exists
  for name in "${ADDRESS_NAMES[@]}"; do
    if [[ ! -f "$STATE_DIR/${name}_txcount" ]]; then
      echo "0" > "$STATE_DIR/${name}_txcount"
    fi
  done

  # Initialize X check timestamp
  if [[ ! -f "$STATE_DIR/x_last_check" ]]; then
    echo "0" > "$STATE_DIR/x_last_check"
  fi

  # Initialize seen tweets file
  if [[ ! -f "$STATE_DIR/seen_tweets" ]]; then
    touch "$STATE_DIR/seen_tweets"
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

# Get transaction count for an address
get_tx_count() {
  local address=$1
  local response=$(curl -s -X POST "$ETH_RPC" \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_getTransactionCount\",\"params\":[\"$address\",\"latest\"]}")

  local hex_count=$(echo "$response" | grep -o '"result":"[^"]*"' | cut -d'"' -f4)
  if [[ -n "$hex_count" ]]; then
    # Convert hex to decimal
    printf "%d" "$hex_count" 2>/dev/null || echo "0"
  else
    echo "0"
  fi
}

# Get balance for an address (to detect incoming txs)
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

    # Check if transaction count changed (outgoing tx)
    if [[ "$current_tx_count" != "$stored_tx_count" ]]; then
      log_alert "New outgoing transaction detected on $name ($address)"
      log_alert "TX count changed: $stored_tx_count -> $current_tx_count"
      echo "$current_tx_count" > "$STATE_DIR/${name}_txcount"
      changes_detected=true
      changed_addresses="$changed_addresses $name(outgoing)"
    fi

    # Check if balance changed (incoming tx)
    if [[ "$current_balance" != "$stored_balance" ]]; then
      log_alert "Balance change detected on $name ($address)"
      log_alert "Balance changed: $stored_balance -> $current_balance"
      echo "$current_balance" > "$STATE_DIR/${name}_balance"
      changes_detected=true
      changed_addresses="$changed_addresses $name(balance)"
    fi

    i=$((i + 1))
  done

  if [[ "$changes_detected" == "true" ]]; then
    echo "$changed_addresses"
  else
    echo ""
  fi
}

# Check X (via xcancel) for new TrueBit-related posts
check_x_for_news() {
  local new_info=""

  for term in "${SEARCH_TERMS[@]}"; do
    local url="https://xcancel.com/search?q=${term}&f=live"

    # Fetch and extract tweet snippets (simplified - just check for new content)
    local content=$(curl -s "$url" 2>/dev/null | grep -oE 'tweet-content[^<]*<[^>]*>[^<]*' | head -5)
    local content_hash=$(echo "$content" | md5 2>/dev/null || echo "$content" | md5sum 2>/dev/null | cut -d' ' -f1)

    local stored_hash=$(cat "$STATE_DIR/x_hash_${term}" 2>/dev/null || echo "")

    if [[ -n "$content" && "$content_hash" != "$stored_hash" ]]; then
      log_alert "New X content detected for search: '$term'"
      echo "$content_hash" > "$STATE_DIR/x_hash_${term}"
      new_info="$new_info|$term"
    fi
  done

  echo "$new_info"
}

# Spawn Claude Code to analyze new transaction
analyze_transaction() {
  local changed_addresses=$1
  local timestamp=$(date '+%Y%m%d_%H%M%S')
  local report_file="$STATE_DIR/report_${timestamp}.md"

  log "Spawning Claude Code to analyze transaction changes..."

  local prompt="A change was detected in the TrueBit hack monitoring. Addresses with changes: $changed_addresses

Please:
1. Fetch the latest transactions from Etherscan for these addresses
2. Analyze what happened (fund movement, new messages, etc.)
3. Create a brief report of findings

Save your findings as a markdown report. Focus on:
- What changed (transaction details, amounts, destinations)
- Any on-chain messages
- Implications for the investigation

Be concise but thorough. Output the report content."

  # Run Claude Code headlessly
  cd "$PROJECT_DIR"
  claude --print "$prompt" > "$report_file" 2>&1

  if [[ -s "$report_file" ]]; then
    log_success "Analysis report saved to $report_file"
    echo "$report_file"
  else
    log "No report generated"
    echo ""
  fi
}

# Spawn Claude Code to analyze X news
analyze_x_news() {
  local search_terms=$1
  local timestamp=$(date '+%Y%m%d_%H%M%S')
  local report_file="$STATE_DIR/x_report_${timestamp}.md"

  log "Spawning Claude Code to analyze X news..."

  local prompt="New information about the TrueBit hack was detected on X/Twitter for these search terms: $search_terms

Please:
1. Search xcancel.com for the latest posts about the TrueBit hack/exploit
2. Extract any new significant information (official statements, security firm updates, fund movements, etc.)
3. Create a brief report of newsworthy findings

Focus on:
- Official TrueBit communications
- Security firm analyses (Cyvers, CertiK, SlowMist, etc.)
- Community discoveries
- Any new addresses or transactions mentioned

Be concise but thorough."

  # Run Claude Code headlessly
  cd "$PROJECT_DIR"
  claude --print "$prompt" > "$report_file" 2>&1

  if [[ -s "$report_file" ]]; then
    log_success "X analysis report saved to $report_file"
    echo "$report_file"
  else
    log "No X report generated"
    echo ""
  fi
}

# Update the SecurityIncident.vue page with new findings
update_site() {
  local report_file=$1

  if [[ ! -f "$report_file" ]]; then
    log "No report file to process"
    return
  fi

  log "Spawning Claude Code to update SecurityIncident page..."

  local report_content=$(cat "$report_file")

  local prompt="Based on this new investigation report, please update the SecurityIncident.vue page:

--- REPORT ---
$report_content
--- END REPORT ---

Please:
1. Read the current SecurityIncident.vue file
2. Add a new update entry with the findings (assign the next sequential ID)
3. Update the timeline if needed
4. Update the TL;DR if there are significant new findings
5. Update the 'last updated' timestamp
6. Bump the frontend version in package.json
7. Commit and push the changes

Only make changes if the report contains significant new information worth documenting."

  # Run Claude Code headlessly (this will modify files)
  cd "$PROJECT_DIR"
  claude "$prompt" 2>&1 | tee -a "$LOG_FILE"

  log_success "Site update complete"
}

# Main monitoring loop
main() {
  echo -e "${CYAN}"
  echo "╔═══════════════════════════════════════════════════════════════╗"
  echo "║          TrueBit Incident Monitor - Starting...               ║"
  echo "║  Monitoring addresses and X for new information               ║"
  echo "╚═══════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"

  init_state

  log "Monitoring ${#ADDRESS_NAMES[@]} addresses"
  log "Check interval: ${CHECK_INTERVAL} seconds"
  log "State directory: $STATE_DIR"
  log "Log file: $LOG_FILE"
  echo ""

  # Initial state capture (don't trigger on first run)
  log "Capturing initial state..."
  local i=0
  for name in "${ADDRESS_NAMES[@]}"; do
    local address="${ADDRESS_VALUES[$i]}"
    local tx_count=$(get_tx_count "$address")
    local balance=$(get_balance "$address")
    echo "$tx_count" > "$STATE_DIR/${name}_txcount"
    echo "$balance" > "$STATE_DIR/${name}_balance"
    log "  $name: txcount=$tx_count, balance=$balance"
    i=$((i + 1))
  done
  echo ""

  local check_count=0

  while true; do
    check_count=$((check_count + 1))
    log "Check #$check_count - Scanning for changes..."

    # Check addresses for new transactions
    local address_changes=$(check_addresses)

    # Check X for news (less frequently - every 5 minutes)
    local x_news=""
    if [[ $((check_count % 5)) -eq 0 ]]; then
      log "Checking X for news..."
      x_news=$(check_x_for_news)
    fi

    # If changes detected, spawn analysis
    if [[ -n "$address_changes" ]]; then
      log_alert "ADDRESS CHANGES DETECTED!"
      local report=$(analyze_transaction "$address_changes")

      if [[ -n "$report" ]]; then
        update_site "$report"
      fi
    fi

    # If X news detected, spawn analysis
    if [[ -n "$x_news" ]]; then
      log_alert "NEW X CONTENT DETECTED!"
      local x_report=$(analyze_x_news "$x_news")

      if [[ -n "$x_report" ]]; then
        update_site "$x_report"
      fi
    fi

    if [[ -z "$address_changes" && -z "$x_news" ]]; then
      log_success "No changes detected"
    fi

    echo ""
    log "Sleeping for $CHECK_INTERVAL seconds... (Ctrl+C to stop)"
    sleep "$CHECK_INTERVAL"
  done
}

# Handle Ctrl+C gracefully
trap 'echo -e "\n${YELLOW}Monitor stopped by user${NC}"; exit 0' INT

# Run main
main "$@"
