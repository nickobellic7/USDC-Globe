import { erc20Abi } from 'viem'
import { useReadContract } from 'wagmi'
import { getUsdc } from '@/onchain-facts'
import { ARC_GLOBE_CHAIN_ID } from '@/lib/arcGlobe'

/** Total USDC supply on Arc (ERC-20 view, raw units). */
export function useUsdcSupply() {
  const usdc = getUsdc(ARC_GLOBE_CHAIN_ID)
  const { data } = useReadContract({
    address: usdc?.address as `0x${string}` | undefined,
    abi: erc20Abi,
    functionName: 'totalSupply',
    chainId: ARC_GLOBE_CHAIN_ID,
    query: { enabled: Boolean(usdc), refetchInterval: 30_000 },
  })
  return data
}
