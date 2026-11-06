import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ConnectKitButton } from 'connectkit'
import { toast } from 'sonner'
import { Check, Copy, Globe2, LocateFixed, Pause, Play, X } from 'lucide-react'
import { useAccount } from 'wagmi'
import { Globe, type LatLon } from '@/components/Globe'
import { PinList } from '@/components/PinList'
import { PlacePin } from '@/components/PlacePin'
import { useGlobePins } from '@/hooks/useGlobePins'
import { useUsdcSupply } from '@/hooks/useUsdcSupply'
import { ARC_GLOBE_ADDRESS, type GlobePin } from '@/lib/arcGlobe'
import { formatShare, formatUsdcFull, shortAddress, timeAgo } from '@/lib/format'
import { getShareBase } from '@/lib/share'

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[#0d1b2f]/70 text-[var(--ink-2)] backdrop-blur transition hover:bg-white/10 disabled:opacity-40"
    >
      {children}
    </button>
  )
}

export default function App() {
  const { address } = useAccount()
  const { pins, total, isLoading, isError, refresh } = useGlobePins()
  const supply = useUsdcSupply()

  const [draft, setDraft] = useState<LatLon | null>(null)
  const [label, setLabel] = useState('')
  const [picking, setPicking] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [focus, setFocus] = useState<(LatLon & { key: number }) | null>(null)
  const [spinning, setSpinning] = useState(true)
  const [shareBase, setShareBase] = useState<string>()
  const [copied, setCopied] = useState(false)
  const deepLink = useRef(new URLSearchParams(window.location.search).get('pin'))

  useEffect(() => {
    void getShareBase().then(setShareBase)
  }, [])

  const myPin = useMemo(
    () => pins.find((p) => address && p.user.toLowerCase() === address.toLowerCase()),
    [pins, address],
  )

  const held = useMemo(() => pins.reduce((acc, p) => acc + (p.usdc ?? 0n), 0n), [pins])
  const anyBalance = pins.some((p) => p.usdc !== undefined)

  const flyTo = useCallback((p: LatLon) => setFocus({ ...p, key: Date.now() }), [])

  const select = useCallback((user: string | null) => {
    setSelected(user)
    const url = new URL(window.location.href)
    if (user) url.searchParams.set('pin', user)
    else url.searchParams.delete('pin')
    window.history.replaceState(null, '', url)
  }, [])

  // Open a shared link (?pin=0x...) once the pins have loaded.
  useEffect(() => {
    const wanted = deepLink.current
    if (!wanted || pins.length === 0) return
    const hit = pins.find((p) => p.user.toLowerCase() === wanted.toLowerCase())
    deepLink.current = null
    if (hit) {
      setSelected(hit.user)
      flyTo(hit)
    }
  }, [pins, flyTo])

  const handleSelectPin = (p: GlobePin) => {
    select(p.user)
    flyTo(p)
  }

  const handleDraft = (p: LatLon | null, nextLabel?: string) => {
    setDraft(p)
    if (nextLabel !== undefined) setLabel(nextLabel)
    if (p) flyTo(p)
    setPicking(false)
  }

  const selectedPin = pins.find((p) => p.user === selected)

  const copyLink = async () => {
    if (!selectedPin || !shareBase) return
    try {
      await navigator.clipboard.writeText(`${shareBase}/?pin=${selectedPin.user}`)
      setCopied(true)
      toast.success('Link copied')
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Could not copy the link')
    }
  }

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
        <section className="relative h-[66dvh] min-h-[400px] overflow-hidden rounded-3xl border border-[var(--border)] bg-[radial-gradient(ellipse_at_50%_40%,rgba(172,198,233,0.10),transparent_70%)] lg:h-auto">
          <Globe
            pins={pins}
            me={address}
            draft={draft}
            picking={picking}
            focus={focus}
            selected={selected}
            autoRotate={spinning}
            onPick={(p) => handleDraft(p, label || 'Pinned location')}
            onSelect={select}
          />

          <div className="pointer-events-none absolute left-4 top-4 sm:left-6 sm:top-6">
            <div className="label">Pinned wallets</div>
            <div className="display text-5xl font-semibold tabular-nums text-[var(--ink)] sm:text-6xl">
              {isLoading ? '...' : total}
            </div>
            <div className="mt-1 text-sm tabular-nums text-[var(--muted)]">
              {anyBalance ? `${formatUsdcFull(held)} USDC held` : 'Reading balances'}
            </div>
            {anyBalance && supply !== undefined && (
              <div className="text-[12px] tabular-nums text-[var(--subtle)]">
                {formatShare(held, supply)} of USDC supply on Arc Testnet
              </div>
            )}
            <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--subtle)]" aria-hidden>
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--accent)]" />
              <span className="inline-block h-3 w-3 rounded-full bg-[var(--accent)]" />
              <span className="inline-block h-4 w-4 rounded-full bg-[var(--accent)]" />
              <span>Bigger dot, more USDC</span>
            </div>
          </div>

          <div className="absolute right-3 top-3 flex gap-2 sm:right-4 sm:top-4">
            <IconButton
              label="Find my pin"
              disabled={!myPin}
              onClick={() => {
                if (myPin) handleSelectPin(myPin)
              }}
            >
              <LocateFixed size={18} />
            </IconButton>
            <IconButton label={spinning ? 'Pause rotation' : 'Resume rotation'} onClick={() => setSpinning((v) => !v)}>
              {spinning ? <Pause size={18} /> : <Play size={18} />}
            </IconButton>
          </div>

          {selectedPin && (
            <div className="surface absolute bottom-3 left-3 right-16 max-w-xs rounded-2xl p-3 sm:bottom-4 sm:left-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="display truncate text-base font-semibold">{selectedPin.city || 'Pinned location'}</div>
                  <div className="mono text-[11px] text-[var(--subtle)]">
                    {shortAddress(selectedPin.user)} · {timeAgo(selectedPin.updatedAt)}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => select(null)}
                  className="-mr-1 -mt-1 flex h-9 w-9 items-center justify-center rounded-lg text-[var(--subtle)] hover:bg-white/10 hover:text-[var(--ink)]"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="mt-1 text-sm tabular-nums text-[var(--ink-2)]">
                {selectedPin.usdc !== undefined ? `${formatUsdcFull(selectedPin.usdc)} USDC` : 'Loading balance'}
              </div>
              <button
                type="button"
                onClick={() => void copyLink()}
                disabled={!shareBase}
                className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] text-[13px] font-medium text-[var(--ink-2)] transition hover:bg-white/10 disabled:opacity-50"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy link to this pin'}
              </button>
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
