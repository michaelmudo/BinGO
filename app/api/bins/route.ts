import { type NextRequest, NextResponse } from "next/server"
import type { Bin } from "@/lib/bins"

// Mirror endpoints - we race all of them and take the first success.
const OVERPASS_ENDPOINTS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
]

// Hard cap per mirror so a single slow server can't stall the whole request.
const REQUEST_TIMEOUT_MS = 12_000

// Overpass rejects/rate-limits requests without a descriptive User-Agent.
const USER_AGENT = "BinGO/1.0 (nearest bins and water finder)"

interface OverpassElement {
  type: "node" | "way" | "relation"
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

function buildQuery(lat: number, lng: number, radius: number): string {
  return `
    [out:json][timeout:10];
    (
      nwr(around:${radius},${lat},${lng})["amenity"="waste_basket"];
      nwr(around:${radius},${lat},${lng})["amenity"="recycling"];
      nwr(around:${radius},${lat},${lng})["amenity"="drinking_water"];
      nwr(around:${radius},${lat},${lng})["man_made"="water_tap"];
    );
    out center tags;
  `
}

function normalize(el: OverpassElement): Bin | null {
  const lat = el.lat ?? el.center?.lat
  const lng = el.lon ?? el.center?.lon
  if (lat == null || lng == null) return null

  const tags = el.tags ?? {}
  const isRecycling = tags.amenity === "recycling"
  const isWater = tags.amenity === "drinking_water" || tags.man_made === "water_tap"

  let detail: string | undefined
  if (isRecycling) {
    const materials = Object.keys(tags)
      .filter((k) => k.startsWith("recycling:") && tags[k] === "yes")
      .map((k) => k.replace("recycling:", "").replace(/_/g, " "))
    if (materials.length) detail = materials.slice(0, 4).join(", ")
    else if (tags.recycling_type) detail = `${tags.recycling_type} point`
  } else if (isWater) {
    if (tags.bottle === "yes") detail = "Bottle refill"
    else if (tags.fountain === "yes") detail = "Fountain"
  }

  return {
    id: `${el.type}/${el.id}`,
    type: isWater ? "water" : isRecycling ? "recycling" : "trash",
    lat,
    lng,
    name: tags.name || (isWater ? "Water fountain" : isRecycling ? "Recycling point" : "Trash can"),
    source: "osm",
    detail,
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lat = Number.parseFloat(searchParams.get("lat") ?? "")
  const lng = Number.parseFloat(searchParams.get("lng") ?? "")
  const radius = Math.min(Number.parseInt(searchParams.get("radius") ?? "1500", 10) || 1500, 5000)

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: "Missing or invalid lat/lng" }, { status: 400 })
  }

  const body = `data=${encodeURIComponent(buildQuery(lat, lng, radius))}`

  async function queryMirror(endpoint: string): Promise<OverpassElement[]> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
        },
        body,
        signal: controller.signal,
        // Overpass data changes slowly; cache briefly to be a good citizen.
        next: { revalidate: 300 },
      })
      if (!res.ok) throw new Error(`${endpoint} responded ${res.status}`)
      const data = (await res.json()) as { elements?: OverpassElement[] }
      return data.elements ?? []
    } finally {
      clearTimeout(timer)
    }
  }

  try {
    // Race every mirror; the first one to succeed wins. Promise.any ignores
    // rejections and only throws if ALL mirrors fail.
    const elements = await Promise.any(OVERPASS_ENDPOINTS.map(queryMirror))
    const bins = elements.map(normalize).filter((b): b is Bin => b !== null)
    return NextResponse.json({ bins })
  } catch (err) {
    const detail =
      err instanceof AggregateError
        ? (err.errors[0] as Error)?.message ?? "all mirrors failed"
        : err instanceof Error
          ? err.message
          : "unknown error"
    return NextResponse.json(
      { error: `Could not reach OpenStreetMap: ${detail}` },
      { status: 502 },
    )
  }
}
