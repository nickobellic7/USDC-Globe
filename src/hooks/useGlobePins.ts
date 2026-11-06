import { useMemo } from 'react'
import { erc20Abi } from 'viem'
import { useQueryClient } from '@tanstack/react-query'
import { useReadContract, useReadContracts, useWatchContractEvent } from 'wagmi'
import { getUsdc } from '@/onchain-facts'
import {
  ARC_GLOBE_ABI,
  ARC_GLOBE_ADDRESS,
  ARC_GLOBE_CHAIN_ID,
  type GlobePin,
} from '@/lib/arcGlobe'

const PAGE = 200n

export function useGlobePins() {
  const queryClient = useQueryClient()
  const usdc = getUsdc(ARC_GLOBE_CHAIN_ID)
  const enabled = Boolean(ARC_GLOBE_ADDRESS)

  const pinsQuery = useReadContract({
    address: ARC_GLOBE_ADDRESS,
    abi: ARC_GLOBE_ABI,
    functionName: 'getPins',
    args: [0n, PAGE],
    chainId: ARC_GLOBE_CHAIN_ID,
    query: { enabled, refetchInterval: 10_000 },
  })

  const totalQuery = useReadContract({
    address: ARC_GLOBE_ADDRESS,
    abi: ARC_GLOBE_ABI,
    functionName: 'totalPins',
    chainId: ARC_GLOBE_CHAIN_ID,
    query: { enabled, refetchInterval: 10_000 },
  })

  const rawPins = pinsQuery.data

  const balancesQuery = useReadContracts({
    contracts: (rawPins ?? []).map((p) => ({
      address: usdc?.address as `0x${string}`,
      abi: erc20Abi,
      functionName: 'balanceOf' as const,
      args: [p.user] as const,
      chainId: ARC_GLOBE_CHAIN_ID,
    })),
    query: { enabled: enabled && Boolean(usdc) && (rawPins?.length ?? 0) > 0, refetchInterval: 20_000 },
  })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: pinsQuery.queryKey })
    void queryClient.invalidateQueries({ queryKey: totalQuery.queryKey })
  }

  useWatchContractEvent({
    address: ARC_GLOBE_ADDRESS,
    abi: ARC_GLOBE_ABI,
    chainId: ARC_GLOBE_CHAIN_ID,
    onLogs: refresh,
    enabled,
  })

  const pins: GlobePin[] = useMemo(() => {
    if (!rawPins) return []
    return rawPins.map((p, i) => {
      const bal = balancesQuery.data?.[i]
      return {
        user: p.user,
        lat: p.latDeci / 10,
        lon: p.lonDeci / 10,
        city: p.city,
        updatedAt: Number(p.updatedAt),
        usdc: bal && bal.status === 'success' ? (bal.result) : undefined,
      }
    })
  }, [rawPins, balancesQuery.data])

  return {
    pins,
    total: totalQuery.data !== undefined ? Number(totalQuery.data) : pins.length,
    isLoading: pinsQuery.isLoading,
    isError: pinsQuery.isError,
    refresh,
  }
}
