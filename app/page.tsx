import { Leaf } from "lucide-react"
import { BinFinder } from "@/components/bin-finder"
import { SortAdvisor } from "@/components/sort-advisor"

export default function Page() {
  return (
    <main className="flex h-dvh flex-col bg-background">
      <header className="flex shrink-0 items-center gap-2.5 border-b px-4 py-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Leaf className="size-4" />
        </span>
        <div className="flex flex-col leading-tight">
          <h1 className="text-sm font-bold tracking-tight">BinGO</h1>
          <p className="text-xs text-muted-foreground">Bins, recycling &amp; water</p>
        </div>
      </header>
      <SortAdvisor />
      <BinFinder />
    </main>
  )
}
