import { useCallback, useEffect, useRef, useState } from 'react'
import { geoDistance, geoGraticule10, geoOrthographic, geoPath } from 'd3-geo'
import { feature, mesh } from 'topojson-client'
import { Minus, Plus } from 'lucide-react'
import worldJson from 'world-atlas/countries-110m.json'
import type { GlobePin } from '@/lib/arcGlobe'
import { formatUsdcCompact, shortAddress } from '@/lib/format'

type Topo = Parameters<typeof feature>[0]
const world = worldJson as unknown as Topo
const land = feature(world, world.objects.land as never)
const borders = mesh(world, world.objects.countries as never, (a, b) => a !== b)
const graticule = geoGraticule10()

// Deterministic starfield (normalised coordinates).
const STARS = Array.from({ length: 150 }, (_, i) => {
  const a = Math.sin(i * 12.9898) * 43758.5453
  const b = Math.sin(i * 78.233) * 12543.1234
  const c = Math.sin(i * 39.425) * 9871.3141
  const f = (n: number) => n - Math.floor(n)
  return { x: f(a), y: f(b), r: 0.4 + f(c) * 1.1, o: 0.15 + f(a + b) * 0.5, p: f(c * 3) * 6.28 }
})

export interface LatLon {
  lat: number
  lon: number
}

interface Props {
  pins: GlobePin[]
  me?: string
  draft?: LatLon | null
  picking: boolean
  focus?: (LatLon & { key: number }) | null
  selected?: string | null
  autoRotate?: boolean
  onPick: (p: LatLon) => void
  onSelect: (user: string | null) => void
}

interface Hit {
  user: string
  x: number
  y: number
  r: number
}

function pinRadius(p: GlobePin): number {
  const bal = p.usdc !== undefined ? Number(p.usdc) / 1e6 : 0
  return 4 + Math.min(9, Math.log10(1 + bal) * 1.8)
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

export function Globe({ pins, me, draft, picking, focus, selected, autoRotate = true, onPick, onSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Latest props, read by the render loop without re-subscribing.
  const live = useRef({ pins, me, draft, picking, selected, autoRotate })
  useEffect(() => {
    live.current = { pins, me, draft, picking, selected, autoRotate }
  })

  const rot = useRef({ lambda: -20, phi: -22 })
  const zoom = useRef(1)
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 })
  const [box, setBox] = useState({ w: 0, h: 0 })
  const hits = useRef<Hit[]>([])
  const drag = useRef<{ x: number; y: number; moved: number } | null>(null)
  const lastTouch = useRef(0)
  const anim = useRef<{ t0: number; from: [number, number]; to: [number, number] } | null>(null)
  const projection = useRef(geoOrthographic().clipAngle(90).precision(0.6))
  const [hover, setHover] = useState<{ pin: GlobePin; x: number; y: number } | null>(null)
  const [zoomUi, setZoomUi] = useState(1)

  const reduceMotion = useRef(false)
  useEffect(() => {
    reduceMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  // Fly to a requested location.
  useEffect(() => {
    if (!focus) return
    const from: [number, number] = [rot.current.lambda, rot.current.phi]
    let toL = -focus.lon
    while (toL - from[0] > 180) toL -= 360
    while (toL - from[0] < -180) toL += 360
    anim.current = {
      t0: performance.now(),
      from,
      to: [toL, clamp(-focus.lat, -80, 80)],
    }
    lastTouch.current = performance.now()
  }, [focus])

  // Resize handling.
  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = wrap.clientWidth
      const h = wrap.clientHeight
      sizeRef.current = { w, h, dpr }
      setBox({ w, h })
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [])

  // Wheel zoom (needs a non-passive listener).
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoom.current = clamp(zoom.current * (e.deltaY < 0 ? 1.08 : 0.92), 0.8, 2.6)
      setZoomUi(zoom.current)
      lastTouch.current = performance.now()
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  // Render loop.
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const loop = { id: 0 }
    const prev = { t: performance.now() }

    const frame = (now: number) => {
      const dt = Math.min(64, now - prev.t)
      prev.t = now
      const { w, h, dpr } = sizeRef.current
      if (w === 0 || h === 0) {
        loop.id = requestAnimationFrame(frame)
        return
      }
      const L = live.current

      // Camera updates.
      if (anim.current) {
        const a = anim.current
        const k = clamp((now - a.t0) / 1000, 0, 1)
        const e = 1 - Math.pow(1 - k, 3)
        rot.current.lambda = a.from[0] + (a.to[0] - a.from[0]) * e
        rot.current.phi = a.from[1] + (a.to[1] - a.from[1]) * e
        if (k >= 1) anim.current = null
      } else if (
        !drag.current &&
        !L.picking &&
        L.autoRotate &&
        !reduceMotion.current &&
        now - lastTouch.current > 2200
      ) {
        rot.current.lambda += dt * 0.006
      }

      const R = (Math.min(w, h) / 2) * 0.88 * zoom.current
      const cx = w / 2
      const cy = h / 2
      const proj = projection.current
        .translate([cx, cy])
        .scale(R)
        .rotate([rot.current.lambda, rot.current.phi, 0])
      const center: [number, number] = [-rot.current.lambda, -rot.current.phi]

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      // Stars.
      for (const st of STARS) {
        const tw = reduceMotion.current ? 1 : 0.7 + 0.3 * Math.sin(now / 900 + st.p)
        ctx.fillStyle = `rgba(226,236,250,${st.o * tw})`
        ctx.beginPath()
        ctx.arc(st.x * w, st.y * h, st.r, 0, Math.PI * 2)
        ctx.fill()
      }

      // Atmosphere glow.
      const glow = ctx.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.22)
      glow.addColorStop(0, 'rgba(172,198,233,0.22)')
      glow.addColorStop(1, 'rgba(172,198,233,0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(cx, cy, R * 1.22, 0, Math.PI * 2)
      ctx.fill()

      const path = geoPath(proj, ctx)

      // Ocean.
      const ocean = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R)
      ocean.addColorStop(0, '#1d3b5f')
      ocean.addColorStop(1, '#0a1626')
      ctx.beginPath()
      path({ type: 'Sphere' })
      ctx.fillStyle = ocean
      ctx.fill()

      // Graticule.
      ctx.beginPath()
      path(graticule)
      ctx.strokeStyle = 'rgba(172,198,233,0.07)'
      ctx.lineWidth = 0.6
      ctx.stroke()

      // Land.
      ctx.beginPath()
      path(land)
      ctx.fillStyle = 'rgba(172,198,233,0.2)'
      ctx.fill()
      ctx.beginPath()
      path(borders)
      ctx.strokeStyle = 'rgba(13,27,47,0.55)'
      ctx.lineWidth = 0.6
      ctx.stroke()
      ctx.beginPath()
      path(land)
      ctx.strokeStyle = 'rgba(203,219,242,0.38)'
      ctx.lineWidth = 0.8
      ctx.stroke()

      // Lighting: soft highlight top-left, shadow bottom-right.
      const shade = ctx.createRadialGradient(cx - R * 0.45, cy - R * 0.5, R * 0.05, cx, cy, R * 1.05)
      shade.addColorStop(0, 'rgba(203,219,242,0.10)')
      shade.addColorStop(0.55, 'rgba(0,0,0,0)')
      shade.addColorStop(1, 'rgba(3,8,18,0.5)')
      ctx.beginPath()
      path({ type: 'Sphere' })
      ctx.fillStyle = shade
      ctx.fill()

      // Limb.
      ctx.beginPath()
      path({ type: 'Sphere' })
      ctx.strokeStyle = 'rgba(203,219,242,0.28)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Pins.
      const nextHits: Hit[] = []
      const visible = (lat: number, lon: number) => geoDistance([lon, lat], center) < Math.PI / 2 - 0.02
      const meLower = L.me?.toLowerCase()

      L.pins.forEach((p, i) => {
        if (!visible(p.lat, p.lon)) return
        const pt = proj([p.lon, p.lat])
        if (!pt) return
        const [x, y] = pt
        const r = pinRadius(p)
        const isMe = meLower === p.user.toLowerCase()
        const isSel = L.selected === p.user

        if (!reduceMotion.current) {
          const phase = ((now / 1800 + (i * 0.37) % 1) % 1)
          ctx.beginPath()
          ctx.arc(x, y, r + phase * 14, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(172,198,233,${0.5 * (1 - phase)})`
          ctx.lineWidth = 1.2
          ctx.stroke()
        }

        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4)
        g.addColorStop(0, 'rgba(172,198,233,0.45)')
        g.addColorStop(1, 'rgba(172,198,233,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(x, y, r * 2.4, 0, Math.PI * 2)
        ctx.fill()

        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fillStyle = isMe ? '#f9faf3' : '#acc6e9'
        ctx.fill()
        ctx.lineWidth = isSel || isMe ? 2.4 : 1.4
        ctx.strokeStyle = isSel ? '#f9faf3' : '#0d1b2f'
        ctx.stroke()
        if (isSel) {
          ctx.beginPath()
          ctx.arc(x, y, r + 5, 0, Math.PI * 2)
          ctx.strokeStyle = 'rgba(249,250,243,0.9)'
          ctx.lineWidth = 1.2
          ctx.stroke()
        }
        if (zoom.current > 1.45 && p.city) {
          ctx.font = '500 11px "DM Sans", sans-serif'
          ctx.textBaseline = 'middle'
          ctx.lineWidth = 3
          ctx.strokeStyle = 'rgba(10,22,38,0.85)'
          ctx.strokeText(p.city, x + r + 6, y)
          ctx.fillStyle = '#e3ecf9'
          ctx.fillText(p.city, x + r + 6, y)
        }
        nextHits.push({ user: p.user, x, y, r: Math.max(r + 4, 12) })
      })
      hits.current = nextHits

      // Draft pin.
      if (L.draft && visible(L.draft.lat, L.draft.lon)) {
        const pt = proj([L.draft.lon, L.draft.lat])
        if (pt) {
          ctx.save()
          ctx.setLineDash([4, 3])
          ctx.beginPath()
          ctx.arc(pt[0], pt[1], 11, 0, Math.PI * 2)
          ctx.strokeStyle = '#f9faf3'
          ctx.lineWidth = 1.6
          ctx.stroke()
          ctx.restore()
          ctx.beginPath()
          ctx.arc(pt[0], pt[1], 3.5, 0, Math.PI * 2)
          ctx.fillStyle = '#f9faf3'
          ctx.fill()
        }
      }

      loop.id = requestAnimationFrame(frame)
    }
    loop.id = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(loop.id)
  }, [])

  const localPoint = (e: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const hitAt = (x: number, y: number): Hit | undefined => {
    let best: Hit | undefined
    let bestD = Infinity
    for (const h of hits.current) {
      const d = Math.hypot(h.x - x, h.y - y)
      if (d <= h.r && d < bestD) {
        best = h
        bestD = d
      }
    }
    return best
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const { x, y } = localPoint(e)
    drag.current = { x, y, moved: 0 }
    anim.current = null
    lastTouch.current = performance.now()
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = localPoint(e)
    const d = drag.current
    if (d) {
      const dx = x - d.x
      const dy = y - d.y
      d.moved += Math.abs(dx) + Math.abs(dy)
      d.x = x
      d.y = y
      const k = 0.28 / zoom.current
      rot.current.lambda += dx * k
      rot.current.phi = clamp(rot.current.phi - dy * k, -85, 85)
      lastTouch.current = performance.now()
      if (d.moved > 5) setHover(null)
      return
    }
    const h = hitAt(x, y)
    if (h) {
      const pin = live.current.pins.find((p) => p.user === h.user)
      if (pin) {
        setHover({ pin, x, y })
        return
      }
    }
    setHover(null)
  }

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current
    drag.current = null
    if (!d || d.moved > 6) return
    const { x, y } = localPoint(e)
    const h = hitAt(x, y)
    if (h) {
      onSelect(h.user)
      return
    }
    if (live.current.picking) {
      const inv = projection.current.invert?.([x, y])
      if (inv) {
        const [lon, lat] = inv
        const center: [number, number] = [-rot.current.lambda, -rot.current.phi]
        if (geoDistance([lon, lat], center) < Math.PI / 2 - 0.01) {
          onPick({ lat: Math.round(lat), lon: Math.round(lon) })
          return
        }
      }
    }
    onSelect(null)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const step = 8 / zoom.current
    if (e.key === 'ArrowLeft') rot.current.lambda += step
    else if (e.key === 'ArrowRight') rot.current.lambda -= step
    else if (e.key === 'ArrowUp') rot.current.phi = clamp(rot.current.phi + step, -85, 85)
    else if (e.key === 'ArrowDown') rot.current.phi = clamp(rot.current.phi - step, -85, 85)
    else return
    e.preventDefault()
    lastTouch.current = performance.now()
  }

  const bump = useCallback((f: number) => {
    zoom.current = clamp(zoom.current * f, 0.8, 2.6)
    setZoomUi(zoom.current)
    lastTouch.current = performance.now()
  }, [])

  const cursor = picking ? 'crosshair' : hover ? 'pointer' : 'grab'

  return (
    <div ref={wrapRef} className="relative h-full w-full select-none">
      <canvas
        ref={canvasRef}
        tabIndex={0}
        role="img"
        aria-label="Interactive globe of Arc wallets that opted in to share a coarse location. Drag to rotate, scroll to zoom, arrow keys to turn."
        className="absolute inset-0 h-full w-full touch-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null
        }}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKeyDown}
      />

      {hover && (
        <div
          className="pointer-events-none absolute z-10 min-w-[150px] rounded-xl border border-[var(--border)] bg-[#0d1b2f]/90 px-3 py-2 text-xs shadow-lg backdrop-blur"
          style={{
            left: clamp(hover.x + 14, 8, Math.max(8, box.w - 170)),
            top: clamp(hover.y + 14, 8, Math.max(8, box.h - 70)),
          }}
        >
          <div className="display text-sm font-semibold text-[var(--ink)]">{hover.pin.city || 'Pinned location'}</div>
          <div className="mono mt-0.5 text-[11px] text-[var(--subtle)]">{shortAddress(hover.pin.user)}</div>
          <div className="mt-1 tabular-nums text-[var(--muted)]">
            {hover.pin.usdc !== undefined ? `${formatUsdcCompact(hover.pin.usdc)} USDC` : 'Loading balance'}
          </div>
        </div>
      )}

      <div className="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[#0d1b2f]/70 backdrop-blur">
        <button
          type="button"
          aria-label="Zoom in"
          disabled={zoomUi >= 2.6}
          onClick={() => bump(1.25)}
          className="flex h-11 w-11 items-center justify-center text-[var(--ink-2)] transition hover:bg-white/10 disabled:opacity-40"
        >
          <Plus size={18} />
        </button>
        <div className="h-px bg-[var(--border)]" />
        <button
          type="button"
          aria-label="Zoom out"
          disabled={zoomUi <= 0.8}
          onClick={() => bump(0.8)}
          className="flex h-11 w-11 items-center justify-center text-[var(--ink-2)] transition hover:bg-white/10 disabled:opacity-40"
        >
          <Minus size={18} />
        </button>
      </div>

      {picking && (
        <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-[var(--border-strong)] bg-[#0d1b2f]/85 px-4 py-2 text-xs font-medium text-[var(--ink)] backdrop-blur">
          Click the globe to drop your pin
        </div>
      )}
    </div>
  )
}
