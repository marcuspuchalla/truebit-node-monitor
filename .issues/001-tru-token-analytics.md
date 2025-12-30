# Issue #001: TRU Token Analytics Dashboard

## Overview
Implement a comprehensive TRU token analytics page showing token distribution, burn history, holder statistics, and supply metrics.

## Requirements

### Data to Display
- [x] Current circulating supply
- [x] Total supply and max supply
- [x] Number of token holders
- [x] Token burn history (when, how much, by whom)
- [x] Token retirement events
- [x] Top burners/retirers leaderboard
- [x] Historical burn chart (since inception)
- [ ] Live transaction monitoring

## Research Findings

### TRU Token Details
- **Contract Address (Ethereum):** `0xf65b5c5104c4fafd4b709d9d60a185eae063276c`
- **Token Standard:** ERC-20 (with ERC20Burnable extension)
- **Decimals:** 18
- **Contract Type:** AdminUpgradeabilityProxy
- **Implementation:** `0x18cedf1071ec25331130c82d7af71d393ccd4446`

### Burn Mechanisms
1. **Standard ERC-20 Burns:** Transfers to `0x0000000000000000000000000000000000000000`
2. **Dead Address Burns:** Transfers to `0x000000000000000000000000000000000000dEaD`
3. **Retire Mechanism:** Users retire TRU for ETH via Purchase contract (`0x764c64b2a09b09acb100b80d8c505aa6a0302ef2`)
4. **Task Burns:** Each Truebit task execution burns TRU

### Selected Data Sources (Free Tier)
| Source | Use Case | Free Limit |
|--------|----------|------------|
| Etherscan API | Token transfers, burns, holder count | 100k calls/day, 5 calls/sec |
| CoinGecko API | Price, market cap, supply | Limited (Demo tier) |
| Local Cache | Historical data (immutable) | Unlimited |

### Why Not Use Other Sources
- **The Graph:** No TrueBit subgraph exists
- **Moralis/GoldRush:** Overkill for our needs; Etherscan sufficient
- **Full Node:** Not feasible per requirements

## Technical Design

### Data Model
```typescript
interface BurnEvent {
  txHash: string;
  blockNumber: number;
  timestamp: number;
  from: string;
  amount: string; // wei
  burnType: 'transfer' | 'retire';
}

interface TokenMetrics {
  totalSupply: string;
  circulatingSupply: string;
  holderCount: number;
  totalBurned: string;
  price: number;
  marketCap: number;
  lastUpdated: number;
}

interface BurnLeaderboard {
  address: string;
  totalBurned: string;
  burnCount: number;
}
```

### Backend Endpoints
- `GET /api/token/metrics` - Current token metrics
- `GET /api/token/burns` - Paginated burn history
- `GET /api/token/burns/chart` - Aggregated burn data for chart
- `GET /api/token/leaderboard` - Top burners

### Frontend Route
- `/token` - Token Analytics page

## Time Tracking

| Date | Start | End | Duration | Notes |
|------|-------|-----|----------|-------|
| 2025-12-30 | 00:58 | - | - | Session started |

## Progress Log

### Session 1 (2025-12-30)
- 00:58 - Created branch `feature/tru-token-analytics`
- 00:58 - Created this issue file
- 00:59 - Launched 3 parallel research agents
- 01:03 - Research complete, findings documented
- 01:03 - Starting data model design and implementation
- 01:05 - Created `tokenService.ts` with Etherscan/CoinGecko API integration
- 01:06 - Created `token.ts` routes (metrics, burns, chart, leaderboard)
- 01:07 - Integrated token service into backend index.ts with auto-sync
- 01:10 - Created `TokenView.vue` frontend page with Chart.js
- 01:11 - Added `/token` route to router and navigation
- 01:13 - Fixed TypeScript errors, both frontend and backend compile
- 01:15 - Added database persistence (token_burns, token_sync_state tables)
- 01:18 - TokenService now loads/saves burns to SQLite

## Implementation Plan

1. **Backend:**
   - Create `tokenService.ts` for Etherscan/CoinGecko API calls
   - Create `token.db` SQLite table for caching burns
   - Add token routes to Express server
   - Implement background sync job

2. **Frontend:**
   - Create `TokenView.vue` page
   - Add route to router
   - Implement burn chart with Chart.js
   - Add holder stats and leaderboard components

## Acceptance Criteria
- New `/token` route with analytics dashboard
- Historical burn data visualized in chart
- Holder count and distribution displayed
- Data updates automatically
- Works without full node sync
