# Incident Monitoring Scripts

Automated monitoring scripts for the TrueBit security incident investigation.

## Scripts

### `incident-monitor-simple.sh` (Recommended)

Lightweight monitor that checks addresses every 60 seconds.

```bash
./scripts/incident-monitor-simple.sh
```

**What it does:**
- Monitors 5 key addresses (attacker, destinations, intermediary, message sender)
- Checks transaction count and balance changes
- Spawns Claude Code when changes detected to analyze and update the site

### `incident-monitor.sh` (Full Version)

More comprehensive monitor with X/Twitter checking.

```bash
./scripts/incident-monitor.sh
```

**Additional features:**
- Also monitors X (via xcancel.com) for new TrueBit-related posts
- Detailed logging to `.incident-monitor/monitor.log`
- Configurable check intervals

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
