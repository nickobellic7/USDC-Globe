import { useEffect, useState } from 'react'
import { ConnectKitButton } from 'connectkit'
import { toast } from 'sonner'
import { Crosshair, Loader2, MapPin, Trash2 } from 'lucide-react'
import { useAccount, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { ARC_GLOBE_ABI, ARC_GLOBE_ADDRESS, ARC_GLOBE_CHAIN_ID, type GlobePin } from '@/lib/arcGlobe'
import { CITIES } from '@/lib/cities'
import { utf8Length } from '@/lib/format'
import { buildTxExplorerUrl } from '@/onchain-facts'
import type { LatLon } from '@/components/Globe'

interface Props {
  myPin?: GlobePin
  draft: LatLon | null
  label: string
  picking: boolean
  onLabel: (v: string) => void
  onDraft: (p: LatLon | null, label?: string) => void
  onPicking: (v: boolean) => void
  onDone: () => void
}

type Action = 'set' | 'remove'

function isRejection(err: unknown): boolean {
  const m = (err as { message?: string } | null)?.message?.toLowerCase() ?? ''
  return m.includes('user rejected') || m.includes('user denied')
}

export function PlacePin({ myPin, draft, label, picking, onLabel, onDraft, onPicking, onDone }: Props) {
  const { address, chainId, isConnected } = useAccount()
  const { switchChain, isPending: switching } = useSwitchChain()
  const { writeContract, data: hash, isPending, reset, error } = useWriteContract()
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash, chainId: ARC_GLOBE_CHAIN_ID })
  const [action, setAction] = useState<Action>('set')

  const wrongChain = isConnected && chainId !== ARC_GLOBE_CHAIN_ID
  const tooLong = utf8Length(label) > 32
  const busy = isPending || confirming

  useEffect(() => {
    if (!isSuccess || !hash) return
    toast.success(action === 'set' ? 'Your pin is on the globe' : 'Your pin was removed', {
      action: { label: 'View tx', onClick: () => window.open(buildTxExplorerUrl(ARC_GLOBE_CHAIN_ID, hash), '_blank', 'noopener') },
    })
    onDone()
    reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess])

  useEffect(() => {
    if (error && !isRejection(error)) toast.error('Transaction failed. Please try again.')
  }, [error])

  const submit = () => {
    if (!ARC_GLOBE_ADDRESS || !draft) return
    setAction('set')
    writeContract({
      address: ARC_GLOBE_ADDRESS,
      abi: ARC_GLOBE_ABI,
      functionName: 'setPin',
      args: [Math.round(draft.lat * 10), Math.round(draft.lon * 10), label.trim()],
      chainId: ARC_GLOBE_CHAIN_ID,
    })
  }

  const remove = () => {
    if (!ARC_GLOBE_ADDRESS) return
    setAction('remove')
    writeContract({
      address: ARC_GLOBE_ADDRESS,
      abi: ARC_GLOBE_ABI,
      functionName: 'removePin',
      chainId: ARC_GLOBE_CHAIN_ID,
    })
  }

  const primary = (() => {
    if (!isConnected) return null
    if (wrongChain) {
      return (
        <button
          type="button"
          onClick={() => switchChain({ chainId: ARC_GLOBE_CHAIN_ID })}
          disabled={switching}
          className="h-12 w-full rounded-xl bg-[var(--accent)] text-sm font-semibold text-[#0d1b2f] transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
        >
          {switching ? 'Switching...' : 'Switch to Arc Testnet'}
        </button>
      )
    }
    const disabled = busy || !draft || tooLong
    return (
      <button
        type="button"
        onClick={submit}
        disabled={disabled}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] text-sm font-semibold text-[#0d1b2f] transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy && action === 'set' && <Loader2 size={16} className="animate-spin" />}
        {isPending && action === 'set'
          ? 'Confirm in wallet'
          : confirming && action === 'set'
            ? 'Confirming'
            : !draft
              ? 'Choose a location'
              : myPin
                ? 'Move my pin'
                : 'Add my pin'}
      </button>
    )
  })()

  return (
    <section className="surface rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <MapPin size={16} className="text-[var(--accent)]" />
        <h2 className="display text-lg font-semibold">{myPin ? 'Your pin' : 'Put yourself on the globe'}</h2>
      </div>
      <p className="mt-1 text-pretty text-[13px] leading-relaxed text-[var(--subtle)]">
        Optional and public. Your wallet is shown with a location rounded to a whole degree (about 110 km).
      </p>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-1.5">
          <span className="label">Quick pick</span>
          <select
            value=""
            onChange={(e) => {
              const c = CITIES.find((x) => x.name === e.target.value)
              if (c) onDraft({ lat: c.lat, lon: c.lon }, c.name)
            }}
            className="h-11 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--border-strong)]"
          >
            <option value="">{draft ? `${draft.lat}, ${draft.lon}` : 'Choose a city'}</option>
            {CITIES.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => onPicking(!picking)}
          className={`flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition ${
            picking
              ? 'border-[var(--border-strong)] bg-white/15 text-[var(--ink)]'
              : 'border-[var(--border)] text-[var(--ink-2)] hover:bg-white/10'
          }`}
        >
          <Crosshair size={16} />
          {picking ? 'Click the globe...' : 'Pick on the globe'}
        </button>

        <label className="grid gap-1.5">
          <span className="label">Label</span>
          <input
            value={label}
            onChange={(e) => onLabel(e.target.value)}
            placeholder="City or region"
            className="h-11 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--subtle)] focus:border-[var(--border-strong)]"
          />
          <span className={`text-[11px] tabular-nums ${tooLong ? 'text-[var(--danger)]' : 'text-[var(--subtle)]'}`}>
            {utf8Length(label)}/32 bytes
          </span>
        </label>

        {draft && (
          <div className="mono text-[11px] text-[var(--subtle)]">
            lat {draft.lat} / lon {draft.lon}
          </div>
        )}

        {isConnected ? (
          primary
        ) : (
          <ConnectKitButton.Custom>
            {({ show, isConnecting }) => (
              <button
                type="button"
                onClick={show}
                className="h-12 w-full rounded-xl bg-[var(--accent)] text-sm font-semibold text-[#0d1b2f] transition hover:bg-[var(--accent-hover)]"
              >
                {isConnecting ? 'Connecting...' : 'Connect wallet to add a pin'}
              </button>
            )}
          </ConnectKitButton.Custom>
        )}

        {myPin && address && !wrongChain && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-medium text-[var(--danger)] transition hover:bg-white/5 disabled:opacity-50"
          >
            {busy && action === 'remove' ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            {isPending && action === 'remove' ? 'Confirm in wallet' : 'Remove my pin'}
          </button>
        )}
      </div>
    </section>
  )
}
