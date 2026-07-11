"use client"

import { useEffect } from "react"
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import type { Bin } from "@/lib/bins"
import { formatDistance } from "@/lib/bins"

function pinIcon(color: string, pulse = false) {
  return L.divIcon({
    className: "",
    html: `<span style="
      display:flex;align-items:center;justify-content:center;
      width:26px;height:26px;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      background:${color};
      border:2px solid rgba(255,255,255,0.9);
      box-shadow:0 2px 6px rgba(0,0,0,0.35);
      ${pulse ? "animation:binpulse 1.6s ease-out infinite;" : ""}
    "></span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -24],
  })
}

function userIcon() {
  return L.divIcon({
    className: "",
    html: `<span style="
      display:block;width:18px;height:18px;border-radius:50%;
      background:#2563eb;border:3px solid #fff;
      box-shadow:0 0 0 4px rgba(37,99,235,0.3);
    "></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng])
  }, [lat, lng, map])
  return null
}

function FlyTo({ target }: { target: { lat: number; lng: number; key: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 18, { duration: 0.8 })
  }, [target, map])
  return null
}

interface BinMapProps {
  userLat: number
  userLng: number
  radius: number
  bins: Bin[]
  focus: { lat: number; lng: number; key: number } | null
}

const RECYCLE = "oklch(0.55 0.13 155)"
const TRASH = "oklch(0.62 0.16 55)"

export default function BinMap({ userLat, userLng, radius, bins, focus }: BinMapProps) {
  return (
    <MapContainer
      center={[userLat, userLng]}
      zoom={16}
      scrollWheelZoom
      className="h-full w-full"
      style={{ background: "var(--muted)" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter lat={userLat} lng={userLng} />
      <FlyTo target={focus} />

      <Circle
        center={[userLat, userLng]}
        radius={radius}
        pathOptions={{ color: "#2563eb", weight: 1, fillColor: "#2563eb", fillOpacity: 0.05 }}
      />
      <Marker position={[userLat, userLng]} icon={userIcon()}>
        <Popup>You are here</Popup>
      </Marker>

      {bins.map((bin) => (
        <Marker
          key={bin.id}
          position={[bin.lat, bin.lng]}
          icon={pinIcon(bin.type === "recycling" ? RECYCLE : TRASH, bin.source === "community")}
        >
          <Popup>
            <span className="font-semibold">{bin.name}</span>
            <br />
            {bin.type === "recycling" ? "Recycling" : "Trash"}
            {bin.source === "community" && " - Community"}
            {bin.distance != null && <> - {formatDistance(bin.distance)} away</>}
            {bin.detail && (
              <>
                <br />
                <span style={{ opacity: 0.7 }}>{bin.detail}</span>
              </>
            )}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
