import { ref } from 'vue';
import { ethers } from 'ethers';

const AVALANCHE_RPC = 'https://api.avax.network/ext/bc/C/rpc';
const NODE_REGISTRY_ADDRESS = '0x67AF2F01D7cb9A52af289b2702772576bd155310';

const NODE_REGISTRY_ABI = [
  'function isNodeRegistered(address) view returns (bool)',
  'function nodeIndex(address) view returns (uint256)',
  'function getNodeAtIndex(uint256) view returns (tuple(address nodeAddress, uint256 blockRegistered, uint256 timestampRegistered))',
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
        try {
          const index = await nodeRegistry.nodeIndex(checksumAddress);
          result.nodeIndex = index.toNumber();

          const nodeInfo = await nodeRegistry.getNodeAtIndex(index);
          if (nodeInfo.blockRegistered) {
            result.blockRegistered = nodeInfo.blockRegistered.toNumber();
          }
          if (nodeInfo.timestampRegistered && nodeInfo.timestampRegistered.toNumber() > 0) {
            result.timestampRegistered = new Date(nodeInfo.timestampRegistered.toNumber() * 1000);
          }
        } catch {
          // Additional info failed, but we have registration status
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

  return {
    loading,
    error,
    checkRegistration,
    checkMultipleRegistrations,
  };
}
