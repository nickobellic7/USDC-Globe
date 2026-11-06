import { useMemo, useState } from 'react'
import { ConnectKitButton } from 'connectkit'
import { Globe2 } from 'lucide-react'
import { useAccount } from 'wagmi'
import { Globe, type LatLon } from '@/components/Globe'
import { PinList } from '@/components/PinList'
import { PlacePin } from '@/components/PlacePin'
import { useGlobePins } from '@/hooks/useGlobePins'
import { ARC_GLOBE_ADDRESS, type GlobePin } from '@/lib/arcGlobe'
import { formatUsdcFull, shortAddress } from '@/lib/format'

export default function App() {
  const { address } = useAccount()
  const { pins, total, isLoading, isError, refresh } = useGlobePins()

  const [draft, setDraft] = useState<LatLon | null>(null)
  const [label, setLabel] = useState('')
  const [picking, setPicking] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [focus, setFocus] = useState<(LatLon & { key: number }) | null>(null)

  const myPin = useMemo(
    () => pins.find((p) => address && p.user.toLowerCase() === address.toLowerCase()),
    [pins, address],
  )

  const held = useMemo(() => pins.reduce((acc, p) => acc + (p.usdc ?? 0n), 0n), [pins])
  const anyBalance = pins.some((p) => p.usdc !== undefined)

  const flyTo = (p: LatLon) => setFocus({ ...p, key: Date.now() })

  const handleSelectPin = (p: GlobePin) => {
    setSelected(p.user)
    flyTo(p)
  }

  const handleDraft = (p: LatLon | null, nextLabel?: string) => {
    setDraft(p)
    if (nextLabel !== undefined) setLabel(nextLabel)
    if (p) flyTo(p)
    setPicking(false)
  }

  const selectedPin = pins.find((p) => p.user === selected)

  if (!ARC_GLOBE_ADDRESS) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6 text-center text-[var(--muted)]">
        The globe contract address is not configured.
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-white/5">
            <Globe2 size={18} className="text-[var(--accent)]" />
          </span>
          <div className="leading-tight">
            <h1 className="display text-lg font-semibold">Arc USDC Globe</h1>
            <p className="hidden text-[12px] text-[var(--subtle)] sm:block">Wallets that chose to show where they are</p>
          </div>
        </div>
        <ConnectKitButton.Custom>
          {({ isConnected, show, address: a }) => (
            <button
              type="button"
              onClick={show}
              className="h-11 rounded-xl border border-[var(--border)] bg-white/5 px-4 text-sm font-medium text-[var(--ink)] transition hover:bg-white/10"
            >
              {isConnected && a ? <span className="mono text-[13px]">{shortAddress(a)}</span> : 'Connect wallet'}
            </button>
          )}
        </ConnectKitButton.Custom>
      </header>

      <main className="grid min-h-0 flex-1 gap-4 px-4 pb-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section className="relative h-[62dvh] min-h-[380px] overflow-hidden rounded-3xl border border-[var(--border)] bg-[radial-gradient(ellipse_at_50%_40%,rgba(172,198,233,0.08),transparent_70%)] lg:h-auto">
          <Globe
            pins={pins}
            me={address}
            draft={draft}
            picking={picking}
            focus={focus}
            selected={selected}
            onPick={(p) => handleDraft(p, label || 'Pinned location')}
            onSelect={setSelected}
          />

          <div className="pointer-events-none absolute left-4 top-4 sm:left-6 sm:top-6">
            <div className="label">Pinned wallets</div>
            <div className="display text-5xl font-semibold tabular-nums text-[var(--ink)] sm:text-6xl">
              {isLoading ? '...' : total}
            </div>
            <div className="mt-1 text-sm tabular-nums text-[var(--muted)]">
              {anyBalance ? `${formatUsdcFull(held)} USDC held` : 'Reading balances'}
            </div>
          </div>

          {selectedPin && (
            <div className="surface absolute bottom-3 left-3 right-16 max-w-xs rounded-2xl p-3 sm:bottom-4 sm:left-4">
              <div className="display text-base font-semibold">{selectedPin.city || 'Pinned location'}</div>
              <div className="mono text-[11px] text-[var(--subtle)]">{shortAddress(selectedPin.user)}</div>
              <div className="mt-1 text-sm tabular-nums text-[var(--ink-2)]">
                {selectedPin.usdc !== undefined ? `${formatUsdcFull(selectedPin.usdc)} USDC` : 'Loading balance'}
              </div>
            </div>
          )}
        </section>

        <aside className="flex min-h-0 flex-col gap-4">
          <PlacePin
            myPin={myPin}
            draft={draft}
            label={label}
            picking={picking}
            onLabel={setLabel}
            onDraft={handleDraft}
            onPicking={setPicking}
            onDone={() => {
              setDraft(null)
              setLabel('')
              setPicking(false)
              refresh()
            }}
          />
          <PinList
            pins={pins}
            loading={isLoading}
            error={isError}
            selected={selected}
            me={address}
            onSelect={handleSelectPin}
          />
        </aside>
      </main>
    </div>
  )
}
