import { type NextRequest, NextResponse } from "next/server"
import type { Bin } from "@/lib/bins"

// Mirror endpoints — we fall back through them if one is busy/down.
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

// Overpass rejects/rate-limits requests without a descriptive User-Agent.
const USER_AGENT = "BinGO/1.0 (nearest recycling & trash finder)"

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
    [out:json][timeout:25];
    (
      nwr(around:${radius},${lat},${lng})["amenity"="waste_basket"];
      nwr(around:${radius},${lat},${lng})["amenity"="recycling"];
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

  let detail: string | undefined
  if (isRecycling) {
    const materials = Object.keys(tags)
      .filter((k) => k.startsWith("recycling:") && tags[k] === "yes")
      .map((k) => k.replace("recycling:", "").replace(/_/g, " "))
    if (materials.length) detail = materials.slice(0, 4).join(", ")
    else if (tags.recycling_type) detail = `${tags.recycling_type} point`
  }

  return {
    id: `${el.type}/${el.id}`,
    type: isRecycling ? "recycling" : "trash",
    lat,
    lng,
    name: tags.name || (isRecycling ? "Recycling point" : "Trash can"),
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

  let lastError = "Unknown error"
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
        },
        body,
        // Overpass data changes slowly; cache briefly to be a good citizen.
        next: { revalidate: 300 },
      })
      if (!res.ok) {
        lastError = `Overpass responded ${res.status}`
        continue
      }
      const data = (await res.json()) as { elements?: OverpassElement[] }
      const bins = (data.elements ?? [])
        .map(normalize)
        .filter((b): b is Bin => b !== null)
      return NextResponse.json({ bins })
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Fetch failed"
    }
  }

  return NextResponse.json({ error: `Could not reach OpenStreetMap: ${lastError}` }, { status: 502 })
}
