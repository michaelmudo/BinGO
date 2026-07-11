export type BinType = "recycling" | "trash"

export interface Bin {
  id: string
  type: BinType
  lat: number
  lng: number
  name: string
  source?: "osm" | "community"
  createdAt?: string
  /** Extra descriptor, e.g. recycling material or vending type */
  detail?: string
  /** Straight-line distance from the user in meters, filled in client-side */
  distance?: number
}

const EARTH_RADIUS_M = 6371000

/** Haversine great-circle distance in meters. */
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a))
}

/** Human-friendly distance string. */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]

/** Compass heading from user -> bin. */
export function bearing(lat1: number, lng1: number, lat2: number, lng2: number): string {
  const toRad = (d: number) => (d * Math.PI) / 180
  const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2))
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1))
  const deg = (Math.atan2(y, x) * 180) / Math.PI
  return COMPASS[Math.round(((deg + 360) % 360) / 45) % 8]
}
