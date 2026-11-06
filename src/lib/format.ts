import { Amount, usdcDecimalsFor } from '@/onchain-money'
import { ARC_GLOBE_CHAIN_ID } from '@/lib/arcGlobe'

export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

/** Compact USDC display (1.2K, 3.4M) from a raw ERC-20 amount. */
export function formatUsdcCompact(raw: bigint): string {
  const whole = Amount.fromRaw(raw, usdcDecimalsFor(ARC_GLOBE_CHAIN_ID))
  const n = Number(whole.toFixed(2))
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: n < 1000 ? 2 : 1,
  }).format(n)
}

export function formatUsdcFull(raw: bigint): string {
  const whole = Amount.fromRaw(raw, usdcDecimalsFor(ARC_GLOBE_CHAIN_ID))
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Number(whole.toFixed(2)),
  )
}

export function utf8Length(s: string): number {
  return new TextEncoder().encode(s).length
}
