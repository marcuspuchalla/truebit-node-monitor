<template>
  <div class="fund-flow-container">
    <!-- Header -->
    <div class="header">
      <div class="flex items-center gap-4">
        <router-link to="/security-incident" class="back-link">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
            <path fill-rule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clip-rule="evenodd" />
          </svg>
          Back to Incident
        </router-link>
        <h1 class="title">Fund Flow Visualization</h1>
      </div>
      <div class="legend">
        <div class="legend-item">
          <span class="legend-dot bridge"></span>
          <span>Bridge</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot attacker"></span>
          <span>Attacker</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot victim"></span>
          <span>Victim</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot holding"></span>
          <span>Holding</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot drained"></span>
          <span>Drained</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot mixer"></span>
          <span>Mixer</span>
        </div>
      </div>
    </div>

    <!-- VueFlow Graph -->
    <div class="graph-container">
      <VueFlow
        :nodes="nodes"
        :edges="edges"
        :default-viewport="{ zoom: 0.8, x: 100, y: 50 }"
        :min-zoom="0.2"
        :max-zoom="2"
        fit-view-on-init
        class="vue-flow-dark"
      >
        <Background :variant="BackgroundVariant.Dots" :gap="20" :size="1" pattern-color="#334155" />
        <Controls position="bottom-right" />

        <!-- Custom Node Template -->
        <template #node-custom="{ data }">
          <div :class="['custom-node', data.type]">
            <div class="node-label">{{ data.label }}</div>
            <div class="node-address">{{ data.address }}</div>
            <div v-if="data.balance" class="node-balance">{{ data.balance }}</div>
            <div v-if="data.status" :class="['node-status', data.statusClass]">{{ data.status }}</div>
          </div>
        </template>
      </VueFlow>
    </div>

    <!-- Info Panel -->
    <div class="info-panel">
      <div class="info-title">Last Updated: {{ lastUpdated }}</div>
      <div class="info-stats">
        <div class="stat">
          <span class="stat-value text-red-400">~4,267 ETH</span>
          <span class="stat-label">Laundered</span>
        </div>
        <div class="stat">
          <span class="stat-value text-yellow-400">~4,001 ETH</span>
          <span class="stat-label">Still Held</span>
        </div>
        <div class="stat">
          <span class="stat-value text-slate-400">~268 ETH</span>
          <span class="stat-label">Attacker EOA</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { VueFlow } from '@vue-flow/core';
import { Background, BackgroundVariant } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';

const lastUpdated = 'Jan 10, 2026 - 20:00 UTC';

// Node positions - laid out top-to-bottom chronologically
// Phase 1 (top): Preparation - funding the attacker (Nov-Dec 2025)
// Phase 2 (middle): Attack execution (Jan 8, 2026)
// Phase 3 (bottom): Fund movement and laundering (Jan 8-10, 2026)
const nodes = ref([
  // ═══════════════════════════════════════════════════════════════
  // PHASE 1: PREPARATION (Top) - Nov-Dec 2025
  // ═══════════════════════════════════════════════════════════════

  // Rhino.fi Bridge - Nov 21, 2025
  {
    id: 'rhino',
    type: 'custom',
    position: { x: 150, y: 0 },
    data: {
      label: 'Rhino.fi Bridge',
      address: 'From Optimism',
      balance: '1.2 ETH',
      status: 'Nov 21, 2025',
      statusClass: 'status-neutral',
      type: 'bridge'
    }
  },
  // Across Protocol - Nov 29, 2025
  {
    id: 'across',
    type: 'custom',
    position: { x: 450, y: 0 },
    data: {
      label: 'Across Protocol',
      address: 'Cross-chain Bridge',
      balance: '1.135 ETH',
      status: 'Nov 29, 2025',
      statusClass: 'status-neutral',
      type: 'bridge'
    }
  },
  // Intermediary - Chain hopping
  {
    id: 'intermediary',
    type: 'custom',
    position: { x: 300, y: 120 },
    data: {
      label: 'Intermediary',
      address: '0x6aEc...5ccB',
      balance: '~0 ETH',
      status: 'Chain-hopped',
      statusClass: 'status-neutral',
      type: 'drained'
    }
  },
  // Attacker EOA - Dec 6, 2025 funded
  {
    id: 'attacker-eoa',
    type: 'custom',
    position: { x: 300, y: 240 },
    data: {
      label: 'Attacker EOA',
      address: '0x6C8E...62b50',
      balance: '267.71 ETH',
      status: 'Funded Dec 6',
      statusClass: 'status-active',
      type: 'attacker'
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // PHASE 2: ATTACK (Middle) - Jan 8, 2026 16:02 UTC
  // ═══════════════════════════════════════════════════════════════

  // Attack Contract - deployed Jan 8
  {
    id: 'attack-contract',
    type: 'custom',
    position: { x: 300, y: 380 },
    data: {
      label: 'Attack Contract',
      address: '0x1De3...bF11b8',
      balance: '0 ETH',
      status: 'Jan 8, 16:02',
      statusClass: 'status-attack',
      type: 'attacker'
    }
  },
  // Victim Contract
  {
    id: 'victim',
    type: 'custom',
    position: { x: 550, y: 380 },
    data: {
      label: 'TrueBit Purchase',
      address: '0x764C...0302EF2',
      balance: '~15.87 ETH',
      status: 'EXPLOITED',
      statusClass: 'status-drained',
      type: 'victim'
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // PHASE 3: FUND MOVEMENT (Bottom) - Jan 8-10, 2026
  // ═══════════════════════════════════════════════════════════════

  // Destination A - received 4,267 ETH
  {
    id: 'dest-a',
    type: 'custom',
    position: { x: 100, y: 520 },
    data: {
      label: 'Destination A',
      address: '0x62Af...Eb4862',
      balance: '~0 ETH',
      status: 'Drained Jan 9',
      statusClass: 'status-drained',
      type: 'drained'
    }
  },
  // Destination B - received 4,001 ETH (still holding)
  {
    id: 'dest-b',
    type: 'custom',
    position: { x: 500, y: 520 },
    data: {
      label: 'Destination B',
      address: '0x2735...E850a',
      balance: '~4,001 ETH',
      status: 'STILL HOLDING',
      statusClass: 'status-holding',
      type: 'holding'
    }
  },
  // New Holding Address - Jan 9
  {
    id: 'new-holding',
    type: 'custom',
    position: { x: 100, y: 640 },
    data: {
      label: 'New Holding',
      address: '0xD12f...31a60',
      balance: '~0 ETH',
      status: 'Emptied Jan 10',
      statusClass: 'status-drained',
      type: 'drained'
    }
  },
  // Laundering Address - Jan 10
  {
    id: 'laundering',
    type: 'custom',
    position: { x: 100, y: 760 },
    data: {
      label: 'Laundering Wallet',
      address: '0x7720...3a59D',
      balance: '~0.6 ETH',
      status: '57+ txns out',
      statusClass: 'status-mixer',
      type: 'attacker'
    }
  },
  // Tornado Cash - final destination
  {
    id: 'tornado',
    type: 'custom',
    position: { x: 100, y: 880 },
    data: {
      label: 'Tornado Cash',
      address: 'Mixer Protocol',
      balance: '~4,267 ETH',
      status: 'LAUNDERED',
      statusClass: 'status-mixer',
      type: 'mixer'
    }
  },
  // Message Sender - side note
  {
    id: 'message-sender',
    type: 'custom',
    position: { x: 500, y: 640 },
    data: {
      label: 'Message Sender',
      address: '0xa567...047f9',
      balance: 'Unknown',
      status: 'Person of Interest',
      statusClass: 'status-poi',
      type: 'drained'
    }
  }
]);

// Edges - fund flow connections (chronological top-to-bottom)
const edges = ref([
  // ═══════════════════════════════════════════════════════════════
  // PHASE 1: PREPARATION - Funding chain (Nov-Dec 2025)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'e-rhino-inter',
    source: 'rhino',
    target: 'intermediary',
    label: '1.2 ETH',
    animated: false,
    style: { stroke: '#64748b', strokeWidth: 2 },
    labelStyle: { fill: '#94a3b8', fontSize: '11px' },
    labelBgStyle: { fill: '#1e293b', fillOpacity: 0.9 }
  },
  {
    id: 'e-across-inter',
    source: 'across',
    target: 'intermediary',
    label: '1.135 ETH',
    animated: false,
    style: { stroke: '#64748b', strokeWidth: 2 },
    labelStyle: { fill: '#94a3b8', fontSize: '11px' },
    labelBgStyle: { fill: '#1e293b', fillOpacity: 0.9 }
  },
  {
    id: 'e-inter-eoa',
    source: 'intermediary',
    target: 'attacker-eoa',
    label: '1.015 ETH (Dec 6)',
    animated: false,
    style: { stroke: '#64748b', strokeWidth: 2 },
    labelStyle: { fill: '#94a3b8', fontSize: '11px' },
    labelBgStyle: { fill: '#1e293b', fillOpacity: 0.9 }
  },

  // ═══════════════════════════════════════════════════════════════
  // PHASE 2: ATTACK - Jan 8, 2026 16:02 UTC
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'e-eoa-attack',
    source: 'attacker-eoa',
    target: 'attack-contract',
    label: 'Deploys',
    animated: false,
    style: { stroke: '#f97316', strokeWidth: 2 },
    labelStyle: { fill: '#f97316', fontSize: '11px' },
    labelBgStyle: { fill: '#1e293b', fillOpacity: 0.9 }
  },
  {
    id: 'e-attack-victim',
    source: 'attack-contract',
    target: 'victim',
    label: 'Exploits',
    animated: false,
    style: { stroke: '#ef4444', strokeWidth: 3 },
    labelStyle: { fill: '#ef4444', fontWeight: 'bold', fontSize: '11px' },
    labelBgStyle: { fill: '#1e293b', fillOpacity: 0.9 }
  },
  {
    id: 'e-victim-attack',
    source: 'victim',
    target: 'attack-contract',
    label: '8,535 ETH drained',
    animated: false,
    type: 'straight',
    style: { stroke: '#ef4444', strokeWidth: 3, strokeDasharray: '5,5' },
    labelStyle: { fill: '#ef4444', fontWeight: 'bold', fontSize: '11px' },
    labelBgStyle: { fill: '#1e293b', fillOpacity: 0.9 }
  },

  // ═══════════════════════════════════════════════════════════════
  // PHASE 3: FUND DISTRIBUTION - Jan 8, 2026
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'e-attack-desta',
    source: 'attack-contract',
    target: 'dest-a',
    label: '4,267 ETH',
    animated: false,
    style: { stroke: '#f97316', strokeWidth: 3 },
    labelStyle: { fill: '#f97316', fontWeight: 'bold', fontSize: '11px' },
    labelBgStyle: { fill: '#1e293b', fillOpacity: 0.9 }
  },
  {
    id: 'e-attack-destb',
    source: 'attack-contract',
    target: 'dest-b',
    label: '4,001 ETH',
    animated: true,
    style: { stroke: '#eab308', strokeWidth: 3 },
    labelStyle: { fill: '#eab308', fontWeight: 'bold', fontSize: '11px' },
    labelBgStyle: { fill: '#1e293b', fillOpacity: 0.9 }
  },

  // ═══════════════════════════════════════════════════════════════
  // PHASE 4: LAUNDERING CHAIN - Jan 9-10, 2026
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'e-desta-newholding',
    source: 'dest-a',
    target: 'new-holding',
    label: '4,267 ETH (Jan 9)',
    animated: false,
    style: { stroke: '#f97316', strokeWidth: 2 },
    labelStyle: { fill: '#f97316', fontWeight: 'bold', fontSize: '11px' },
    labelBgStyle: { fill: '#1e293b', fillOpacity: 0.9 }
  },
  {
    id: 'e-newholding-laundering',
    source: 'new-holding',
    target: 'laundering',
    label: '4,267 ETH (Jan 10)',
    animated: false,
    style: { stroke: '#ef4444', strokeWidth: 2 },
    labelStyle: { fill: '#ef4444', fontWeight: 'bold', fontSize: '11px' },
    labelBgStyle: { fill: '#1e293b', fillOpacity: 0.9 }
  },
  {
    id: 'e-laundering-tornado',
    source: 'laundering',
    target: 'tornado',
    label: '57+ deposits',
    animated: false,
    style: { stroke: '#a855f7', strokeWidth: 3 },
    labelStyle: { fill: '#a855f7', fontWeight: 'bold', fontSize: '11px' },
    labelBgStyle: { fill: '#1e293b', fillOpacity: 0.9 }
  },

  // Message to attacker (side connection)
  {
    id: 'e-message-destb',
    source: 'message-sender',
    target: 'dest-b',
    label: 'On-chain message',
    animated: false,
    style: { stroke: '#ec4899', strokeWidth: 1, strokeDasharray: '5,5' },
    labelStyle: { fill: '#ec4899', fontSize: '10px' },
    labelBgStyle: { fill: '#1e293b', fillOpacity: 0.9 }
  }
]);
</script>

<style scoped>
.fund-flow-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #0f172a;
  color: #e2e8f0;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: #1e293b;
  border-bottom: 1px solid #334155;
}

.back-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #22d3ee;
  text-decoration: none;
  font-size: 0.875rem;
  transition: color 0.2s;
}

.back-link:hover {
  color: #67e8f9;
}

.title {
  font-size: 1.25rem;
  font-weight: bold;
  color: #22d3ee;
}

.legend {
  display: flex;
  gap: 1.5rem;
  font-size: 0.75rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.legend-dot.bridge {
  background: #3b82f6;
}

.legend-dot.victim {
  background: #ef4444;
}

.legend-dot.attacker {
  background: #f97316;
}

.legend-dot.holding {
  background: #eab308;
}

.legend-dot.drained {
  background: #64748b;
}

.legend-dot.mixer {
  background: #a855f7;
}

.graph-container {
  flex: 1;
  width: 100%;
}

.vue-flow-dark {
  background: #0f172a;
}

/* Custom node styles */
.custom-node {
  padding: 12px 16px;
  border-radius: 8px;
  min-width: 160px;
  text-align: center;
  font-family: ui-monospace, monospace;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.3);
}

.custom-node.victim {
  background: linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%);
  border: 2px solid #ef4444;
}

.custom-node.attacker {
  background: linear-gradient(135deg, #7c2d12 0%, #9a3412 100%);
  border: 2px solid #f97316;
}

.custom-node.holding {
  background: linear-gradient(135deg, #713f12 0%, #854d0e 100%);
  border: 2px solid #eab308;
  animation: pulse-border 2s infinite;
}

.custom-node.bridge {
  background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%);
  border: 2px solid #3b82f6;
}

.custom-node.drained {
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
  border: 2px solid #64748b;
}

.custom-node.mixer {
  background: linear-gradient(135deg, #581c87 0%, #7c3aed 100%);
  border: 2px solid #a855f7;
}

@keyframes pulse-border {
  0%, 100% { border-color: #eab308; }
  50% { border-color: #fde047; }
}

.node-label {
  font-weight: bold;
  font-size: 0.875rem;
  color: #f1f5f9;
  margin-bottom: 4px;
}

.node-address {
  font-size: 0.7rem;
  color: #94a3b8;
  margin-bottom: 4px;
}

.node-balance {
  font-size: 0.8rem;
  font-weight: bold;
  color: #22d3ee;
  margin-bottom: 4px;
}

.node-status {
  font-size: 0.65rem;
  padding: 2px 8px;
  border-radius: 9999px;
  display: inline-block;
}

.status-drained {
  background: #334155;
  color: #94a3b8;
}

.status-active {
  background: #365314;
  color: #a3e635;
}

.status-attack {
  background: #7f1d1d;
  color: #fca5a5;
}

.status-holding {
  background: #713f12;
  color: #fde047;
}

.status-mixer {
  background: #581c87;
  color: #e879f9;
}

.status-neutral {
  background: #334155;
  color: #94a3b8;
}

.status-poi {
  background: #831843;
  color: #f472b6;
}

.info-panel {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1.5rem;
  background: #1e293b;
  border-top: 1px solid #334155;
}

.info-title {
  font-size: 0.75rem;
  color: #64748b;
}

.info-stats {
  display: flex;
  gap: 2rem;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-weight: bold;
  font-size: 0.875rem;
}

.stat-label {
  font-size: 0.65rem;
  color: #64748b;
}

/* Vue Flow overrides for dark theme */
:deep(.vue-flow__edge-path) {
  stroke-linecap: round;
}

:deep(.vue-flow__edge-text) {
  font-size: 11px;
}

:deep(.vue-flow__controls) {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
}

:deep(.vue-flow__controls-button) {
  background: #1e293b;
  border: none;
  color: #94a3b8;
}

:deep(.vue-flow__controls-button:hover) {
  background: #334155;
  color: #f1f5f9;
}

:deep(.vue-flow__controls-button svg) {
  fill: currentColor;
}
</style>
