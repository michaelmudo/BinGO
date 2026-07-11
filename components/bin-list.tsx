"use client"

import { Navigation, Recycle, Trash2, X } from "lucide-react"
import type { Bin } from "@/lib/bins"
import { formatDistance } from "@/lib/bins"
import { cn } from "@/lib/utils"

interface BinListProps {
  bins: Bin[]
  bearings: Record<string, string>
  onSelect: (bin: Bin) => void
  selectedId?: string
  onDeleteCommunityBin?: (bin: Bin) => void
}

export function BinList({
  bins,
  bearings,
  onSelect,
  selectedId,
  onDeleteCommunityBin,
}: BinListProps) {
  if (bins.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
        <Trash2 className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">No bins found nearby</p>
        <p className="text-xs text-muted-foreground text-balance">
          Try widening the search radius or switching the filter.
        </p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {bins.map((bin) => {
        const isRecycle = bin.type === "recycling"
        const isCommunity = bin.source === "community"
        return (
          <li key={bin.id}>
            <div
              className={cn(
                "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent",
                selectedId === bin.id && "bg-accent",
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(bin)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full",
                    isRecycle
                      ? "bg-recycle/15 text-recycle"
                      : "bg-trash/15 text-trash",
                  )}
                >
                  {isRecycle ? <Recycle className="size-5" /> : <Trash2 className="size-5" />}
                </span>

                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{bin.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {isRecycle ? "Recycling" : "Trash"}
                    {isCommunity ? " - Community" : ""}
                    {bin.detail ? ` - ${bin.detail}` : ""}
                  </span>
                </span>

                <span className="flex shrink-0 flex-col items-end">
                  <span className="text-sm font-semibold tabular-nums">
                    {bin.distance != null ? formatDistance(bin.distance) : "--"}
                  </span>
                  <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                    <Navigation className="size-3" />
                    {bearings[bin.id] ?? ""}
                  </span>
                </span>
              </button>

              {isCommunity && onDeleteCommunityBin && (
                <button
                  type="button"
                  onClick={() => onDeleteCommunityBin(bin)}
                  aria-label="Remove community bin"
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-destructive"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
