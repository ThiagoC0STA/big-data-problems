/**
 * Seed script — populates the Supabase `products` table.
 *
 * Run with:  npx tsx scripts/seed.ts
 *
 * Reads env from .env.local (CATALOG_SIZE / CATALOG_SEED / CATALOG_DEFECT_RATE).
 * Skips if catalog already populated. Commits per batch so partial progress survives.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { streamProducts, CATEGORIES } from "../lib/server/seed-data";
import { validateProduct, statusFromIssues } from "../lib/server/validation";
import { rowToProduct, productToRow } from "../lib/server/utils";

config({ path: ".env.local" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const COUNT = Number(process.env.CATALOG_SIZE ?? 50000);
const SEED = Number(process.env.CATALOG_SEED ?? 1337);
const DEFECT_RATE = Number(process.env.CATALOG_DEFECT_RATE ?? 0.18);
const BATCH = 500;

const db = createClient(URL, KEY, { auth: { persistSession: false } });

async function main() {
  const { count: existing } = await db
    .from("products")
    .select("*", { count: "exact", head: true });

  if ((existing ?? 0) > 0) {
    console.log(`products table already has ${existing} rows — skipping seed.`);
    return;
  }

  console.log(`Seeding ${COUNT} products in batches of ${BATCH}…`);
  const ctx = { knownCategories: new Set(CATEGORIES), skuCounts: {} };

  let chunk: Record<string, unknown>[] = [];
  let inserted = 0;
  const t0 = Date.now();

  for (const raw of streamProducts({ count: COUNT, seed: SEED, defectRate: DEFECT_RATE })) {
    const product = rowToProduct(raw as unknown as Record<string, unknown>);
    const issues = validateProduct(product, ctx);
    chunk.push(
      productToRow({
        ...product,
        validationIssues: issues,
        validationStatus: statusFromIssues(issues),
      }),
    );

    if (chunk.length >= BATCH) {
      const { error } = await db.from("products").insert(chunk);
      if (error) {
        console.error(`insert failed at ${inserted}:`, error.message);
        process.exit(1);
      }
      inserted += chunk.length;
      console.log(`  inserted ${inserted}/${COUNT}`);
      chunk = [];
    }
  }

  if (chunk.length) {
    const { error } = await db.from("products").insert(chunk);
    if (error) {
      console.error(`final insert failed:`, error.message);
      process.exit(1);
    }
    inserted += chunk.length;
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Done — ${inserted} rows in ${elapsed}s.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
