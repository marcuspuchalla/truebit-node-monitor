<template>
  <div class="space-y-6">
    <div class="card">
      <!-- Header -->
      <div class="mb-6">
        <h1 class="text-xl font-bold text-gray-900 dark:text-cyan-400 mb-2">On-Chain Activity</h1>
        <p class="text-sm text-gray-600 dark:text-slate-400">
          Truebit smart contracts across Ethereum and Avalanche networks
        </p>
      </div>

      <!-- Truebit Verify (Current System) -->
      <div class="mb-8">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-cyan-400 mb-4 flex items-center gap-2">
          <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          Truebit Verify (Active)
        </h2>
        <p class="text-sm text-gray-600 dark:text-slate-400 mb-4">
          The current Truebit verification system uses a dual-chain architecture with staking on Ethereum and node registration on Avalanche.
        </p>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 dark:border-slate-700">
                <th class="text-left py-2 px-3 text-gray-600 dark:text-slate-400 font-medium">Contract</th>
                <th class="text-left py-2 px-3 text-gray-600 dark:text-slate-400 font-medium">Network</th>
                <th class="text-left py-2 px-3 text-gray-600 dark:text-slate-400 font-medium">Address</th>
                <th class="text-left py-2 px-3 text-gray-600 dark:text-slate-400 font-medium">Purpose</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-slate-800">
              <tr v-for="contract in verifyContracts" :key="contract.address" class="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                <td class="py-3 px-3 font-medium text-gray-900 dark:text-slate-200">{{ contract.name }}</td>
                <td class="py-3 px-3">
                  <span :class="getNetworkBadgeClass(contract.network)">
                    {{ contract.network }}
                  </span>
                </td>
                <td class="py-3 px-3">
                  <a
                    :href="getExplorerUrl(contract.network, contract.address)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="font-mono text-xs text-blue-600 dark:text-cyan-400 hover:underline"
                  >
                    {{ formatAddress(contract.address) }}
                  </a>
                </td>
                <td class="py-3 px-3 text-gray-600 dark:text-slate-400">{{ contract.purpose }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Truebit on Ethereum v1 (Legacy) -->
      <div class="mb-8">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-slate-300 mb-4 flex items-center gap-2">
          <span class="w-2 h-2 bg-gray-400 rounded-full"></span>
          Truebit on Ethereum v1 (Legacy)
        </h2>
        <p class="text-sm text-gray-600 dark:text-slate-400 mb-4">
          The original Truebit system deployed on Ethereum mainnet in April 2021. These contracts implement the verification game protocol.
        </p>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 dark:border-slate-700">
                <th class="text-left py-2 px-3 text-gray-600 dark:text-slate-400 font-medium">Contract</th>
                <th class="text-left py-2 px-3 text-gray-600 dark:text-slate-400 font-medium">Network</th>
                <th class="text-left py-2 px-3 text-gray-600 dark:text-slate-400 font-medium">Address</th>
                <th class="text-left py-2 px-3 text-gray-600 dark:text-slate-400 font-medium">Purpose</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-slate-800">
              <tr v-for="contract in legacyContracts" :key="contract.address" class="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                <td class="py-3 px-3 font-medium text-gray-900 dark:text-slate-200">{{ contract.name }}</td>
                <td class="py-3 px-3">
                  <span :class="getNetworkBadgeClass(contract.network)">
                    {{ contract.network }}
                  </span>
                </td>
                <td class="py-3 px-3">
                  <a
                    :href="getExplorerUrl(contract.network, contract.address)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="font-mono text-xs text-blue-600 dark:text-cyan-400 hover:underline"
                  >
                    {{ formatAddress(contract.address) }}
                  </a>
                </td>
                <td class="py-3 px-3 text-gray-600 dark:text-slate-400">{{ contract.purpose }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mt-4 p-3 bg-gray-50 dark:bg-slate-800/30 rounded text-xs text-gray-600 dark:text-slate-400">
          <strong class="dark:text-slate-300">Deployer:</strong>
          <a
            href="https://etherscan.io/address/0x749b6d893b99b161bccd32b224940cde2ecd4c94"
            target="_blank"
            rel="noopener noreferrer"
            class="font-mono text-blue-600 dark:text-cyan-400 hover:underline ml-1"
          >
            0x749b6d893b99b161bccd32b224940cde2ecd4c94
          </a>
          <span class="ml-2">(Truebit: Deployer, April 2021)</span>
        </div>
      </div>

      <!-- Network Info -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div class="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded">
          <h3 class="font-semibold text-blue-900 dark:text-blue-400 mb-2 flex items-center gap-2">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z"/>
            </svg>
            Ethereum Mainnet
          </h3>
          <p class="text-sm text-blue-800 dark:text-blue-300/80">Chain ID: 1</p>
          <p class="text-sm text-blue-800 dark:text-blue-300/80">Explorer: etherscan.io</p>
        </div>
        <div class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded">
          <h3 class="font-semibold text-red-900 dark:text-red-400 mb-2 flex items-center gap-2">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0L1.5 6v12L12 24l10.5-6V6L12 0zm0 2.18l8.25 4.72v9.2L12 20.82l-8.25-4.72v-9.2L12 2.18z"/>
            </svg>
            Avalanche C-Chain
          </h3>
          <p class="text-sm text-red-800 dark:text-red-300/80">Chain ID: 43114</p>
          <p class="text-sm text-red-800 dark:text-red-300/80">Explorer: snowtrace.io</p>
        </div>
      </div>

      <!-- Resources -->
      <div class="border-t dark:border-slate-700 pt-6">
        <h3 class="font-semibold text-gray-900 dark:text-slate-200 mb-3">Resources</h3>
        <div class="flex flex-wrap gap-3">
          <a
            href="https://nodes.truebit.io"
            target="_blank"
            rel="noopener noreferrer"
            class="px-3 py-1.5 text-sm bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
          >
            Node Diagnostics
          </a>
          <a
            href="https://devs.truebit.io"
            target="_blank"
            rel="noopener noreferrer"
            class="px-3 py-1.5 text-sm bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
          >
            Developer Docs
          </a>
          <a
            href="https://github.com/TruebitProtocol/truebit-eth"
            target="_blank"
            rel="noopener noreferrer"
            class="px-3 py-1.5 text-sm bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://truebit.io"
            target="_blank"
            rel="noopener noreferrer"
            class="px-3 py-1.5 text-sm bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
          >
            Truebit.io
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const verifyContracts = [
  {
    name: 'Staking',
    network: 'Ethereum',
    address: '0x94D2e9CC66Ac140bC5C2DE552DdFbd32f80eEe86',
    purpose: 'TRU staking, slashing, withdrawals'
  },
  {
    name: 'Node Registry',
    network: 'Avalanche',
    address: '0x67AF2F01D7cb9A52af289b2702772576bd155310',
    purpose: 'Node registration/deregistration'
  },
  {
    name: 'Staking Implementation',
    network: 'Ethereum',
    address: '0xc1fc4fd47507b083835766a87de0b96f1fb40192',
    purpose: 'Staking logic (upgradeable)'
  },
  {
    name: 'Registry Implementation',
    network: 'Avalanche',
    address: '0x89D44A25f35D14cc3ad317277348980f9991561b',
    purpose: 'Registry logic (upgradeable)'
  }
];

const legacyContracts = [
  {
    name: 'TRU Token',
    network: 'Ethereum',
    address: '0xf65B5C5104c4faFD4b709d9D60a185eAE063276c',
    purpose: 'ERC-20 token contract'
  },
  {
    name: 'FileSystem',
    network: 'Ethereum',
    address: '0x74342D38D317f2D53D3025E229c3e368639449d6',
    purpose: 'IPFS file storage, merkle verification'
  },
  {
    name: 'IncentiveLayer',
    network: 'Ethereum',
    address: '0x388a3bD8f54F305266898e77B126609Ec6265f1e',
    purpose: 'Task rewards, deposits, verification'
  },
  {
    name: 'Judge',
    network: 'Ethereum',
    address: '0x43C65d1234EddE9C9bC638F1FB284E1Eb0c7CA1d',
    purpose: 'Proof validation, state hashes'
  },
  {
    name: 'Interactive',
    network: 'Ethereum',
    address: '0x2E6535e1CcD6EFb6B40d3DA3A6C6DAc773622803',
    purpose: 'Verification games, disputes'
  },
  {
    name: 'IPFSnodeManager',
    network: 'Ethereum',
    address: '0xE9F2e05ceac9FAf98A974b565A8Ad1f72537A9a1',
    purpose: 'IPFS node registry'
  }
];

function formatAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getNetworkBadgeClass(network) {
  if (network === 'Ethereum') {
    return 'px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded';
  }
  return 'px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 rounded';
}

function getExplorerUrl(network, address) {
  if (network === 'Ethereum') {
    return `https://etherscan.io/address/${address}`;
  }
  return `https://snowtrace.io/address/${address}`;
}
</script>
