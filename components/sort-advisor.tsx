"use client"

import { ClipboardEvent, FormEvent, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  LoaderCircle,
  Recycle,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type DisposalDecision = "recycle" | "trash" | "compost" | "special" | "uncertain"

interface SortResult {
  decision: DisposalDecision
  confidence: "low" | "medium" | "high"
  title: string
  explanation: string
  prepSteps: string[]
  localNote: string
  identifiedItem?: string
  visibleText?: string
}

const DECISION_STYLES: Record<
  DisposalDecision,
  { label: string; className: string; icon: typeof Recycle }
> = {
  recycle: {
    label: "Recycle",
    className: "border-recycle/30 bg-recycle/10 text-recycle",
    icon: Recycle,
  },
  trash: {
    label: "Trash",
    className: "border-trash/30 bg-trash/10 text-trash",
    icon: Trash2,
  },
  compost: {
    label: "Compost",
    className: "border-primary/30 bg-primary/10 text-primary",
    icon: CheckCircle2,
  },
  special: {
    label: "Special drop-off",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
    icon: AlertTriangle,
  },
  uncertain: {
    label: "Check locally",
    className: "border-muted-foreground/30 bg-muted text-muted-foreground",
    icon: AlertTriangle,
  },
}

export function SortAdvisor() {
  const [isOpen, setIsOpen] = useState(false)
  const [item, setItem] = useState("")
  const [location, setLocation] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [result, setResult] = useState<SortResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const canSubmit = (item.trim().length > 2 || imageFile) && !isLoading
  const decision = useMemo(
    () => (result ? DECISION_STYLES[result.decision] : null),
    [result],
  )

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null)
      return
    }

    const url = URL.createObjectURL(imageFile)
    setImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return

    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const requestBody = imageFile ? new FormData() : JSON.stringify({ item, location })
      if (imageFile && requestBody instanceof FormData) {
        requestBody.append("item", item)
        requestBody.append("location", location)
        requestBody.append("image", imageFile)
      }

      const res = await fetch("/api/sort-item", {
        method: "POST",
        headers: imageFile ? undefined : { "Content-Type": "application/json" },
        body: requestBody,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Could not sort that item.")
      setResult(data.result as SortResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sort that item.")
    } finally {
      setIsLoading(false)
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLElement>) {
    const pastedImage = Array.from(event.clipboardData.items)
      .find((item) => item.type.startsWith("image/"))
      ?.getAsFile()

    if (!pastedImage) return
    event.preventDefault()
    setImageFile(pastedImage)
    setError(null)
    setResult(null)
  }

  return (
    <section className="border-b bg-card">
      <div
        className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-3"
        onPaste={isOpen ? handlePaste : undefined}
      >
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            className="flex min-w-0 items-center gap-2 text-left"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">Recycle or trash?</span>
              <span className="block truncate text-xs text-muted-foreground">
                Ask AI where an item should go.
              </span>
            </span>
          </button>
          <Button variant="outline" size="sm" onClick={() => setIsOpen((open) => !open)}>
            {isOpen ? "Hide" : "Ask"}
          </Button>
        </div>

        {isOpen && (
          <form onSubmit={handleSubmit} className="grid gap-3 lg:grid-cols-[1fr_14rem_auto]">
            <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium">
              Item or note
              <input
                value={item}
                onChange={(event) => setItem(event.target.value)}
                placeholder="Optional if using a photo"
                className="h-9 rounded-md border bg-background px-3 text-sm font-normal outline-none transition-shadow focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium">
              City
              <input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Optional"
                className="h-9 rounded-md border bg-background px-3 text-sm font-normal outline-none transition-shadow focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>
            <Button type="submit" disabled={!canSubmit} className="gap-2 self-end">
              {isLoading ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
              Ask AI
            </Button>
          </form>
        )}

        {isOpen && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted">
              <Camera className="size-4" />
              Take or upload photo
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <span className="text-xs text-muted-foreground">You can also paste an image with Ctrl+V.</span>

            {imagePreview && (
              <div className="flex min-w-0 items-center gap-3 rounded-lg border bg-background p-2">
                <img
                  src={imagePreview}
                  alt="Selected item"
                  className="size-14 shrink-0 rounded-md object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{imageFile?.name}</div>
                  <div className="text-xs text-muted-foreground">Photo will be sent to Gemini.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setImageFile(null)}
                  aria-label="Remove photo"
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {isOpen && (error || (result && decision)) && (
          <div className="rounded-lg border bg-background p-3">
            {error ? (
              <div className="flex items-start gap-2 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : result && decision ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">{result.title}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{result.explanation}</p>
                    {(result.identifiedItem || result.visibleText) && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Saw: {[result.identifiedItem, result.visibleText && `"${result.visibleText}"`]
                          .filter(Boolean)
                          .join(" - ")}
                      </p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold",
                      decision.className,
                    )}
                  >
                    <decision.icon className="size-3.5" />
                    {decision.label}
                  </span>
                </div>

                {result.prepSteps.length > 0 && (
                  <div className="grid gap-1 text-xs">
                    {result.prepSteps.map((step) => (
                      <div key={step} className="flex gap-1.5 text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  {result.localNote} Confidence: {result.confidence}.
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  )
}
