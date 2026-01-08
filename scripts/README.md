# Incident Monitoring Scripts

Automated monitoring scripts for the TrueBit security incident investigation.

## Scripts

### `incident-monitor.sh` (Recommended)

Full-featured monitor with two-stage analysis process.

```bash
./scripts/incident-monitor.sh
```

**What it does:**
- Monitors 7 key addresses every **5 minutes**
- Two-stage process:
  1. **Stage 1**: Spawns Claude to analyze if changes are significant
  2. **Stage 2**: Only if significant, spawns another Claude to research and update the page
- Detailed logging to `.incident-monitor/monitor.log`
- Only updates page if changes are meaningful (>0.1 ETH movement, messages, laundering activity)

### `incident-monitor-simple.sh` (Lightweight)

Simpler version with same two-stage process.

```bash
./scripts/incident-monitor-simple.sh
```

## Two-Stage Process

The scripts use a two-stage approach to avoid unnecessary updates:

1. **Analysis Stage**: Quick check if changes are significant
   - Returns `SIGNIFICANT: <description>` or `NOT_SIGNIFICANT: <reason>`

2. **Update Stage**: Only runs if Stage 1 returns SIGNIFICANT
   - Researches the change in detail via Etherscan
   - Updates SecurityIncident.vue with new entry
   - Bumps version, commits, and pushes

## X/Twitter Monitoring

**Note:** xcancel.com blocks automated requests (403). For X monitoring:
- Open https://xcancel.com/search?q=truebit&f=live in your browser
- Manually check for significant new posts
- The monitoring scripts focus on on-chain activity only

## Monitored Addresses

| Role | Address |
|------|---------|
| Attacker EOA | `0x6C8EC8f14bE7C01672d31CFa5f2CEfeAB2562b50` |
| Destination A | `0x62AfDD1BD84F6b152572404BE90679Ae58Eb4862` |
| Destination B | `0x273589ca3713e7becf42069f9fb3f0c164ce850a` |
| Intermediary | `0x6aEcB6ee5D7fa4f5b7B5553ED0173442F0EE5ccB` |
| Message Sender | `0xa567c6a2ac472936ed92DfE6A84CE211e42047f9` |

## Requirements

- `curl` for RPC calls
- `claude` CLI installed and configured
- Bash 4.0+

## State Files

State is stored in `.incident-monitor/`:
- Transaction counts and balances per address
- X content hashes (to detect new posts)
- Analysis reports

## Running in Background

```bash
# Using nohup
nohup ./scripts/incident-monitor-simple.sh > monitor.out 2>&1 &

# Using screen
screen -S incident-monitor
./scripts/incident-monitor-simple.sh
# Ctrl+A, D to detach

# Using tmux
tmux new -s incident-monitor
./scripts/incident-monitor-simple.sh
# Ctrl+B, D to detach
```

## Stop Monitoring

Press `Ctrl+C` or kill the process:
```bash
pkill -f incident-monitor
```
