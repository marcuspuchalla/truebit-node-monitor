<template>
  <div class="max-w-7xl mx-auto px-4 py-8">
    <!-- Alert Banner -->
    <div class="bg-red-900/40 border border-red-500/50 rounded-lg p-4 mb-6 animate-pulse-subtle">
      <div class="flex items-start gap-3">
        <span class="text-red-400 text-2xl">🚨</span>
        <div>
          <h2 class="text-red-400 font-bold text-lg">ACTIVE SECURITY INCIDENT</h2>
          <p class="text-red-300/80 text-sm mt-1">
            Investigation ongoing - This page is updated as new information becomes available
          </p>
        </div>
        <div class="ml-auto text-right">
          <span class="px-3 py-1 bg-red-500/20 border border-red-500/50 rounded-full text-red-400 text-xs font-medium">
            UNRESOLVED
          </span>
          <div class="text-xs text-slate-500 mt-1">Last updated: {{ pageLastUpdated }}</div>
        </div>
      </div>
    </div>

    <!-- TL;DR Summary -->
    <div class="bg-slate-800/50 border border-cyan-500/30 rounded-lg p-5 mb-8">
      <h2 class="text-cyan-400 font-bold text-lg mb-3 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
          <path fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clip-rule="evenodd" />
        </svg>
        TL;DR - What You Need to Know
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div class="space-y-2">
          <p class="text-slate-300"><strong class="text-red-400">What happened:</strong> On Jan 8, 2026 at 16:02 UTC, an attacker exploited the TrueBit Protocol Purchase contract, draining ~8,535 ETH ($26.6M).</p>
          <p class="text-slate-300"><strong class="text-red-400">Current status:</strong> FUNDS ARE MOVING! ~4,267 ETH from Destination A moved to new address on Jan 9. Destination B (~4,001 ETH) remains stationary.</p>
          <p class="text-slate-300"><strong class="text-cyan-400">Official response:</strong> TrueBit acknowledged the incident, warned users not to interact with the affected contract, and confirmed law enforcement contact.</p>
        </div>
        <div class="space-y-2">
          <p class="text-slate-300"><strong class="text-purple-400">Attacker profile:</strong> Sophisticated actor who used cross-chain bridges (Rhino.fi, Across Protocol) to obscure funding origin. Prepared attack over ~5 weeks.</p>
          <p class="text-slate-300"><strong class="text-pink-400">On-chain message:</strong> A third party sent a message to the attacker mentioning "WLFI bridge has an exploit" - potentially indicating another vulnerability.</p>
          <p class="text-slate-300"><strong class="text-green-400">Staking unaffected:</strong> The TrueBit staking contract (38,000 TRU staked) was NOT compromised.</p>
        </div>
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
          <div class="bg-slate-800/50 border border-red-500/50 rounded-lg p-4">
            <div class="text-slate-400 text-sm">Funds Status</div>
            <div class="text-2xl font-bold text-red-400">MOVING</div>
            <div class="text-slate-500 text-sm">~4,267 ETH relocated Jan 9</div>
          </div>
        </div>

        <!-- Fund Movement Alert -->
        <div class="bg-red-900/30 border-2 border-red-500 rounded-lg p-4 mb-8">
          <div class="flex items-center gap-3 mb-3">
            <span class="text-2xl">⚠️</span>
            <h3 class="text-red-400 font-bold text-lg">FUND MOVEMENT DETECTED - Jan 9, 2026</h3>
          </div>
          <p class="text-slate-300 text-sm mb-3">
            ~4,267 ETH from Destination A has been moved to a new holding address. See Update #10 below for full details and live tracking.
          </p>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div class="bg-slate-900/50 rounded p-2">
              <div class="text-slate-500 text-xs">Destination A (old)</div>
              <div class="text-red-400 font-mono">~0 ETH</div>
              <div class="text-red-400 text-xs">DRAINED</div>
            </div>
            <div class="bg-slate-900/50 rounded p-2">
              <div class="text-slate-500 text-xs">New Holding Address</div>
              <div class="text-yellow-400 font-mono">~4,267 ETH</div>
              <div class="text-yellow-400 text-xs">MONITORING</div>
            </div>
            <div class="bg-slate-900/50 rounded p-2">
              <div class="text-slate-500 text-xs">Destination B</div>
              <div class="text-green-400 font-mono">~4,001 ETH</div>
              <div class="text-green-400 text-xs">NO MOVEMENT</div>
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
          <article
            v-for="update in updates"
            :key="update.id"
            :id="`update-${update.id}`"
            class="bg-slate-800/30 border border-slate-700 rounded-lg overflow-hidden scroll-mt-8"
          >
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

        <!-- Attribution -->
        <section class="mt-6">
          <div class="text-center text-xs text-slate-600">
            <p>
              This investigation was conducted using automated blockchain analysis by
              <a href="https://claude.ai/claude-code" target="_blank" class="text-cyan-600 hover:text-cyan-500">Claude Code</a>,
              guided by the tru.watch community.
            </p>
          </div>
        </section>
      </div>

      <!-- Sidebar Timeline -->
      <div class="lg:col-span-1">
        <div class="sticky top-4">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-slate-100 font-bold">Timeline</h3>
            <span class="text-xs text-slate-500">newest first</span>
          </div>
          <div class="space-y-1">
            <div
              v-for="event in timeline"
              :key="event.id"
              class="relative pl-6 pb-4 border-l-2 cursor-pointer group"
              :class="event.isAttack ? 'border-red-500' : 'border-slate-600'"
              @click="scrollToUpdate(event.updateId)"
            >
              <div
                class="absolute left-0 top-0 w-3 h-3 rounded-full -translate-x-[7px] transition-transform group-hover:scale-125"
                :class="event.isAttack ? 'bg-red-500' : 'bg-slate-600 group-hover:bg-cyan-500'"
              ></div>
              <div class="text-xs text-slate-500 font-mono">{{ event.time }}</div>
              <div class="text-sm transition-colors" :class="event.isAttack ? 'text-red-400 font-bold' : 'text-slate-300 group-hover:text-cyan-400'">
                {{ event.title }}
              </div>
            </div>
          </div>

          <!-- Last Research -->
          <div class="mt-6 p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
            <div class="text-xs text-slate-500 mb-1">Last Research Update</div>
            <div class="text-sm text-cyan-400 font-mono">{{ lastResearchTime }}</div>
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
            <a
              href="https://truebitstats.io/fund-flow/"
              target="_blank"
              class="block text-cyan-400 hover:text-cyan-300"
            >
              Fund Flow Visualization ↗
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

// Last research timestamp
const lastResearchTime = 'Jan 9, 2026 - 15:00 UTC';
const pageLastUpdated = 'Jan 9, 2026 - 15:00 UTC';

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

function scrollToUpdate(updateId: number | null, updateHash = true) {
  if (!updateId) return;
  const element = document.getElementById(`update-${updateId}`);
  if (element) {
    // Update URL hash for sharing
    if (updateHash) {
      history.pushState(null, '', `#update-${updateId}`);
    }
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Flash effect
    element.classList.add('ring-2', 'ring-cyan-500');
    setTimeout(() => {
      element.classList.remove('ring-2', 'ring-cyan-500');
    }, 2000);
  }
}

function checkHashOnLoad() {
  const hash = window.location.hash;
  if (hash && hash.startsWith('#update-')) {
    const updateId = parseInt(hash.replace('#update-', ''), 10);
    if (!isNaN(updateId)) {
      // Small delay to ensure DOM is ready
      setTimeout(() => scrollToUpdate(updateId, false), 100);
    }
  }
}

onMounted(() => {
  refreshBalances();
  // Refresh every 30 seconds
  refreshInterval = setInterval(refreshBalances, 30000);
  // Check for anchor in URL
  checkHashOnLoad();
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});

// Updates ordered newest first for display, but IDs are stable (oldest = lowest ID)
const updates = [
  {
    id: 13,
    timestamp: 'Jan 9, 2026 - 15:00 UTC',
    tag: 'OFFICIAL',
    tagClass: 'bg-green-500/30 text-green-400 font-bold',
    title: 'TrueBit Team Issues Second Official Statement',
    content: `
      <p>The TrueBit team has released a <strong>second official statement</strong> via their verified X/Twitter account:</p>

      <div class="bg-slate-900/50 p-4 rounded mt-4 border border-green-500/30">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">TB</div>
          <div>
            <div class="flex items-center gap-2">
              <span class="font-bold text-slate-100">Truebit</span>
              <span class="text-cyan-400 text-sm">@Truebitprotocol</span>
              <span class="text-green-400 text-xs">✓ Verified</span>
            </div>
            <p class="text-slate-200 mt-2 italic">"Our team is tirelessly working to address the incident we reported yesterday, and has engaged additional resources to strengthen tracing and recovery. Updates will follow through our official channels."</p>
            <p class="text-xs text-slate-500 mt-2">Posted ~29 minutes ago (Jan 9, 2026)</p>
          </div>
        </div>
      </div>

      <div class="bg-slate-900/50 p-4 rounded mt-4 border border-slate-500/30">
        <h4 class="text-slate-300 font-bold mb-2">Key Points:</h4>
        <ul class="list-disc list-inside space-y-1 text-sm text-slate-400">
          <li>Team is actively working on the incident</li>
          <li><strong class="text-slate-200">Additional resources engaged</strong> for tracing and recovery</li>
          <li>Further updates will come through official channels only</li>
        </ul>
      </div>

      <p class="mt-4 text-slate-400 text-sm"><strong class="text-cyan-400">Note:</strong> This is the first substantive update since the initial acknowledgment. The mention of "tracing and recovery" suggests potential efforts to recover funds or identify the attacker.</p>
      <p class="mt-2 text-xs text-slate-500">Source: <a href="https://x.com/Truebitprotocol" target="_blank" class="text-cyan-400 hover:underline">@Truebitprotocol on X</a></p>
    `
  },
  {
    id: 12,
    timestamp: 'Jan 9, 2026 - 14:30 UTC',
    tag: 'STATUS UPDATE',
    tagClass: 'bg-blue-500/20 text-blue-400',
    title: 'Funds Still Stationary After 13+ Hours - No Official Communication',
    content: `
      <p>As of <strong>14:30 UTC on Jan 9, 2026</strong>, approximately <strong>13 hours</strong> after the initial fund movement, all stolen ETH remains stationary in attacker-controlled addresses.</p>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div class="bg-yellow-900/20 border border-yellow-500/50 rounded-lg p-3">
          <div class="text-xs text-slate-400 mb-1">New Holding Address</div>
          <div class="text-xl font-bold text-yellow-400 font-mono">4,267.09 ETH</div>
          <div class="text-slate-500 text-xs">~$13.1M at current prices</div>
          <div class="text-yellow-400 text-xs mt-1">⏳ No outgoing transactions</div>
        </div>
        <div class="bg-yellow-900/20 border border-yellow-500/50 rounded-lg p-3">
          <div class="text-xs text-slate-400 mb-1">Destination B</div>
          <div class="text-xl font-bold text-yellow-400 font-mono">4,001.00 ETH</div>
          <div class="text-slate-500 text-xs">~$12.3M at current prices</div>
          <div class="text-yellow-400 text-xs mt-1">⏳ No outgoing transactions</div>
        </div>
      </div>

      <div class="bg-orange-900/20 border border-orange-500/30 rounded-lg p-4 mt-4">
        <h4 class="text-orange-400 font-bold mb-2">⚠️ No Official Communication</h4>
        <p class="text-sm text-slate-300">There has been <strong>no official statement</strong> from the TrueBit team since their initial acknowledgment on Jan 8. Be cautious of unofficial sources, rumors, or social media gossip claiming to have insider information.</p>
        <p class="text-xs text-slate-500 mt-2">Only trust announcements from official TrueBit channels.</p>
      </div>

      <div class="bg-cyan-900/20 border border-cyan-500/30 rounded-lg p-4 mt-4">
        <h4 class="text-cyan-400 font-bold mb-2">📊 Fund Flow Visualization</h4>
        <p class="text-sm text-slate-300">The team at <strong>truebitstats.io</strong> has built an interactive visualization showing how the stolen funds have moved:</p>
        <a href="https://truebitstats.io/fund-flow/" target="_blank" class="inline-block mt-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-sm font-medium">View Fund Flow Diagram →</a>
      </div>

      <p class="mt-4 text-slate-400 text-sm"><strong class="text-cyan-400">Summary:</strong> Total stolen funds (~8,268 ETH / $25.4M) remain untouched. The attacker has not initiated any laundering activity. Monitoring continues.</p>
    `
  },
  {
    id: 11,
    timestamp: 'Jan 9, 2026 - 09:15 UTC',
    tag: 'STATUS UPDATE',
    tagClass: 'bg-blue-500/20 text-blue-400',
    title: 'Funds Remain Stationary - Dust Transactions Observed',
    content: `
      <p>As of <strong>09:15 UTC on Jan 9, 2026</strong>, the major stolen funds remain stationary:</p>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div class="bg-yellow-900/20 border border-yellow-500/50 rounded-lg p-3">
          <div class="text-xs text-slate-400 mb-1">New Holding Address</div>
          <div class="text-xl font-bold text-yellow-400 font-mono">4,267.09 ETH</div>
          <a href="https://etherscan.io/address/0xD12f6E0fa7FBF4e3A1c7996E3F0Dd26AB9031a60" target="_blank" class="text-cyan-400 hover:text-cyan-300 text-xs font-mono">0xD12f6E0f...31a60</a>
          <div class="text-yellow-400 text-xs mt-1">⏳ Unchanged</div>
        </div>
        <div class="bg-yellow-900/20 border border-yellow-500/50 rounded-lg p-3">
          <div class="text-xs text-slate-400 mb-1">Destination B</div>
          <div class="text-xl font-bold text-yellow-400 font-mono">4,001.00 ETH</div>
          <a href="https://etherscan.io/address/0x273589ca3713e7becf42069f9fb3f0c164ce850a" target="_blank" class="text-cyan-400 hover:text-cyan-300 text-xs font-mono">0x273589ca...cE850a</a>
          <div class="text-yellow-400 text-xs mt-1">⏳ Unchanged</div>
        </div>
      </div>

      <div class="bg-slate-900/50 p-4 rounded mt-4 border border-blue-500/30">
        <h4 class="text-blue-400 font-bold mb-2">Dust Transaction Activity:</h4>
        <p class="text-sm text-slate-300">Multiple small transactions (0 ETH - 0.000001 ETH) have been sent TO the new holding address by third parties:</p>
        <ul class="list-disc list-inside mt-2 space-y-1 text-sm text-slate-400">
          <li>~8 incoming transactions since fund movement</li>
          <li>Includes on-chain messages from random actors attempting contact</li>
          <li>One message soliciting investment from the attacker</li>
          <li>These are NOT outgoing transactions - funds remain intact</li>
        </ul>
      </div>

      <div class="bg-slate-900/50 p-4 rounded mt-4 border border-slate-500/30">
        <h4 class="text-slate-300 font-bold mb-2">TrueBit Team Response:</h4>
        <p class="text-sm text-slate-400">The team acknowledged the breach on Jan 8 and advised users not to interact with the affected contract. They stated they are working with law enforcement. No compensation plan has been announced.</p>
      </div>

      <p class="mt-4 text-slate-400 text-sm"><strong class="text-cyan-400">Summary:</strong> Total stolen funds (~8,268 ETH / $25.8M) remain in attacker-controlled addresses. No laundering activity detected yet.</p>
    `
  },
  {
    id: 10,
    timestamp: 'Jan 9, 2026 - 01:23 UTC',
    tag: 'FUND MOVEMENT',
    tagClass: 'bg-red-500/30 text-red-400 font-bold',
    title: 'BREAKING: ~4,267 ETH Moved from Destination A to New Address',
    content: `
      <p class="text-lg text-red-400 font-bold mb-3">⚠️ The attacker has begun moving funds!</p>
      <p>At approximately <strong>01:12-01:14 UTC on Jan 9, 2026</strong>, the attacker moved nearly all funds from Destination A to a new holding address:</p>

      <div class="bg-slate-900/50 p-4 rounded mt-4 border border-red-500/30">
        <h4 class="text-red-400 font-bold mb-2">Movement Details:</h4>
        <ul class="list-disc list-inside space-y-1 text-sm">
          <li><strong>Transaction 1:</strong> 0.1 ETH at 01:12:23 UTC - <a href="https://etherscan.io/tx/0xbc0a18bf08d1fc9815c3011dc5b3d44bd674ebcc160b7ee949661c61051b198b" target="_blank" class="text-cyan-400 hover:underline">View on Etherscan</a></li>
          <li><strong>Transaction 2:</strong> 4,266.99 ETH at 01:14:11 UTC - <a href="https://etherscan.io/tx/0xd6d0b1776a894e546bd0e8e148084b942b8ce9376240d6868f189b662fd6c87d" target="_blank" class="text-cyan-400 hover:underline">View on Etherscan</a></li>
        </ul>
      </div>

      <div class="bg-slate-900/50 p-4 rounded mt-4 border border-yellow-500/30">
        <h4 class="text-yellow-400 font-bold mb-2">New Holding Address:</h4>
        <p class="font-mono text-sm"><a href="https://etherscan.io/address/0xD12f6E0fa7FBF4e3A1c7996E3F0Dd26AB9031a60" target="_blank" class="text-cyan-400 hover:underline">0xD12f6E0fa7FBF4e3A1c7996E3F0Dd26AB9031a60</a></p>
        <p class="text-sm mt-2">Current balance: <strong class="text-yellow-400">~4,267.09 ETH ($13.27M)</strong></p>
        <p class="text-sm text-slate-400 mt-1">Status: Funds have NOT moved further yet - appears to be a staging address.</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div class="bg-red-900/20 border border-red-500/50 rounded-lg p-3">
          <div class="text-xs text-slate-400 mb-1">Destination A (Original)</div>
          <div class="text-xl font-bold text-red-400 font-mono">~0 ETH</div>
          <a href="https://etherscan.io/address/0x62AfDD1BD84F6b152572404BE90679Ae58Eb4862" target="_blank" class="text-cyan-400 hover:text-cyan-300 text-xs font-mono">0x62AfDD1B...Eb4862</a>
          <div class="text-red-400 text-xs mt-1">✗ DRAINED</div>
        </div>
        <div class="bg-green-900/20 border border-green-500/50 rounded-lg p-3">
          <div class="text-xs text-slate-400 mb-1">Destination B (Unchanged)</div>
          <div class="text-xl font-bold text-green-400 font-mono">~4,001 ETH</div>
          <a href="https://etherscan.io/address/0x273589ca3713e7becf42069f9fb3f0c164ce850a" target="_blank" class="text-cyan-400 hover:text-cyan-300 text-xs font-mono">0x273589ca...cE850a</a>
          <div class="text-green-400 text-xs mt-1">✓ No movement</div>
        </div>
      </div>

      <p class="mt-4 text-slate-400 text-sm"><strong class="text-cyan-400">Analysis:</strong> The attacker is consolidating funds into a new address. This could indicate preparation for laundering (Tornado Cash, bridges) or simply repositioning. The small 0.1 ETH transaction first may have been a test.</p>
      <p class="mt-2 text-slate-500 text-xs">Monitoring continues on all addresses including the new holding address.</p>
    `
  },
  {
    id: 9,
    timestamp: 'Jan 8, 2026 - 23:45 UTC',
    tag: 'ON-CHAIN MESSAGE',
    tagClass: 'bg-pink-500/20 text-pink-400',
    title: 'On-Chain Message Sent to Attacker - Mentions Another Exploit',
    content: `
      <p>A third party sent a <strong>0 ETH transaction</strong> to Destination B (the attacker's wallet) containing an encoded message:</p>
      <div class="bg-slate-900/50 p-3 rounded mt-3 border border-pink-500/30">
        <p class="text-pink-400 font-mono text-sm">"yo i need a down payment for a house (also wlfi bridge has an exploit yw)"</p>
        <p class="text-xs text-slate-500 mt-2">
          <a href="https://etherscan.io/tx/0x45bbdc1f97d862cd68b8b42d43ce41a7216bd2a991d51748d25271dfa76716b7" target="_blank" class="text-cyan-400 hover:underline">View original message on Etherscan →</a>
        </p>
      </div>
      <p class="mt-3">The message appears to:</p>
      <ul class="list-disc list-inside mt-2 space-y-1">
        <li>Request funds from the attacker ("down payment for a house")</li>
        <li>Mention a potential vulnerability in the <strong>WLFI bridge</strong> ("wlfi bridge has an exploit yw")</li>
      </ul>
      <p class="mt-3"><strong class="text-cyan-400">Message sender trace:</strong></p>
      <ul class="list-disc list-inside mt-1 space-y-1 text-sm">
        <li>Sender: <a href="https://etherscan.io/address/0xa567c6a2ac472936ed92DfE6A84CE211e42047f9" target="_blank" class="text-cyan-400 hover:underline">0xa567c6a2...42047f9</a></li>
        <li>Funded by: <a href="https://etherscan.io/address/0xf70da97812cb96acdf810712aa562db8dfa3dbef" target="_blank" class="text-cyan-400 hover:underline">Relay: Solver</a> (cross-chain aggregator)</li>
        <li>Original funding: 0.00773 ETH on Oct 10, 2024</li>
        <li>Activity: Token swaps via Uniswap, small transfers</li>
      </ul>
      <p class="mt-3 text-slate-400 text-sm">This appears to be an <strong>external party</strong> attempting to contact the attacker, not the attacker themselves.</p>
    `
  },
  {
    id: 8,
    timestamp: 'Jan 8, 2026 - 23:15 UTC',
    tag: 'INVESTIGATION',
    tagClass: 'bg-purple-500/20 text-purple-400',
    title: 'Attacker Funding Chain Traced - Sophisticated Chain-Hopping Detected',
    content: `
      <p>Deep investigation reveals the attacker used sophisticated <strong>cross-chain bridge hopping</strong> to obscure the origin of funds:</p>
      <div class="bg-slate-900/50 p-3 rounded mt-3 font-mono text-xs">
        <p class="text-slate-500">Unknown Origin</p>
        <p class="text-slate-400 ml-2">↓ <a href="https://optimistic.etherscan.io/address/0x6aEcB6ee5D7fa4f5b7B5553ED0173442F0EE5ccB" target="_blank" class="text-cyan-400 hover:underline">Rhino.fi Bridge (Nov 21)</a></p>
        <p class="text-slate-500 ml-4">Optimism (1.200 ETH)</p>
        <p class="text-slate-400 ml-2">↓ <a href="https://etherscan.io/address/0x6aEcB6ee5D7fa4f5b7B5553ED0173442F0EE5ccB" target="_blank" class="text-cyan-400 hover:underline">Across Protocol (Nov 29)</a></p>
        <p class="text-slate-500 ml-4">Ethereum (1.135 ETH)</p>
        <p class="text-slate-400 ml-2">↓</p>
        <p class="text-cyan-400 ml-4">Intermediary: <a href="https://etherscan.io/address/0x6aEcB6ee5D7fa4f5b7B5553ED0173442F0EE5ccB" target="_blank" class="hover:underline">0x6aEcB6ee...0EE5ccB</a></p>
        <p class="text-slate-400 ml-2">↓ <a href="https://etherscan.io/tx/0x7c1c4f3f3e3a0f1e1d1c1b1a19181716151413121110090807060504030201" target="_blank" class="text-cyan-400 hover:underline">Dec 6, 2025</a></p>
        <p class="text-red-400 ml-4">Attacker: <a href="https://etherscan.io/address/0x6C8EC8f14bE7C01672d31CFa5f2CEfeAB2562b50" target="_blank" class="hover:underline">0x6C8EC8f1...562b50</a> (1.015 ETH)</p>
      </div>
      <p class="mt-3">Both Rhino.fi and Across Protocol are <strong>no-KYC bridges</strong>, making further tracing extremely difficult without cooperation from bridge operators or advanced multi-chain analytics tools.</p>
      <p class="mt-2 text-xs text-slate-500">Verify: <a href="https://etherscan.io/address/0x6aEcB6ee5D7fa4f5b7B5553ED0173442F0EE5ccB" target="_blank" class="text-cyan-400 hover:underline">Intermediary wallet on Etherscan</a></p>
    `
  },
  {
    id: 7,
    timestamp: 'Jan 8, 2026 - 22:30 UTC',
    tag: 'OFFICIAL',
    tagClass: 'bg-blue-500/20 text-blue-400',
    title: 'TrueBit Foundation Issues Official Statement',
    content: `
      <p>TrueBit has released their first official statement via Twitter/X:</p>
      <blockquote class="border-l-2 border-blue-500 pl-3 mt-2 italic text-slate-400">
        "Today, we became aware of a security incident involving one or more malicious actors. The affected smart contract is
        0x764C64b2A09b09Acb100B80d8c505Aa6a0302EF2 and we strongly advise the public not to interact with this contract until further notice.
        We are in contact with law enforcement and taking all available measures to address the situation. We will share updates through our official channels as they become available."
      </blockquote>
      <p class="mt-3"><strong class="text-blue-400">Key points:</strong></p>
      <ul class="list-disc list-inside mt-1 space-y-1">
        <li>Incident acknowledged officially</li>
        <li>Affected contract identified (Purchase contract)</li>
        <li>Public warned not to interact</li>
        <li>Law enforcement contacted</li>
      </ul>
    `
  },
  {
    id: 6,
    timestamp: 'Jan 8, 2026 - 22:00 UTC',
    tag: 'CORRECTION',
    tagClass: 'bg-orange-500/20 text-orange-400',
    title: 'Tornado Cash Deposit Amount Corrected',
    content: `
      <p>Etherscan analysis confirms <strong>4 deposits of 1 ETH each</strong> to Tornado Cash (not 5 or 6 as previously reported):</p>
      <table class="mt-2 text-xs w-full">
        <tr class="border-b border-slate-700"><td class="py-1 text-slate-500">Block 24101532</td><td class="text-slate-300">1 ETH</td><td class="text-slate-500">Dec 27, 2025</td></tr>
        <tr class="border-b border-slate-700"><td class="py-1 text-slate-500">Block 24101530</td><td class="text-slate-300">1 ETH</td><td class="text-slate-500">Dec 27, 2025</td></tr>
        <tr class="border-b border-slate-700"><td class="py-1 text-slate-500">Block 24101527</td><td class="text-slate-300">1 ETH</td><td class="text-slate-500">Dec 27, 2025</td></tr>
        <tr><td class="py-1 text-slate-500">Block 24101524</td><td class="text-slate-300">1 ETH</td><td class="text-slate-500">Dec 27, 2025</td></tr>
      </table>
      <p class="mt-2 text-slate-400">Total: <strong>4 ETH</strong> sent to Tornado Cash Router (0xd90e2f92...4f31b) - likely a test before the main attack.</p>
    `
  },
  {
    id: 5,
    timestamp: 'Jan 8, 2026 - 21:45 UTC',
    tag: 'STATUS UPDATE',
    tagClass: 'bg-green-500/20 text-green-400',
    title: 'Funds Verified - No Movement Detected',
    content: `
      <p>Live balance verification confirms stolen funds remain stationary:</p>
      <ul class="list-disc list-inside mt-2 space-y-1">
        <li><strong>Destination A:</strong> 4,267.09 ETH - <span class="text-green-400">No change</span></li>
        <li><strong>Destination B:</strong> 4,001.00 ETH - <span class="text-green-400">No change</span></li>
      </ul>
      <p class="mt-2">The attacker appears to be in a holding pattern. The vast majority of funds (~$25.8M) remain unmoved.</p>
      <p class="mt-2 text-slate-400 text-xs">Monitoring continues with 30-second balance refresh.</p>
    `
  },
  {
    id: 4,
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
    id: 3,
    timestamp: 'Jan 8, 2026 - 18:45 UTC',
    tag: 'ATTACKER PROFILE',
    tagClass: 'bg-red-500/20 text-red-400',
    title: 'Attacker Preparation Discovered',
    content: `
      <p>Investigation reveals the attack was planned weeks in advance:</p>
      <ul class="list-disc list-inside mt-2 space-y-1">
        <li>Nov 21: Funds bridged from Optimism via Rhino.fi</li>
        <li>Nov 29: Funds bridged to Ethereum via Across Protocol</li>
        <li>Dec 6: Attacker wallet funded with 1.015 ETH</li>
        <li>Dec 27: 4 ETH deposited to Tornado Cash (test)</li>
        <li>Dec 27: Test contract deployed</li>
        <li>Jan 8: Final attack contract deployed and executed</li>
      </ul>
    `
  },
  {
    id: 2,
    timestamp: 'Jan 8, 2026 - 17:00 UTC',
    tag: 'SECURITY ALERT',
    tagClass: 'bg-red-500/20 text-red-400',
    title: 'Cyvers Flags Suspicious Transaction',
    content: `
      <p>Blockchain security firm <strong>Cyvers</strong> flagged an anomalous transaction involving
      the TrueBit Protocol Purchase contract. Their monitoring systems detected approximately
      8,535 ETH (~$26M) being transferred through unusual patterns.</p>
      <p class="mt-2">Additional tracking by <strong>CertiK</strong> via their SKYLENS platform and <strong>Lookonchain</strong> confirmed the exploit.</p>
    `
  },
  {
    id: 1,
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

// Timeline in reverse chronological order (newest first), with links to updates
// updateId references stable IDs: oldest event = ID 1, newest = highest ID
const timeline = [
  { id: 1, time: 'Jan 9, 01:14', title: 'FUNDS MOVING - 4,267 ETH relocated', isAttack: true, updateId: 10 },
  { id: 2, time: 'Jan 8, 23:45', title: 'On-chain message to attacker', isAttack: false, updateId: 9 },
  { id: 3, time: 'Jan 8, 23:15', title: 'Chain-hopping traced', isAttack: false, updateId: 8 },
  { id: 4, time: 'Jan 8, 22:30', title: 'TrueBit official statement', isAttack: false, updateId: 7 },
  { id: 5, time: 'Jan 8, 22:00', title: 'Tornado Cash corrected (4 ETH)', isAttack: false, updateId: 6 },
  { id: 6, time: 'Jan 8, 21:45', title: 'Funds verified stationary', isAttack: false, updateId: 5 },
  { id: 7, time: 'Jan 8, 19:30', title: 'Funds traced', isAttack: false, updateId: 4 },
  { id: 8, time: 'Jan 8, 18:45', title: 'Attacker profile', isAttack: false, updateId: 3 },
  { id: 9, time: 'Jan 8, 18:29', title: '4,001 ETH to Dest B', isAttack: false, updateId: null },
  { id: 10, time: 'Jan 8, 17:00', title: 'Cyvers alert', isAttack: false, updateId: 2 },
  { id: 11, time: 'Jan 8, 16:11', title: '4,267 ETH to Dest A', isAttack: false, updateId: null },
  { id: 12, time: 'Jan 8, 16:02', title: 'ATTACK EXECUTED', isAttack: true, updateId: 1 },
  { id: 13, time: 'Dec 27, 2025', title: 'Test contract deployed', isAttack: false, updateId: 3 },
  { id: 14, time: 'Dec 27, 2025', title: 'Tornado Cash test (4 ETH)', isAttack: false, updateId: 6 },
  { id: 15, time: 'Dec 6, 2025', title: 'Attacker funded (1.015 ETH)', isAttack: false, updateId: 3 },
  { id: 16, time: 'Nov 29, 2025', title: 'Across Protocol bridge', isAttack: false, updateId: 8 },
  { id: 17, time: 'Nov 21, 2025', title: 'Rhino.fi bridge from Optimism', isAttack: false, updateId: 8 },
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
    role: 'Message Sender',
    address: '0xa567c6a2ac472936ed92DfE6A84CE211e42047f9',
    balance: 'Unknown',
    balanceClass: 'text-slate-500',
    status: 'Person of Interest',
    statusClass: 'bg-pink-500/20 text-pink-400'
  },
  {
    role: 'Intermediary (Funder)',
    address: '0x6aEcB6ee5D7fa4f5b7B5553ED0173442F0EE5ccB',
    balance: '~0.12 ETH',
    balanceClass: 'text-slate-500',
    status: 'Chain-hopped',
    statusClass: 'bg-purple-500/20 text-purple-400'
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
    role: 'New Holding Address',
    address: '0xD12f6E0fa7FBF4e3A1c7996E3F0Dd26AB9031a60',
    balance: '~4,267 ETH',
    balanceClass: 'text-yellow-400 font-bold',
    status: 'Monitoring',
    statusClass: 'bg-yellow-500/20 text-yellow-400'
  },
  {
    role: 'Destination A (Drained)',
    address: '0x62AfDD1BD84F6b152572404BE90679Ae58Eb4862',
    balance: '~0 ETH',
    balanceClass: 'text-slate-500',
    status: 'Drained Jan 9',
    statusClass: 'bg-slate-500/20 text-slate-400'
  },
  {
    role: 'Destination B',
    address: '0x273589ca3713e7becf42069f9fb3f0c164ce850a',
    balance: '~4,001 ETH',
    balanceClass: 'text-red-400 font-bold',
    status: 'Holding Funds',
    statusClass: 'bg-red-500/20 text-red-400'
  },
];

const fundFlowDiagram = `
══════════════════════════════════════════════════════════════════════════════════
                          ATTACKER FUNDING CHAIN (5 weeks prep)
══════════════════════════════════════════════════════════════════════════════════

  [Unknown Origin]
        │
        ▼ Nov 21, 2025
  ┌──────────────────┐
  │   Rhino.fi       │  Cross-chain bridge (Optimism → Ethereum)
  │   Bridge         │  1.200 ETH
  └────────┬─────────┘
           │
           ▼ Nov 29, 2025
  ┌──────────────────┐
  │  Across Protocol │  Cross-chain bridge
  │   Bridge         │  1.135 ETH
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │  INTERMEDIARY    │  0x6aEcB6ee...0EE5ccB
  │   ~0.12 ETH      │  Receives bridged funds
  └────────┬─────────┘
           │
           ▼ Dec 6, 2025
  ╔══════════════════╗
  ║  ATTACKER EOA    ║  0x6C8EC8f1...562b50
  ║  Funded: 1.015   ║  Main attack wallet
  ╚════════╤═════════╝
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼ Dec 27, 2025
  [Deploy    ┌──────────────┐
   Test      │ Tornado Cash │  4 ETH (test deposits)
   Contract] │   Router     │  4x 1 ETH transactions
             └──────────────┘

══════════════════════════════════════════════════════════════════════════════════
                             ATTACK EXECUTION (Jan 8, 2026)
══════════════════════════════════════════════════════════════════════════════════

  ╔══════════════════╗                    ╔══════════════════╗
  ║  ATTACKER EOA    ║───deploys─────────►║  ATTACK CONTRACT ║
  ║  0x6C8EC8f1...   ║                    ║  0x1De399...b8   ║
  ╚══════════════════╝                    ╚════════╤═════════╝
                                                   │
                                          calls attack()
                                                   │
                                                   ▼ 16:02:35 UTC
                                       ╔════════════════════════╗
                                       ║    VICTIM CONTRACT     ║
                                       ║   TrueBit Purchase     ║
                                       ║   0x764C64b2...EF2     ║
                                       ║                        ║
                                       ║   -8,535 ETH drained   ║
                                       ╚════════════╤═══════════╝
                                                    │
                 ┌──────────────────────────────────┴──────────────────┐
                 │                                                     │
                 ▼ 16:11 UTC                                           ▼ 18:29 UTC
        ┌────────────────┐                                    ┌────────────────┐
        │  Hop Address   │                                    │ Direct xfer    │
        │  0x3b5819...   │                                    │                │
        │  4,267.1 ETH   │                                    │                │
        └───────┬────────┘                                    │                │
                │                                             │                │
                ▼                                             ▼                │
  ╔═══════════════════════╗                     ╔═══════════════════════╗      │
  ║    DESTINATION A      ║                     ║    DESTINATION B      ║◄─────┘
  ║  0x62AfDD1B...Eb4862  ║                     ║  0x273589ca...cE850a  ║
  ║                       ║                     ║                       ║
  ║    DRAINED            ║                     ║     4,001 ETH         ║
  ║    (was $13.3M)       ║                     ║      ($12.5M)         ║
  ║                       ║                     ║                       ║
  ║  [✓] MOVED Jan 9      ║                     ║  [!] NOT MOVED        ║
  ╚═══════════╤═══════════╝                     ╚═══════════╤═══════════╝
            │
            │ Jan 9, 01:14 UTC
            ▼
  ╔═══════════════════════╗
  ║   NEW HOLDING ADDR    ║
  ║  0xD12f6E0f...31a60   ║
  ║                       ║
  ║    4,267.09 ETH       ║
  ║     ($13.3M)          ║
  ║                       ║
  ║  [!] WATCHING         ║
  ╚═══════════════════════╝
                                                            │
                                                            │ receives message
                                                            ▼
══════════════════════════════════════════════════════════════════════════════════
                           THIRD PARTY INTERACTION
══════════════════════════════════════════════════════════════════════════════════

  ┌──────────────────┐
  │   Relay: Solver  │  Cross-chain aggregator
  │   0xf70da9...bef │  Oct 10, 2024
  └────────┬─────────┘
           │ 0.00773 ETH
           ▼
  ┌──────────────────────┐         0 ETH + message          ╔═════════════════╗
  │   MESSAGE SENDER     │ ─────────────────────────────────►║  DESTINATION B  ║
  │   0xa567c6a2...f9    │    "yo i need a down payment     ║                 ║
  │   (Person of Int.)   │     for a house (also wlfi       ║  (Attacker)     ║
  └──────────────────────┘     bridge has an exploit yw)"   ╚═════════════════╝

══════════════════════════════════════════════════════════════════════════════════
 SUMMARY: ~$26.6M stolen | 4 ETH to Tornado | DEST A MOVED Jan 9 | Law enf. notified
══════════════════════════════════════════════════════════════════════════════════
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
