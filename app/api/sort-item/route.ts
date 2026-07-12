import { type NextRequest, NextResponse } from "next/server"

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

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions"
const MODEL = "gemini-3.5-flash"
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const RESULT_SCHEMA = {
  type: "object",
  properties: {
    decision: {
      type: "string",
      enum: ["recycle", "trash", "compost", "special", "uncertain"],
      description: "The best practical disposal route for the item.",
    },
    confidence: {
      type: "string",
      enum: ["low", "medium", "high"],
      description: "How confident the assistant is in the recommendation.",
    },
    title: {
      type: "string",
      description: "Short user-facing recommendation.",
    },
    explanation: {
      type: "string",
      description: "One or two sentence explanation.",
    },
    prepSteps: {
      type: "array",
      items: { type: "string" },
      description: "Short actions like rinse, empty, remove cap, or bag separately.",
    },
    localNote: {
      type: "string",
      description: "Brief note about local rules when relevant.",
    },
    identifiedItem: {
      type: "string",
      description: "What the model sees or infers the item to be, especially for photos.",
    },
    visibleText: {
      type: "string",
      description: "Important readable label text from the photo, if any.",
    },
  },
  required: [
    "decision",
    "confidence",
    "title",
    "explanation",
    "prepSteps",
    "localNote",
    "identifiedItem",
    "visibleText",
  ],
}

function fallbackResult(item: string): SortResult {
  return {
    decision: "uncertain",
    confidence: "low",
    title: `Check local guidance for ${item}`,
    explanation:
      "Recycling rules vary by city, and the item description was not enough to make a confident call.",
    prepSteps: ["Look for a recycling symbol or material label.", "Check your local waste program."],
    localNote: "When in doubt, keep contaminated or unknown items out of recycling.",
    identifiedItem: item,
    visibleText: "",
  }
}

function normalizeResult(result: SortResult): SortResult {
  const searchable = [
    result.identifiedItem,
    result.visibleText,
    result.title,
    result.explanation,
    result.prepSteps.join(" "),
  ]
    .join(" ")
    .toLowerCase()

  if (/\b(battery|batteries|alkaline|lithium|lr6|aa battery|aaa battery|1\.5v)\b/.test(searchable)) {
    return {
      ...result,
      decision: "special",
      confidence: result.confidence === "low" ? "medium" : result.confidence,
      title: "Use a battery drop-off",
      explanation:
        "Batteries should not go in curbside recycling or loose household trash because they need special handling.",
      prepSteps: ["Tape the terminals if your local program recommends it.", "Bring it to a battery drop-off or household hazardous waste site."],
      localNote: "Some stores, libraries, and municipal programs collect household batteries.",
    }
  }

  return result
}

function ruleBasedResult(item: string): SortResult | null {
  const text = item.toLowerCase()
  const dirty = /\b(greasy|grease|food|sauce|oily|oil|dirty|soiled|wet|liquid|residue|moldy)\b/.test(
    text,
  )

  if (/\b(battery|batteries|paint|chemical|motor oil|propane|medicine|medication|needle|sharps?|electronics?|phone|laptop|bulb|fluorescent)\b/.test(text)) {
    return {
      decision: "special",
      confidence: "high",
      title: "Use a special drop-off",
      explanation:
        "This item should not go in regular trash or curbside recycling because it can be hazardous or needs special handling.",
      prepSteps: ["Keep it separate from household bins.", "Bring it to a local drop-off site."],
      localNote: "Drop-off rules vary, so check your city or hauler for the closest accepted site.",
    }
  }

  if (/\b(pizza box|paper towel|napkin|tissue|paper plate)\b/.test(text) && dirty) {
    return {
      decision: "trash",
      confidence: "high",
      title: "Trash it",
      explanation:
        "Food, grease, and wet organic residue usually contaminate paper recycling.",
      prepSteps: ["Keep it out of the recycling bin.", "Compost only if your local program accepts food-soiled paper."],
      localNote: "Some cities compost food-soiled paper, but most curbside recycling programs do not want it.",
    }
  }

  if (/\b(plastic|cup|container|bottle|tub|takeout)\b/.test(text) && dirty) {
    return {
      decision: "trash",
      confidence: "high",
      title: "Trash it unless you can clean it",
      explanation:
        "Food, liquid, and heavy residue can contaminate recycling, especially on plastic containers.",
      prepSteps: ["Empty it completely.", "Recycle only if it can be rinsed clean and your program accepts that plastic."],
      localNote: "Accepted plastic shapes and numbers vary by city, but dirty plastic should stay out of recycling.",
    }
  }

  if (/\b(aluminum can|soda can|tin can|steel can|empty can)\b/.test(text) && !dirty) {
    return {
      decision: "recycle",
      confidence: "high",
      title: "Recycle it",
      explanation: "Clean, empty metal cans are widely accepted in curbside recycling.",
      prepSteps: ["Empty it.", "Give it a quick rinse if sticky or smelly."],
      localNote: "Most programs accept metal cans, but local rules still win.",
    }
  }

  if (/\b(cardboard|box|paper|newspaper|magazine|mail)\b/.test(text) && !dirty) {
    return {
      decision: "recycle",
      confidence: "medium",
      title: "Recycle it if clean and dry",
      explanation: "Clean, dry paper and cardboard are usually recyclable.",
      prepSteps: ["Remove food, plastic liners, or heavy tape.", "Flatten boxes when possible."],
      localNote: "Waxed, laminated, or food-soiled paper may not be accepted.",
    }
  }

  if (/\b(plastic bag|shopping bag|film|wrapper|chip bag|snack bag)\b/.test(text)) {
    return {
      decision: "trash",
      confidence: "medium",
      title: "Do not put it in curbside recycling",
      explanation:
        "Plastic bags and flexible film often jam sorting equipment and are usually not accepted curbside.",
      prepSteps: ["Keep it out of the recycling cart.", "Use a store drop-off only if it is clean, dry plastic film."],
      localNote: "Some stores accept clean plastic bags and film separately.",
    }
  }

  if (/\b(glass bottle|glass jar|bottle|jar)\b/.test(text) && !dirty) {
    return {
      decision: "recycle",
      confidence: "medium",
      title: "Recycle it if empty",
      explanation: "Empty glass bottles and jars are accepted by many recycling programs.",
      prepSteps: ["Empty it.", "Rinse if needed.", "Leave labels on unless your local program says otherwise."],
      localNote: "Some areas do not accept glass curbside, so check local rules.",
    }
  }

  if (/\b(plastic bottle|water bottle|detergent bottle|milk jug)\b/.test(text) && !dirty) {
    return {
      decision: "recycle",
      confidence: "medium",
      title: "Recycle it if empty",
      explanation: "Empty plastic bottles and jugs are commonly accepted in curbside recycling.",
      prepSteps: ["Empty it.", "Rinse if sticky.", "Put the cap back on if your local program allows it."],
      localNote: "Plastic rules vary, especially for cups, tubs, and black plastic.",
    }
  }

  if (/\b(food scraps?|banana peel|apple core|coffee grounds|tea bag)\b/.test(text)) {
    return {
      decision: "compost",
      confidence: "medium",
      title: "Compost if available",
      explanation: "Food scraps are not recyclable, but they can often be composted.",
      prepSteps: ["Use a compost bin if your area accepts food scraps.", "Otherwise put it in trash."],
      localNote: "Compost access varies a lot by city and building.",
    }
  }

  return null
}

function parseJson(text: string, item: string): SortResult {
  try {
    const cleaned = text
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
    const objectMatch = cleaned.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(objectMatch?.[0] ?? cleaned) as Partial<SortResult>

    if (
      !parsed.decision ||
      !["recycle", "trash", "compost", "special", "uncertain"].includes(parsed.decision)
    ) {
      return fallbackResult(item)
    }

    return {
      decision: parsed.decision,
      confidence: parsed.confidence ?? "medium",
      title: parsed.title ?? "Best disposal option",
      explanation: parsed.explanation ?? "Use local rules when available.",
      prepSteps: Array.isArray(parsed.prepSteps) ? parsed.prepSteps.slice(0, 4) : [],
      localNote: parsed.localNote ?? "Rules vary by city and hauler.",
      identifiedItem: parsed.identifiedItem ?? "",
      visibleText: parsed.visibleText ?? "",
    }
  } catch {
    return fallbackResult(item)
  }
}

function outputText(data: unknown): string {
  const seen = new Set<unknown>()
  const textBlocks: string[] = []

  function visit(value: unknown, key = "") {
    if (value == null || seen.has(value)) return
    if (typeof value === "string") {
      if (
        key === "output_text" ||
        key === "outputText" ||
        key === "text" ||
        value.trim().startsWith("{")
      ) {
        textBlocks.push(value)
      }
      return
    }
    if (typeof value !== "object") return
    seen.add(value)

    if (Array.isArray(value)) {
      value.forEach((entry) => visit(entry))
      return
    }

    for (const [childKey, childValue] of Object.entries(value)) {
      visit(childValue, childKey)
    }
  }

  if (typeof data !== "object" || data === null) return ""
  const record = data as Record<string, unknown>
  if (typeof record.output_text === "string") return record.output_text
  if (typeof record.outputText === "string") return record.outputText
  if (record.decision) return JSON.stringify(record)

  const candidates = record.candidates
  if (Array.isArray(candidates)) {
    return candidates
      .map((candidate) => {
        if (typeof candidate !== "object" || candidate === null) return ""
        const content = (candidate as Record<string, unknown>).content
        if (typeof content !== "object" || content === null) return ""
        const parts = (content as Record<string, unknown>).parts
        if (!Array.isArray(parts)) return ""
        return parts
          .map((part) =>
            typeof part === "object" && part !== null
              ? ((part as Record<string, unknown>).text as string | undefined) ?? ""
              : "",
          )
          .join("")
      })
      .join("")
  }

  visit(data)
  return textBlocks.join("\n")
}

export async function POST(request: NextRequest) {
  let item = ""
  let location = ""
  let image:
    | {
        type: "image"
        data: string
        mime_type: string
      }
    | null = null

  const contentType = request.headers.get("content-type") ?? ""
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData()
    item = String(formData.get("item") ?? "").trim()
    location = String(formData.get("location") ?? "").trim()

    const uploaded = formData.get("image")
    if (uploaded instanceof File && uploaded.size > 0) {
      if (!uploaded.type.startsWith("image/")) {
        return NextResponse.json({ error: "Upload an image file." }, { status: 400 })
      }
      if (uploaded.size > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: "Use an image smaller than 5 MB." }, { status: 400 })
      }

      image = {
        type: "image",
        data: Buffer.from(await uploaded.arrayBuffer()).toString("base64"),
        mime_type: uploaded.type || "image/jpeg",
      }
    }
  } else {
    const body = (await request.json().catch(() => null)) as
      | { item?: string; location?: string }
      | null
    item = body?.item?.trim() ?? ""
    location = body?.location?.trim() ?? ""
  }

  if (!item && !image) {
    return NextResponse.json({ error: "Describe the item or upload a photo first." }, { status: 400 })
  }

  const itemForPrompt = item || "the main disposable item visible in the uploaded photo"
  const rules = image ? null : ruleBasedResult(item)

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    if (rules) return NextResponse.json({ result: rules })
    return NextResponse.json(
      { error: "Gemini is not configured yet. Add GEMINI_API_KEY to the project environment." },
      { status: 503 },
    )
  }

  const prompt = `
You are BinGO's disposal assistant. Decide how a household item should usually be handled.

Item/user note: ${itemForPrompt}
Location context: ${location || "Unknown"}

Rules:
- If an image is provided, identify the main disposable item and visible contamination before deciding.
- Read visible label text carefully. If the photo says battery, alkaline, lithium, LR6, AA, AAA, 1.5V, do not call it recyclable.
- Cylindrical items with metal terminals are likely batteries even if the label is partially obscured.
- Make a best typical recommendation. Do not default to "uncertain" just because rules vary.
- If food, grease, liquid, or organic residue makes recycling risky, recommend trash unless compost is likely.
- Mention rinsing, drying, emptying, or separating parts when useful.
- Use "special" for batteries, electronics, chemicals, sharps, paint, propane, medicine, and similar hazardous items.
- Use "uncertain" only when the item description is too vague to identify the material or contamination.
- If location is missing or uncertain, still give a typical answer and use localNote to say local programs vary.

Examples:
- "greasy pizza box" is usually trash, or compost if local compost accepts food-soiled paper.
- "empty clean aluminum can" is recycle.
- "paper towel with food" is trash or compost, not recycling.
- "battery" is special drop-off.
`
  const input = image ? [{ type: "text", text: prompt }, image] : prompt

  const geminiRes = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      model: MODEL,
      input,
      system_instruction:
        "You give concise, practical disposal guidance. You are careful about local recycling differences.",
      generation_config: {
        temperature: 0.2,
        thinking_level: "low",
      },
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: RESULT_SCHEMA,
      },
    }),
  })

  if (!geminiRes.ok) {
    if (rules) return NextResponse.json({ result: rules })
    return NextResponse.json(
      { error: "Gemini could not classify that item right now." },
      { status: 502 },
    )
  }

  const data = await geminiRes.json()
  const text = outputText(data)
  const result = normalizeResult(text ? parseJson(text, itemForPrompt) : (rules ?? fallbackResult(itemForPrompt)))

  if (result.decision === "uncertain" && rules) {
    return NextResponse.json({ result: normalizeResult(rules) })
  }

  return NextResponse.json({ result })
}
