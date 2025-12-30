import { ref } from 'vue';
import { ethers } from 'ethers';

const AVALANCHE_RPC = 'https://api.avax.network/ext/bc/C/rpc';
const NODE_REGISTRY_ADDRESS = '0x67AF2F01D7cb9A52af289b2702772576bd155310';

const NODE_REGISTRY_ABI = [
  'function isNodeRegistered(address) view returns (bool)',
  'function getNodeAtIndex(uint256) view returns (tuple(address nodeAddress, uint256 blockRegistered, uint256 timestampRegistered))',
  'function getNodeCount() view returns (uint256)',
];

interface NodeRegistrationInfo {
  address: string;
  isRegistered: boolean;
  nodeIndex?: number;
  blockRegistered?: number;
  timestampRegistered?: Date;
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

  return {
    loading,
    error,
    checkRegistration,
    checkMultipleRegistrations,
    getNodeCount,
    getAllNodes,
  };
}
