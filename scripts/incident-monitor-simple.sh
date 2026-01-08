#!/bin/bash
#
# TrueBit Incident Monitor (Simple Version)
# Monitors addresses and spawns Claude Code when changes detected
#

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="$PROJECT_DIR/.incident-monitor"
ETH_RPC="https://eth.llamarpc.com"

# Addresses to watch
ADDRESSES=(
  "0x6C8EC8f14bE7C01672d31CFa5f2CEfeAB2562b50"  # Attacker EOA
  "0x62AfDD1BD84F6b152572404BE90679Ae58Eb4862"  # Destination A
  "0x273589ca3713e7becf42069f9fb3f0c164ce850a"  # Destination B
  "0x6aEcB6ee5D7fa4f5b7B5553ED0173442F0EE5ccB"  # Intermediary
  "0xa567c6a2ac472936ed92DfE6A84CE211e42047f9"  # Message sender
)

mkdir -p "$STATE_DIR"

get_state() {
  local addr=$1
  local method=$2
  curl -s -X POST "$ETH_RPC" \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"$method\",\"params\":[\"$addr\",\"latest\"]}" \
    | grep -o '"result":"[^"]*"' | cut -d'"' -f4
}

check_address() {
  local addr=$1
  local safe_addr=$(echo "$addr" | tr '[:upper:]' '[:lower:]')
  local state_file="$STATE_DIR/$safe_addr"

  local tx_count=$(get_state "$addr" "eth_getTransactionCount")
  local balance=$(get_state "$addr" "eth_getBalance")
  local current="${tx_count}:${balance}"
  local previous=$(cat "$state_file" 2>/dev/null || echo "")

  echo "$current" > "$state_file"

  if [[ -n "$previous" && "$current" != "$previous" ]]; then
    echo "CHANGED"
  else
    echo "OK"
  fi
}

spawn_claude_analysis() {
  local changed_addrs=$1
  echo "$(date '+%H:%M:%S') 🤖 Spawning Claude Code for analysis..."

  cd "$PROJECT_DIR"
  claude --dangerously-skip-permissions "Changes detected on TrueBit hack addresses: $changed_addrs

Please:
1. Check Etherscan for the latest transactions on these addresses
2. Analyze what happened (fund movement, messages, etc.)
3. Update SecurityIncident.vue with a new update entry if significant
4. Update timestamps and version
5. Commit and push if changes made

Be thorough but concise."
}

echo "╔════════════════════════════════════════════╗"
echo "║   TrueBit Incident Monitor                 ║"
echo "║   Watching ${#ADDRESSES[@]} addresses               ║"
echo "║   Press Ctrl+C to stop                     ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Initial capture
echo "Capturing initial state..."
for addr in "${ADDRESSES[@]}"; do
  check_address "$addr" > /dev/null
done
echo "Ready. Monitoring every 60 seconds..."
echo ""

while true; do
  changes=""

  for addr in "${ADDRESSES[@]}"; do
    result=$(check_address "$addr")
    if [[ "$result" == "CHANGED" ]]; then
      echo "$(date '+%H:%M:%S') 🚨 Change detected: ${addr:0:10}..."
      changes="$changes $addr"
    fi
  done

  if [[ -n "$changes" ]]; then
    spawn_claude_analysis "$changes"
  else
    echo "$(date '+%H:%M:%S') ✓ No changes"
  fi

  sleep 60
done
