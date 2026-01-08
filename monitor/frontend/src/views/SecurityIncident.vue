<template>
  <div class="max-w-7xl mx-auto px-4 py-8">
    <!-- Alert Banner -->
    <div class="bg-red-900/40 border border-red-500/50 rounded-lg p-4 mb-8 animate-pulse-subtle">
      <div class="flex items-start gap-3">
        <span class="text-red-400 text-2xl">🚨</span>
        <div>
          <h2 class="text-red-400 font-bold text-lg">ACTIVE SECURITY INCIDENT</h2>
          <p class="text-red-300/80 text-sm mt-1">
            Investigation ongoing - This page is updated as new information becomes available
          </p>
        </div>
        <span class="ml-auto px-3 py-1 bg-red-500/20 border border-red-500/50 rounded-full text-red-400 text-xs font-medium">
          UNRESOLVED
        </span>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <!-- Main Content -->
      <div class="lg:col-span-3">
        <!-- Header -->
        <div class="mb-8">
          <h1 class="text-3xl font-bold text-cyan-400 mb-2">TrueBit Protocol Security Incident</h1>
          <p class="text-slate-400">
            ~$26 million in ETH drained from Purchase contract
          </p>
        </div>

        <!-- Summary Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <div class="text-slate-400 text-sm">Total Stolen</div>
            <div class="text-2xl font-bold text-red-400">~8,535 ETH</div>
            <div class="text-slate-500 text-sm">$26.6M USD</div>
          </div>
          <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <div class="text-slate-400 text-sm">Funds Recovered</div>
            <div class="text-2xl font-bold text-slate-500">0 ETH</div>
            <div class="text-slate-500 text-sm">No recovery yet</div>
          </div>
          <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <div class="text-slate-400 text-sm">Funds Status</div>
            <div class="text-2xl font-bold text-yellow-400">Tracked</div>
            <div class="text-slate-500 text-sm">Not yet laundered</div>
          </div>
        </div>

        <!-- Live Fund Tracking -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <!-- Destination A -->
          <div class="bg-slate-800/50 border-2 rounded-lg p-4" :class="destA.moved ? 'border-red-500' : 'border-green-500/50'">
            <div class="flex items-center justify-between mb-2">
              <div class="text-slate-400 text-sm font-medium">Destination A - Live Balance</div>
              <span v-if="destA.loading" class="text-slate-500 text-xs">Loading...</span>
              <span v-else class="text-slate-500 text-xs">Updated {{ destA.lastUpdated }}</span>
            </div>
            <div class="text-2xl font-bold font-mono" :class="destA.moved ? 'text-red-400' : 'text-green-400'">
              {{ destA.loading ? '...' : destA.balance.toLocaleString(undefined, { maximumFractionDigits: 2 }) }} ETH
            </div>
            <a
              href="https://etherscan.io/address/0x62AfDD1BD84F6b152572404BE90679Ae58Eb4862"
              target="_blank"
              class="text-cyan-400 hover:text-cyan-300 text-xs font-mono mt-1 block"
            >
              0x62AfDD1B...Eb4862
            </a>
            <div class="mt-3 flex items-center gap-2">
              <div
                class="w-4 h-4 rounded border-2 flex items-center justify-center"
                :class="destA.moved ? 'border-red-500 bg-red-500/20' : 'border-green-500 bg-green-500/20'"
              >
                <svg v-if="!destA.moved" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3 text-green-400">
                  <path fill-rule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.739a.75.75 0 0 1 1.04-.208Z" clip-rule="evenodd" />
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3 text-red-400">
                  <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                </svg>
              </div>
              <span class="text-sm" :class="destA.moved ? 'text-red-400' : 'text-green-400'">
                {{ destA.moved ? 'Funds have started moving!' : 'Funds have not moved' }}
              </span>
            </div>
          </div>

          <!-- Destination B -->
          <div class="bg-slate-800/50 border-2 rounded-lg p-4" :class="destB.moved ? 'border-red-500' : 'border-green-500/50'">
            <div class="flex items-center justify-between mb-2">
              <div class="text-slate-400 text-sm font-medium">Destination B - Live Balance</div>
              <span v-if="destB.loading" class="text-slate-500 text-xs">Loading...</span>
              <span v-else class="text-slate-500 text-xs">Updated {{ destB.lastUpdated }}</span>
            </div>
            <div class="text-2xl font-bold font-mono" :class="destB.moved ? 'text-red-400' : 'text-green-400'">
              {{ destB.loading ? '...' : destB.balance.toLocaleString(undefined, { maximumFractionDigits: 2 }) }} ETH
            </div>
            <a
              href="https://etherscan.io/address/0x273589ca3713e7becf42069f9fb3f0c164ce850a"
              target="_blank"
              class="text-cyan-400 hover:text-cyan-300 text-xs font-mono mt-1 block"
            >
              0x273589ca...cE850a
            </a>
            <div class="mt-3 flex items-center gap-2">
              <div
                class="w-4 h-4 rounded border-2 flex items-center justify-center"
                :class="destB.moved ? 'border-red-500 bg-red-500/20' : 'border-green-500 bg-green-500/20'"
              >
                <svg v-if="!destB.moved" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3 text-green-400">
                  <path fill-rule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.739a.75.75 0 0 1 1.04-.208Z" clip-rule="evenodd" />
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3 text-red-400">
                  <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                </svg>
              </div>
              <span class="text-sm" :class="destB.moved ? 'text-red-400' : 'text-green-400'">
                {{ destB.moved ? 'Funds have started moving!' : 'Funds have not moved' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Updates Section -->
        <div class="space-y-6">
          <h2 class="text-xl font-bold text-slate-100 flex items-center gap-2">
            <span class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            Live Updates
          </h2>

          <!-- Update Entry - Latest -->
          <article v-for="update in updates" :key="update.id" class="bg-slate-800/30 border border-slate-700 rounded-lg overflow-hidden">
            <div class="bg-slate-700/50 px-4 py-2 flex items-center justify-between">
              <span class="text-cyan-400 font-mono text-sm">{{ update.timestamp }}</span>
              <span
                class="px-2 py-0.5 rounded text-xs"
                :class="update.tagClass"
              >
                {{ update.tag }}
              </span>
            </div>
            <div class="p-4">
              <h3 class="text-slate-100 font-bold mb-2">{{ update.title }}</h3>
              <div class="text-slate-300 text-sm space-y-3" v-html="update.content"></div>
            </div>
          </article>
        </div>

        <!-- Key Addresses Section -->
        <section class="mt-8">
          <h2 class="text-xl font-bold text-slate-100 mb-4">Key Addresses</h2>
          <div class="bg-slate-800/30 border border-slate-700 rounded-lg overflow-hidden overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-slate-700/50">
                <tr>
                  <th class="text-left p-3 text-slate-300">Role</th>
                  <th class="text-left p-3 text-slate-300">Address</th>
                  <th class="text-right p-3 text-slate-300">Balance</th>
                  <th class="text-left p-3 text-slate-300">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="addr in addresses" :key="addr.address" class="border-t border-slate-700">
                  <td class="p-3 text-slate-400">{{ addr.role }}</td>
                  <td class="p-3">
                    <a
                      :href="`https://etherscan.io/address/${addr.address}`"
                      target="_blank"
                      class="text-cyan-400 hover:text-cyan-300 font-mono text-xs"
                    >
                      {{ addr.address.slice(0, 10) }}...{{ addr.address.slice(-8) }}
                    </a>
                  </td>
                  <td class="p-3 text-right font-mono" :class="addr.balanceClass">{{ addr.balance }}</td>
                  <td class="p-3">
                    <span class="px-2 py-0.5 rounded text-xs" :class="addr.statusClass">
                      {{ addr.status }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Fund Flow Diagram -->
        <section class="mt-8">
          <h2 class="text-xl font-bold text-slate-100 mb-4">Fund Flow</h2>
          <div class="bg-slate-800/30 border border-slate-700 rounded-lg p-4 overflow-x-auto">
            <pre class="text-xs text-slate-300 font-mono whitespace-pre">{{ fundFlowDiagram }}</pre>
          </div>
        </section>

        <!-- Attack Transaction -->
        <section class="mt-8">
          <h2 class="text-xl font-bold text-slate-100 mb-4">Attack Transaction</h2>
          <div class="bg-slate-800/30 border border-slate-700 rounded-lg p-4">
            <a
              href="https://etherscan.io/tx/0xcd4755645595094a8ab984d0db7e3b4aabde72a5c87c4f176a030629c47fb014"
              target="_blank"
              class="text-cyan-400 hover:text-cyan-300 font-mono text-sm break-all"
            >
              0xcd4755645595094a8ab984d0db7e3b4aabde72a5c87c4f176a030629c47fb014
            </a>
            <div class="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span class="text-slate-400">Block:</span>
                <span class="text-slate-200 ml-2">24,191,019</span>
              </div>
              <div>
                <span class="text-slate-400">Method:</span>
                <span class="text-slate-200 ml-2 font-mono">attack()</span>
              </div>
              <div>
                <span class="text-slate-400">Gas:</span>
                <span class="text-slate-200 ml-2">481,749</span>
              </div>
              <div>
                <span class="text-slate-400">Time:</span>
                <span class="text-slate-200 ml-2">16:02:35 UTC</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Disclaimer -->
        <section class="mt-8">
          <div class="bg-slate-800/30 border border-yellow-500/30 rounded-lg p-4">
            <p class="text-slate-400 text-sm">
              <strong class="text-yellow-400">Disclaimer:</strong>
              This analysis is provided for informational purposes. The investigation is ongoing and
              details may change. This page is maintained by the tru.watch community project and is
              not affiliated with TrueBit Foundation.
            </p>
          </div>
        </section>
      </div>

      <!-- Sidebar Timeline -->
      <div class="lg:col-span-1">
        <div class="sticky top-4">
          <h3 class="text-slate-100 font-bold mb-4">Timeline</h3>
          <div class="space-y-1">
            <div
              v-for="event in timeline"
              :key="event.time"
              class="relative pl-6 pb-4 border-l-2"
              :class="event.isAttack ? 'border-red-500' : 'border-slate-600'"
            >
              <div
                class="absolute left-0 top-0 w-3 h-3 rounded-full -translate-x-[7px]"
                :class="event.isAttack ? 'bg-red-500' : 'bg-slate-600'"
              ></div>
              <div class="text-xs text-slate-500 font-mono">{{ event.time }}</div>
              <div class="text-sm" :class="event.isAttack ? 'text-red-400 font-bold' : 'text-slate-300'">
                {{ event.title }}
              </div>
            </div>
          </div>

          <!-- Quick Links -->
          <h3 class="text-slate-100 font-bold mt-8 mb-4">Quick Links</h3>
          <div class="space-y-2 text-sm">
            <a
              href="https://etherscan.io/tx/0xcd4755645595094a8ab984d0db7e3b4aabde72a5c87c4f176a030629c47fb014"
              target="_blank"
              class="block text-cyan-400 hover:text-cyan-300"
            >
              Attack Transaction
            </a>
            <a
              href="https://etherscan.io/address/0x764C64b2A09b09Acb100B80d8c505Aa6a0302EF2"
              target="_blank"
              class="block text-cyan-400 hover:text-cyan-300"
            >
              Victim Contract
            </a>
            <a
              href="https://beincrypto.com/truebit-protocol-ethereum-hack/"
              target="_blank"
              class="block text-cyan-400 hover:text-cyan-300"
            >
              BeInCrypto Report
            </a>
          </div>

          <!-- Staking Status -->
          <div class="mt-8 bg-green-900/20 border border-green-500/30 rounded-lg p-4">
            <h3 class="text-green-400 font-bold text-sm mb-2">Staking Contract</h3>
            <p class="text-slate-400 text-xs">
              The staking contract appears <strong class="text-green-400">unaffected</strong>.
              38,000 TRU remains staked.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, onMounted, onUnmounted } from 'vue';

const ETHEREUM_RPC = 'https://eth.llamarpc.com';
const DEST_A_ADDRESS = '0x62AfDD1BD84F6b152572404BE90679Ae58Eb4862';
const DEST_B_ADDRESS = '0x273589ca3713e7becf42069f9fb3f0c164ce850a';

// Known balances at time of hack (for comparison)
const DEST_A_INITIAL = 4267.09;
const DEST_B_INITIAL = 4001;

// Tolerance for "not moved" (small gas payments don't count as moving)
const MOVE_TOLERANCE = 1; // 1 ETH tolerance

interface DestinationState {
  balance: number;
  loading: boolean;
  moved: boolean;
  lastUpdated: string;
}

const destA = reactive<DestinationState>({
  balance: 0,
  loading: true,
  moved: false,
  lastUpdated: ''
});

const destB = reactive<DestinationState>({
  balance: 0,
  loading: true,
  moved: false,
  lastUpdated: ''
});

let refreshInterval: ReturnType<typeof setInterval> | null = null;

async function getBalance(address: string): Promise<number> {
  try {
    const response = await fetch(ETHEREUM_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBalance',
        params: [address, 'latest']
      })
    });
    const result = await response.json();
    if (result.result) {
      const wei = BigInt(result.result);
      return Number(wei) / 1e18;
    }
    return 0;
  } catch {
    return 0;
  }
}

function formatTime(): string {
  const now = new Date();
  return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

async function refreshBalances() {
  const [balA, balB] = await Promise.all([
    getBalance(DEST_A_ADDRESS),
    getBalance(DEST_B_ADDRESS)
  ]);

  destA.balance = balA;
  destA.moved = balA < (DEST_A_INITIAL - MOVE_TOLERANCE);
  destA.loading = false;
  destA.lastUpdated = formatTime();

  destB.balance = balB;
  destB.moved = balB < (DEST_B_INITIAL - MOVE_TOLERANCE);
  destB.loading = false;
  destB.lastUpdated = formatTime();
}

onMounted(() => {
  refreshBalances();
  // Refresh every 30 seconds
  refreshInterval = setInterval(refreshBalances, 30000);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});

const updates = [
  {
    id: 1,
    timestamp: 'Jan 8, 2026 - 19:30 UTC',
    tag: 'FUND TRACKING',
    tagClass: 'bg-yellow-500/20 text-yellow-400',
    title: 'Stolen Funds Traced to Two Addresses',
    content: `
      <p>Analysis complete. The stolen ~8,535 ETH has been traced to two destination addresses:</p>
      <ul class="list-disc list-inside mt-2 space-y-1">
        <li><strong>Destination A:</strong> 4,267.09 ETH ($13.3M) - 0x62AfDD1B...Eb4862</li>
        <li><strong>Destination B:</strong> 4,001 ETH ($12.5M) - 0x273589ca...cE850a</li>
      </ul>
      <p class="mt-2">Funds have <strong>not been mixed</strong> via Tornado Cash yet. Both addresses are being monitored.</p>
    `
  },
  {
    id: 2,
    timestamp: 'Jan 8, 2026 - 18:45 UTC',
    tag: 'ATTACKER PROFILE',
    tagClass: 'bg-red-500/20 text-red-400',
    title: 'Attacker Preparation Discovered',
    content: `
      <p>Investigation reveals the attack was planned weeks in advance:</p>
      <ul class="list-disc list-inside mt-2 space-y-1">
        <li>Dec 6: Attacker wallet funded with 1.015 ETH</li>
        <li>Dec 27: 6 ETH deposited to Tornado Cash (privacy mixer)</li>
        <li>Dec 27: Test contract deployed</li>
        <li>Jan 8: Final attack contract deployed and executed</li>
      </ul>
    `
  },
  {
    id: 3,
    timestamp: 'Jan 8, 2026 - 17:00 UTC',
    tag: 'SECURITY ALERT',
    tagClass: 'bg-red-500/20 text-red-400',
    title: 'Cyvers Flags Suspicious Transaction',
    content: `
      <p>Blockchain security firm <strong>Cyvers</strong> flagged an anomalous transaction involving
      the TrueBit Protocol Purchase contract. Their monitoring systems detected approximately
      8,535 ETH (~$26M) being transferred through unusual patterns.</p>
      <p class="mt-2">TrueBit Foundation has not yet released an official statement.</p>
    `
  },
  {
    id: 4,
    timestamp: 'Jan 8, 2026 - 16:02 UTC',
    tag: 'ATTACK',
    tagClass: 'bg-red-500/30 text-red-400 font-bold',
    title: 'Exploit Executed',
    content: `
      <p>Attacker deploys malicious contract and calls <code class="bg-slate-700 px-1 rounded">attack(uint256)</code>
      function, draining ~8,535 ETH from the TrueBit Protocol Purchase contract
      (0x764C64b2...0302EF2).</p>
    `
  }
];

const timeline = [
  { time: 'Dec 6, 2025', title: 'Attacker funded', isAttack: false },
  { time: 'Dec 27, 2025', title: 'Tornado Cash deposits', isAttack: false },
  { time: 'Dec 27, 2025', title: 'Test contract deployed', isAttack: false },
  { time: 'Jan 8, 16:02', title: 'ATTACK EXECUTED', isAttack: true },
  { time: 'Jan 8, 16:11', title: '4,267 ETH moved', isAttack: false },
  { time: 'Jan 8, 18:29', title: '4,001 ETH moved', isAttack: false },
  { time: 'Jan 8, 19:30', title: 'Funds traced', isAttack: false },
];

const addresses = [
  {
    role: 'Attacker EOA',
    address: '0x6C8EC8f14bE7C01672d31CFa5f2CEfeAB2562b50',
    balance: '267.71 ETH',
    balanceClass: 'text-slate-300',
    status: 'Active',
    statusClass: 'bg-yellow-500/20 text-yellow-400'
  },
  {
    role: 'Attack Contract',
    address: '0x1De399967B206e446B4E9AeEb3Cb0A0991bF11b8',
    balance: '0 ETH',
    balanceClass: 'text-slate-500',
    status: 'Unverified',
    statusClass: 'bg-red-500/20 text-red-400'
  },
  {
    role: 'Victim Contract',
    address: '0x764C64b2A09b09Acb100B80d8c505Aa6a0302EF2',
    balance: '~15.87 ETH',
    balanceClass: 'text-red-400',
    status: 'Drained',
    statusClass: 'bg-red-500/20 text-red-400'
  },
  {
    role: 'Destination A',
    address: '0x62AfDD1BD84F6b152572404BE90679Ae58Eb4862',
    balance: '4,267.09 ETH',
    balanceClass: 'text-red-400 font-bold',
    status: 'Holding Funds',
    statusClass: 'bg-red-500/20 text-red-400'
  },
  {
    role: 'Destination B',
    address: '0x273589ca3713e7becf42069f9fb3f0c164ce850a',
    balance: '4,001 ETH',
    balanceClass: 'text-red-400 font-bold',
    status: 'Holding Funds',
    statusClass: 'bg-red-500/20 text-red-400'
  },
];

const fundFlowDiagram = `
  Victim Contract ────8,535 ETH────► Attacker EOA
  (TrueBit Purchase)                      │
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
                    ▼                     │                     ▼
             Hop Address                  │              Direct Transfer
             0x3b5819...                  │              (Jan 8, 18:29)
             4,267.1 ETH                  │                     │
                    │                     │                     │
                    ▼                     │                     ▼
           ┌───────────────┐              │           ┌───────────────┐
           │ DESTINATION A │              │           │ DESTINATION B │
           │ 4,267.09 ETH  │              │           │ 4,001 ETH     │
           │ ($13.3M)      │              │           │ ($12.5M)      │
           └───────────────┘              │           └───────────────┘
`;
</script>

<style scoped>
@keyframes pulse-subtle {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}
.animate-pulse-subtle {
  animation: pulse-subtle 3s ease-in-out infinite;
}
</style>
