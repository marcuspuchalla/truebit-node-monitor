# Incident Monitoring Scripts

Automated monitoring scripts for the TrueBit security incident investigation.

**Important:** Run these scripts from within this directory so that `--continue` uses an isolated conversation context separate from main project development.

## Scripts

### `incident-monitor.sh` (Recommended)

Full-featured monitor with two-stage analysis process and X/Twitter monitoring via Chrome.

```bash
cd scripts/incident-monitor
./incident-monitor.sh
```

**What it does:**
- Monitors 7 key addresses every **5 minutes**
- Checks X/Twitter via Chrome browser MCP tools
- Two-stage process:
  1. **Stage 1a**: Analyzes address changes via RPC + Etherscan
  2. **Stage 1b**: Checks X/Twitter for news via Chrome browser
  3. **Stage 2**: Only if significant, spawns Claude to research and update the page
- Detailed logging to `.incident-monitor/monitor.log`
- Only updates page if changes are meaningful (>0.1 ETH movement, messages, laundering activity)

### `incident-monitor-simple.sh` (Lightweight)

Simpler version monitoring only on-chain activity (no X/Twitter).

```bash
cd scripts/incident-monitor
./incident-monitor-simple.sh
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

The full monitor uses Claude Code with Chrome browser integration (`--chrome` flag) to:
- Navigate to xcancel.com/search?q=truebit&f=live
- Take screenshots and scroll to see tweets
- Track the last seen tweet to avoid duplicates
- Report significant findings (official statements, security alerts, fund movements)

## Monitored Addresses

| Role | Address |
|------|---------|
| Attacker EOA | `0x6C8EC8f14bE7C01672d31CFa5f2CEfeAB2562b50` |
| Destination A (drained) | `0x62AfDD1BD84F6b152572404BE90679Ae58Eb4862` |
| Destination B | `0x273589ca3713e7becf42069f9fb3f0c164ce850a` |
| Intermediary | `0x6aEcB6ee5D7fa4f5b7B5553ED0173442F0EE5ccB` |
| Message Sender | `0xa567c6a2ac472936ed92DfE6A84CE211e42047f9` |
| Attack Contract | `0x1De399967B206e446B4E9AeEb3Cb0A0991bF11b8` |
| Victim Contract | `0x764C64b2A09b09Acb100B80d8c505Aa6a0302EF2` |
| New Holding (from Dest A) | `0xD12f6E0fa7FBF4e3A1c7996E3F0Dd26AB9031a60` |

## Requirements

- `curl` for RPC calls
- `claude` CLI installed and configured
- Chrome browser with Claude-in-Chrome extension (for X monitoring)
- Bash 3.2+ (compatible with macOS default)

## State Files

State is stored in `<project-root>/.incident-monitor/`:
- Transaction counts and balances per address
- Last seen tweet marker
- Analysis reports

## Running in Background

```bash
cd scripts/incident-monitor

# Using nohup
nohup ./incident-monitor.sh > monitor.out 2>&1 &

# Using screen
screen -S incident-monitor
./incident-monitor.sh
# Ctrl+A, D to detach

# Using tmux
tmux new -s incident-monitor
./incident-monitor.sh
# Ctrl+B, D to detach
```

## Stop Monitoring

Press `Ctrl+C` or kill the process:
```bash
pkill -f incident-monitor
```
