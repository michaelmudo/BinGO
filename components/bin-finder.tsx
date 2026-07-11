"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { Recycle, Trash2, MapPin, LocateFixed, RefreshCw, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BinList } from "@/components/bin-list"
import { type Bin, type BinType, haversine, bearing, formatDistance } from "@/lib/bins"
import { cn } from "@/lib/utils"

const BinMap = dynamic(() => import("@/components/bin-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <RefreshCw className="size-5 animate-spin text-muted-foreground" />
    </div>
  ),
})

type Filter = "both" | "recycling" | "trash"
type Coords = { lat: number; lng: number }

const RADIUS_OPTIONS = [500, 1000, 1500, 3000]

// A few bin-dense spots so the app is testable when the browser blocks
// geolocation (common inside preview iframes) or has no bins mapped nearby.
const DEMO_LOCATIONS: { label: string; lat: number; lng: number }[] = [
  { label: "London", lat: 51.5115, lng: -0.1235 },
  { label: "Amsterdam", lat: 52.3676, lng: 4.9041 },
  { label: "Berlin", lat: 52.52, lng: 13.405 },
]

export function BinFinder() {
  const [coords, setCoords] = useState<Coords | null>(null)
  const [status, setStatus] = useState<"idle" | "locating" | "loading" | "ready" | "error">("idle")
  const [error, setError] = useState<string | null>(null)
  const [bins, setBins] = useState<Bin[]>([])
  const [filter, setFilter] = useState<Filter>("both")
  const [radius, setRadius] = useState(1500)
  const [focus, setFocus] = useState<{ lat: number; lng: number; key: number } | null>(null)
  const [selectedId, setSelectedId] = useState<string>()

  const useDemoLocation = useCallback((loc: { lat: number; lng: number }) => {
    setError(null)
    setCoords({ lat: loc.lat, lng: loc.lng })
  }, [])

  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setStatus("error")
      setError("Geolocation isn't supported here. Try a demo location below.")
      return
    }
    setStatus("locating")
    setError(null)

    // Watchdog: some environments (e.g. preview iframes) block geolocation and
    // never fire either callback, leaving us stuck on "Locating you…". Bail out
    // with a helpful message if nothing has resolved in time.
    let settled = false
    const watchdog = setTimeout(() => {
      if (settled) return
      settled = true
      setStatus("error")
      setError(
        "Couldn't get your location (it may be blocked in this preview). Open the published app, or try a demo location below.",
      )
    }, 12000)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (settled) return
        settled = true
        clearTimeout(watchdog)
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      (err) => {
        if (settled) return
        settled = true
        clearTimeout(watchdog)
        setStatus("error")
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Enable it and retry, or try a demo location below."
            : "Could not determine your location. Retry, or try a demo location below.",
        )
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    )
  }, [])

  const fetchBins = useCallback(async (c: Coords, r: number) => {
    setStatus("loading")
    setError(null)
    try {
      const res = await fetch(`/api/bins?lat=${c.lat}&lng=${c.lng}&radius=${r}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to load bins")
      setBins(data.bins as Bin[])
      setStatus("ready")
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Something went wrong")
    }
  }, [])

  useEffect(() => {
    if (coords) fetchBins(coords, radius)
  }, [coords, radius, fetchBins])

  // Enrich bins with distance + bearing, sorted nearest-first.
  const enriched = useMemo(() => {
    if (!coords) return []
    return bins
      .map((b) => ({ ...b, distance: haversine(coords.lat, coords.lng, b.lat, b.lng) }))
      .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
  }, [bins, coords])

  const bearings = useMemo(() => {
    if (!coords) return {}
    const map: Record<string, string> = {}
    for (const b of enriched) map[b.id] = bearing(coords.lat, coords.lng, b.lat, b.lng)
    return map
  }, [enriched, coords])

  const filtered = useMemo(
    () => (filter === "both" ? enriched : enriched.filter((b) => b.type === filter)),
    [enriched, filter],
  )

  const nearest = useCallback(
    (type: BinType) => enriched.find((b) => b.type === type),
    [enriched],
  )

  const handleSelect = useCallback((bin: Bin) => {
    setSelectedId(bin.id)
    setFocus({ lat: bin.lat, lng: bin.lng, key: Date.now() })
  }, [])

  const counts = useMemo(
    () => ({
      recycling: enriched.filter((b) => b.type === "recycling").length,
      trash: enriched.filter((b) => b.type === "trash").length,
    }),
    [enriched],
  )

  // Landing state
  if (status === "idle") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
        <div className="flex items-center justify-center gap-3">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-recycle/15 text-recycle">
            <Recycle className="size-7" />
          </span>
          <span className="flex size-14 items-center justify-center rounded-2xl bg-trash/15 text-trash">
            <Trash2 className="size-7" />
          </span>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-balance">
            Find the nearest bin, fast
          </h2>
          <p className="max-w-sm text-sm text-muted-foreground text-pretty">
            Share your location and we&apos;ll scan OpenStreetMap for the closest recycling points
            and trash cans around you.
          </p>
        </div>
        <Button size="lg" onClick={requestLocation} className="gap-2">
          <LocateFixed className="size-4" />
          Use my location
        </Button>
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs text-muted-foreground">Or try a demo location</span>
          <div className="flex flex-wrap justify-center gap-2">
            {DEMO_LOCATIONS.map((loc) => (
              <Button
                key={loc.label}
                variant="outline"
                size="sm"
                onClick={() => useDemoLocation(loc)}
                className="gap-1.5"
              >
                <MapPin className="size-3.5" />
                {loc.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
      {/* Map */}
      <div className="relative h-64 shrink-0 sm:h-80 lg:h-auto lg:flex-1">
        {coords ? (
          <BinMap
            userLat={coords.lat}
            userLng={coords.lng}
            radius={radius}
            bins={filtered}
            focus={focus}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-muted px-6 text-center">
            {status === "error" ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TriangleAlert className="size-4" />
                Location unavailable — pick a demo location.
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="size-4 animate-spin" />
                Locating you…
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sidebar */}
      <aside className="flex min-h-0 flex-1 flex-col border-t bg-card lg:max-w-md lg:border-l lg:border-t-0">
        {/* Nearest summary */}
        <div className="grid grid-cols-2 gap-3 p-4">
          <NearestCard bin={nearest("recycling")} type="recycling" onClick={handleSelect} />
          <NearestCard bin={nearest("trash")} type="trash" onClick={handleSelect} />
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-3 border-t px-4 py-3">
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {(
              [
                { key: "both", label: "All" },
                { key: "recycling", label: `Recycling (${counts.recycling})` },
                { key: "trash", label: `Trash (${counts.trash})` },
              ] as { key: Filter; label: string }[]
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setFilter(opt.key)}
                className={cn(
                  "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                  filter === opt.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3.5" />
              Within
            </div>
            <div className="flex gap-1">
              {RADIUS_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRadius(r)}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                    radius === r
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {formatDistance(r)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error */}
        {status === "error" && (
          <div className="flex items-start gap-2 border-t bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <div className="flex-1">
              <p>{error}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={requestLocation} className="gap-1.5">
                  <RefreshCw className="size-3.5" />
                  Retry
                </Button>
                {DEMO_LOCATIONS.map((loc) => (
                  <Button
                    key={loc.label}
                    variant="outline"
                    size="sm"
                    onClick={() => useDemoLocation(loc)}
                    className="gap-1.5"
                  >
                    <MapPin className="size-3.5" />
                    {loc.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* List */}
        <div className="min-h-0 flex-1 overflow-y-auto border-t">
          {status === "loading" ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <RefreshCw className="size-4 animate-spin" />
              Scanning nearby…
            </div>
          ) : (
            <BinList
              bins={filtered}
              bearings={bearings}
              onSelect={handleSelect}
              selectedId={selectedId}
            />
          )}
        </div>
      </aside>
    </div>
  )
}

function NearestCard({
  bin,
  type,
  onClick,
}: {
  bin?: Bin
  type: BinType
  onClick: (bin: Bin) => void
}) {
  const isRecycle = type === "recycling"
  return (
    <button
      type="button"
      disabled={!bin}
      onClick={() => bin && onClick(bin)}
      className={cn(
        "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors disabled:opacity-50",
        bin && "hover:bg-accent",
      )}
    >
      <span
        className={cn(
          "flex items-center gap-1.5 text-xs font-medium",
          isRecycle ? "text-recycle" : "text-trash",
        )}
      >
        {isRecycle ? <Recycle className="size-3.5" /> : <Trash2 className="size-3.5" />}
        Nearest {isRecycle ? "recycling" : "trash"}
      </span>
      <span className="text-lg font-bold tabular-nums">
        {bin?.distance != null ? formatDistance(bin.distance) : "—"}
      </span>
      <span className="truncate text-xs text-muted-foreground">
        {bin ? bin.name : "None in range"}
      </span>
    </button>
  )
}
