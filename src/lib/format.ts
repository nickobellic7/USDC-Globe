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

/** "just now", "5m ago", "3h ago", "2d ago" from a unix-seconds timestamp. */
export function timeAgo(unixSeconds: number, nowMs: number = Date.now()): string {
  const s = Math.max(0, Math.floor(nowMs / 1000 - unixSeconds))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

/** Share of `part` in `total` as a percent string with up to 2 decimals. */
export function formatShare(part: bigint, total: bigint): string {
  if (total <= 0n) return '0%'
  const bps = Number((part * 1_000_000n) / total) / 10_000
  if (bps > 0 && bps < 0.01) return '<0.01%'
  return `${bps.toFixed(2)}%`
}
