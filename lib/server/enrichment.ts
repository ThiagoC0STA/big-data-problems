/** Anthropic enrichment — TypeScript port of backend/app/ai.py */

import Anthropic from "@anthropic-ai/sdk";
import type { Product } from "@/lib/types";
import { CATEGORIES } from "./seed-data";

export interface EnrichmentResult {
  description?: string | null;
  tags?: string[] | null;
  category?: string | null;
}

export class EnrichmentError extends Error {
  constructor(msg: string) { super(msg); this.name = "EnrichmentError"; }
}

const SYSTEM = `You are an expert e-commerce catalog editor. Given a product, produce clean, factual marketing-quality content.
Constraints:
- Description: 1-2 sentences, 80-220 chars, no fluff, no emojis.
- Tags: 3-6 short kebab-case tags. No duplicates.
- Category: must be one of the canonical categories provided.
Output strictly valid JSON with keys: description, tags, category. Nothing outside the JSON object.`;

function userPrompt(p: Product, fields: string[]): string {
  return (
    `Product:\n  name: ${p.name}\n  brand: ${p.brand || "(missing)"}\n` +
    `  category: ${p.category}\n  description: ${p.description || "(none)"}\n` +
    `  tags: ${p.tags.join(", ") || "(none)"}\n\n` +
    `Canonical categories: ${CATEGORIES.join(", ")}\n\n` +
    `Enrich these fields: ${fields.join(", ")}. Always respond with all three keys.`
  );
}

function extractJson(text: string): EnrichmentResult {
  let t = text.trim();
  if (t.startsWith("```")) { t = t.replace(/^```\w*/, "").replace(/```$/, "").trim(); }
  const start = t.indexOf("{"), end = t.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON in response");
  return JSON.parse(t.slice(start, end + 1));
}

function offlineEnrichment(p: Product): EnrichmentResult {
  const cat = CATEGORIES.includes(p.category) ? p.category : CATEGORIES[0];
  return {
    description: `${p.brand || "House brand"} ${p.name.split(" - ")[0].toLowerCase()}. A staple from our ${cat.toLowerCase()} aisle.`,
    tags: ["everyday", cat.toLowerCase().replace(/ /g, "-"), "in-stock"],
    category: cat,
  };
}

export async function enrichProduct(
  p: Product,
  fields: string[],
  maxAttempts = 3,
): Promise<EnrichmentResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return offlineEnrichment(p);

  const client = new Anthropic({ apiKey });
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const msg = await client.messages.create({
        model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: userPrompt(p, fields) }],
      });
      const text = msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
      return extractJson(text);
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, Math.min(2 ** attempt * 1000, 8000)));
    }
  }
  throw new EnrichmentError(`enrichment failed after ${maxAttempts} attempts: ${lastErr}`);
}
