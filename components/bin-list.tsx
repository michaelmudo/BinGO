"use client"

import { Recycle, Trash2, Navigation } from "lucide-react"
import type { Bin } from "@/lib/bins"
import { formatDistance } from "@/lib/bins"
import { cn } from "@/lib/utils"

interface BinListProps {
  bins: Bin[]
  bearings: Record<string, string>
  onSelect: (bin: Bin) => void
  selectedId?: string
}

export function BinList({ bins, bearings, onSelect, selectedId }: BinListProps) {
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
        return (
          <li key={bin.id}>
            <button
              type="button"
              onClick={() => onSelect(bin)}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent",
                selectedId === bin.id && "bg-accent",
              )}
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
                  {bin.detail ? ` · ${bin.detail}` : ""}
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
          </li>
        )
      })}
    </ul>
  )
}
