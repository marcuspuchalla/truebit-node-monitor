import { ref } from 'vue';
import { ethers } from 'ethers';

const AVALANCHE_RPC = 'https://api.avax.network/ext/bc/C/rpc';
const NODE_REGISTRY_ADDRESS = '0x67AF2F01D7cb9A52af289b2702772576bd155310';

const NODE_REGISTRY_ABI = [
  'function isNodeRegistered(address) view returns (bool)',
  'function getNodeAtIndex(uint256) view returns (tuple(address nodeAddress, uint256 blockRegistered, uint256 timestampRegistered))',
  'function getNodeCount() view returns (uint256)',
];

// WorkflowCreated event topic for tracking historical registrations
const WORKFLOW_CREATED_TOPIC = '0x26e34e505f5a896de7bab3f5beecaa9c201fe393d64d2e741b4394d4ad389ffb';

interface NodeRegistrationInfo {
  address: string;
  isRegistered: boolean;
  nodeIndex?: number;
  blockRegistered?: number;
  timestampRegistered?: Date;
}

export interface HistoricalNode {
  address: string;
  blockRegistered: number;
  timestampRegistered: Date | null;
}

let provider: ethers.providers.JsonRpcProvider | null = null;
let contract: ethers.Contract | null = null;

function getContract() {
  if (!provider) {
    provider = new ethers.providers.JsonRpcProvider(AVALANCHE_RPC);
  }
  if (!contract) {
    contract = new ethers.Contract(NODE_REGISTRY_ADDRESS, NODE_REGISTRY_ABI, provider);
  }
  return contract;
}

export function useNodeRegistry() {
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function checkRegistration(address: string): Promise<NodeRegistrationInfo | null> {
    if (!ethers.utils.isAddress(address)) {
      error.value = 'Invalid Ethereum address';
      return null;
    }

    loading.value = true;
    error.value = null;

    try {
      const nodeRegistry = getContract();
      const checksumAddress = ethers.utils.getAddress(address);

      const isRegistered = await nodeRegistry.isNodeRegistered(checksumAddress);

      const result: NodeRegistrationInfo = {
        address: checksumAddress,
        isRegistered,
      };

      if (isRegistered) {
        // Find the node by iterating through all registered nodes
        try {
          const count = await nodeRegistry.getNodeCount();
          for (let i = 0; i < count.toNumber(); i++) {
            const nodeInfo = await nodeRegistry.getNodeAtIndex(i);
            const nodeAddr = nodeInfo.nodeAddress ?? nodeInfo[0];
            if (nodeAddr.toLowerCase() === checksumAddress.toLowerCase()) {
              result.nodeIndex = i;
              const blockReg = nodeInfo.blockRegistered ?? nodeInfo[1];
              const timestampReg = nodeInfo.timestampRegistered ?? nodeInfo[2];

              if (blockReg) {
                result.blockRegistered = blockReg.toNumber?.() ?? Number(blockReg);
              }
              if (timestampReg && (timestampReg.toNumber?.() ?? Number(timestampReg)) > 0) {
                result.timestampRegistered = new Date((timestampReg.toNumber?.() ?? Number(timestampReg)) * 1000);
              }
              break;
            }
          }
        } catch (e) {
          console.error('Failed to fetch node details:', e);
        }
      }

      return result;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to check registration';
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function checkMultipleRegistrations(addresses: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    const validAddresses = addresses.filter(addr => ethers.utils.isAddress(addr));

    const nodeRegistry = getContract();

    await Promise.all(
      validAddresses.map(async (address) => {
        try {
          const checksumAddress = ethers.utils.getAddress(address);
          const isRegistered = await nodeRegistry.isNodeRegistered(checksumAddress);
          results.set(checksumAddress.toLowerCase(), isRegistered);
        } catch {
          results.set(address.toLowerCase(), false);
        }
      })
    );

    return results;
  }

  async function getNodeCount(): Promise<number> {
    try {
      const nodeRegistry = getContract();
      const count = await nodeRegistry.getNodeCount();
      return count.toNumber();
    } catch {
      return 0;
    }
  }

  async function getAllNodes(): Promise<NodeRegistrationInfo[]> {
    loading.value = true;
    error.value = null;

    try {
      const nodeRegistry = getContract();
      const count = await nodeRegistry.getNodeCount();
      const nodes: NodeRegistrationInfo[] = [];

      for (let i = 0; i < count.toNumber(); i++) {
        try {
          const nodeInfo = await nodeRegistry.getNodeAtIndex(i);
          nodes.push({
            address: nodeInfo.nodeAddress,
            isRegistered: true,
            nodeIndex: i,
            blockRegistered: nodeInfo.blockRegistered?.toNumber?.(),
            timestampRegistered: nodeInfo.timestampRegistered?.toNumber?.() > 0
              ? new Date(nodeInfo.timestampRegistered.toNumber() * 1000)
              : undefined
          });
        } catch {
          // Skip this node if we can't fetch it
        }
      }

      return nodes;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch nodes';
      return [];
    } finally {
      loading.value = false;
    }
  }

  /**
   * Fetch all historical registrations from WorkflowCreated events
   */
  async function getHistoricalRegistrations(): Promise<HistoricalNode[]> {
    try {
      // Use Snowtrace API to get WorkflowCreated events
      const response = await fetch(
        `https://api.snowtrace.io/api?module=logs&action=getLogs&address=${NODE_REGISTRY_ADDRESS}&topic0=${WORKFLOW_CREATED_TOPIC}&fromBlock=0&toBlock=latest`
      );
      const data = await response.json();

      if (data.status !== '1' || !data.result) {
        return [];
      }

      // Extract unique addresses from events (topic[1] is the node address)
      const addressMap = new Map<string, HistoricalNode>();

      for (const log of data.result) {
        if (log.topics && log.topics[1]) {
          // Address is in topic[1], padded to 32 bytes
          const address = '0x' + log.topics[1].slice(26);
          const blockNumber = parseInt(log.blockNumber, 16);
          const timestamp = parseInt(log.timeStamp, 16);

          // Keep the first (earliest) registration for each address
          if (!addressMap.has(address.toLowerCase())) {
            addressMap.set(address.toLowerCase(), {
              address: ethers.utils.getAddress(address),
              blockRegistered: blockNumber,
              timestampRegistered: timestamp > 0 ? new Date(timestamp * 1000) : null
            });
          }
        }
      }

      return Array.from(addressMap.values());
    } catch (e) {
      console.error('Failed to fetch historical registrations:', e);
      return [];
    }
  }

  /**
   * Get nodes that were previously registered but are no longer active
   */
  async function getInactiveNodes(activeNodes: NodeRegistrationInfo[]): Promise<HistoricalNode[]> {
    const historical = await getHistoricalRegistrations();
    const activeAddresses = new Set(activeNodes.map(n => n.address.toLowerCase()));

    return historical.filter(node => !activeAddresses.has(node.address.toLowerCase()));
  }

  return {
    loading,
    error,
    checkRegistration,
    checkMultipleRegistrations,
    getNodeCount,
    getAllNodes,
    getHistoricalRegistrations,
    getInactiveNodes,
  };
}
