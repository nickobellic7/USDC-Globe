import { ExternalLink } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import type { GlobePin } from '@/lib/arcGlobe'
import { ARC_GLOBE_CHAIN_ID } from '@/lib/arcGlobe'
import { formatUsdcFull, shortAddress } from '@/lib/format'
import { buildAddressExplorerUrl } from '@/onchain-facts'

interface Props {
  pins: GlobePin[]
  loading: boolean
  error: boolean
  selected: string | null
  me?: string
  onSelect: (pin: GlobePin) => void
}

export function PinList({ pins, loading, error, selected, me, onSelect }: Props) {
  const sorted = [...pins].sort((a, b) => {
    const A = a.usdc ?? -1n
    const B = b.usdc ?? -1n
    return A === B ? b.updatedAt - a.updatedAt : A > B ? -1 : 1
  })

  return (
    <section className="surface flex min-h-0 flex-1 flex-col rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <h2 className="display text-lg font-semibold">Pinned wallets</h2>
        <span className="label">By USDC held</span>
      </div>

      <div className="scroll-thin mt-3 min-h-[120px] flex-1 overflow-y-auto pr-1">
        {loading && (
          <div className="grid gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        )}

        {!loading && error && (
          <p className="py-6 text-center text-sm text-[var(--danger)]">Could not load pins from Arc Testnet.</p>
        )}

        {!loading && !error && sorted.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-[var(--ink-2)]">No pins yet</p>
            <p className="mt-1 text-[13px] text-[var(--subtle)]">Be the first wallet on the globe.</p>
          </div>
        )}

        <ul className="grid gap-1.5">
          {sorted.map((p) => {
            const isSel = selected === p.user
            const isMe = me?.toLowerCase() === p.user.toLowerCase()
            return (
              <li key={p.user}>
                <div
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${
                    isSel ? 'bg-white/15' : 'hover:bg-white/8'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(p)}
                    className="flex min-h-[44px] min-w-0 flex-1 flex-col items-start text-left"
                  >
                    <span className="display flex items-center gap-2 text-[15px] font-semibold text-[var(--ink)]">
                      <span className="truncate">{p.city || 'Pinned location'}</span>
                      {isMe && (
                        <span className="rounded-full border border-[var(--border-strong)] px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider">
                          You
                        </span>
                      )}
                    </span>
                    <span className="mono text-[11px] text-[var(--subtle)]">{shortAddress(p.user)}</span>
                  </button>
                  <div className="flex items-center gap-1.5 text-sm tabular-nums text-[var(--ink-2)]">
                    <TokenUSDC variant="branded" size={16} />
                    {p.usdc !== undefined ? formatUsdcFull(p.usdc) : '...'}
                  </div>
                  <a
                    href={buildAddressExplorerUrl(ARC_GLOBE_CHAIN_ID, p.user)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="View on explorer"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--subtle)] transition hover:bg-white/10 hover:text-[var(--ink)]"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
