import { ref } from 'vue';
import { ethers } from 'ethers';

const ETHEREUM_RPC = 'https://eth.llamarpc.com';
const STAKING_ADDRESS = '0x94D2e9CC66Ac140bC5C2DE552DdFbd32f80eEe86';
const TRU_TOKEN = '0xf65B5C5104c4faFD4b709d9D60a185eAE063276c';

const STAKING_ABI = [
  'function totalStaked() view returns (uint256)',
  'function token() view returns (address)',
  'function getStake(address) view returns (uint256 amount, uint256 unlockTime)',
];

export interface StakeInfo {
  address: string;
  amount: number;
  unlockTime: Date | null;
  isLocked: boolean;
}

export interface StakingStats {
  totalStaked: number;
  tokenAddress: string;
}

let provider: ethers.providers.JsonRpcProvider | null = null;
let contract: ethers.Contract | null = null;

function getContract() {
  if (!provider) {
    provider = new ethers.providers.JsonRpcProvider(ETHEREUM_RPC);
  }
  if (!contract) {
    contract = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI, provider);
  }
  return contract;
}

export function useStaking() {
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function getStats(): Promise<StakingStats | null> {
    loading.value = true;
    error.value = null;

    try {
      const staking = getContract();
      const [totalStaked, token] = await Promise.all([
        staking.totalStaked(),
        staking.token()
      ]);

      return {
        totalStaked: parseFloat(ethers.utils.formatEther(totalStaked)),
        tokenAddress: token
      };
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch staking stats';
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function getStakeInfo(address: string): Promise<StakeInfo | null> {
    if (!ethers.utils.isAddress(address)) {
      error.value = 'Invalid Ethereum address';
      return null;
    }

    loading.value = true;
    error.value = null;

    try {
      const staking = getContract();
      const checksumAddress = ethers.utils.getAddress(address);
      const stake = await staking.getStake(checksumAddress);

      const amount = parseFloat(ethers.utils.formatEther(stake.amount));
      const unlockTimestamp = stake.unlockTime.toNumber();
      const unlockTime = unlockTimestamp > 0 ? new Date(unlockTimestamp * 1000) : null;
      const isLocked = unlockTime ? unlockTime.getTime() > Date.now() : false;

      return {
        address: checksumAddress,
        amount,
        unlockTime,
        isLocked
      };
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch stake info';
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function getMultipleStakes(addresses: string[]): Promise<Map<string, StakeInfo>> {
    const results = new Map<string, StakeInfo>();
    const staking = getContract();

    const validAddresses = addresses.filter(addr => ethers.utils.isAddress(addr));

    await Promise.all(
      validAddresses.map(async (address) => {
        try {
          const checksumAddress = ethers.utils.getAddress(address);
          const stake = await staking.getStake(checksumAddress);
          const amount = parseFloat(ethers.utils.formatEther(stake.amount));

          if (amount > 0) {
            const unlockTimestamp = stake.unlockTime.toNumber();
            const unlockTime = unlockTimestamp > 0 ? new Date(unlockTimestamp * 1000) : null;

            results.set(checksumAddress, {
              address: checksumAddress,
              amount,
              unlockTime,
              isLocked: unlockTime ? unlockTime.getTime() > Date.now() : false
            });
          }
        } catch {
          // Skip failed lookups
        }
      })
    );

    return results;
  }

  return {
    loading,
    error,
    getStats,
    getStakeInfo,
    getMultipleStakes,
    STAKING_ADDRESS,
    TRU_TOKEN
  };
}
