/** Deterministic synthetic catalog generator — TypeScript port of backend/app/seed.py */

export class Mulberry32 {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0;
  }
  nextU32(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t ^= (t + (Math.imul(t ^ (t >>> 7), t | 61) >>> 0)) >>> 0;
    return (t ^ (t >>> 14)) >>> 0;
  }
  random(): number { return this.nextU32() / 0x100000000; }
  randint(lo: number, hi: number): number { return lo + Math.floor(this.random() * (hi - lo)); }
  choice<T>(arr: T[]): T { return arr[Math.floor(this.random() * arr.length)]; }
  chance(p: number): boolean { return this.random() < p; }
}

export const BRANDS = [
  "Aurora","Northwind","Kettle & Co","Harvest Lane","Cedar Mills",
  "Bluepine","Marigold","Stonepath","Riverbend","Goldleaf",
  "Saltwater","Pinecrest","Ironclad","Sunhaven","Brookfield",
  "Wildgrove","Copper Hill","Mossbridge","Driftwood","Hayfield",
  "Snowpeak","Coppermill","Rivertown","Ashbury","Foggy Coast",
  "Black Forest","Goldenrod","Heartland","Lakeshore","Maplewood",
  "Pebble Bay","Quail Run","Redwood","Silvercrest","Trailblazer",
  "Underwood","Verdant","Westwind","Wilderness","Yellowstone",
];

export const CATEGORIES_TREE: Record<string, string[]> = {
  Pantry: ["Pasta","Rice & Grains","Sauces","Oils","Canned Goods","Spices"],
  Beverages: ["Coffee","Tea","Juice","Soda","Sparkling Water","Energy"],
  Snacks: ["Chips","Crackers","Cookies","Nuts","Bars","Popcorn"],
  Dairy: ["Milk","Cheese","Yogurt","Butter","Cream"],
  Frozen: ["Ice Cream","Frozen Meals","Frozen Veg","Frozen Fruit"],
  Produce: ["Fruit","Vegetables","Herbs"],
  Bakery: ["Bread","Pastries","Tortillas","Bagels"],
  "Meat & Seafood": ["Beef","Poultry","Pork","Fish","Shellfish"],
  Household: ["Cleaning","Laundry","Paper Goods","Storage"],
  "Personal Care": ["Skincare","Haircare","Oral Care","Bath"],
  Pet: ["Dog Food","Cat Food","Treats","Toys"],
  Breakfast: ["Cereal","Granola","Oatmeal","Pancake Mix"],
};

export const CATEGORIES = Object.keys(CATEGORIES_TREE);

const ADJECTIVES = [
  "Organic","Roasted","Cold-Pressed","Sun-Ripened","Hand-Rolled",
  "Stone-Ground","Slow-Aged","Smoked","Wild-Caught","Grass-Fed",
  "Heirloom","Artisan","Small-Batch","Vintage","Premium",
  "Classic","Original","Reserve","Signature","Single-Origin",
  "Bold","Mellow","Rich","Crisp","Smooth",
  "Spiced","Honey-Glazed","Maple-Cured","Pepper-Crusted","Citrus-Infused",
  "Toasted","Whipped","Whole-Grain","Gluten-Free","Plant-Based",
  "Cage-Free","Free-Range","Fair-Trade","Single-Source","Estate-Grown",
];

const NOUNS: Record<string, string[]> = {
  Pantry: ["Spaghetti","Lentils","Rice","Tomato Sauce","Olive Oil","Sea Salt","Cumin","Basmati","Quinoa"],
  Beverages: ["Espresso","Green Tea","Apple Juice","Cola","Sparkling Lemon","Energy Drink","Cold Brew"],
  Snacks: ["Potato Chips","Tortilla Chips","Almonds","Walnuts","Granola Bar","Popcorn","Pretzels","Trail Mix"],
  Dairy: ["Whole Milk","Cheddar","Greek Yogurt","Brie","Butter","Heavy Cream","Mozzarella"],
  Frozen: ["Vanilla Ice Cream","Frozen Pizza","Mixed Berries","Stir-Fry Mix","Veggie Burgers"],
  Produce: ["Apples","Bananas","Spinach","Kale","Strawberries","Avocados","Carrots"],
  Bakery: ["Sourdough","Croissant","Bagel","Focaccia","Baguette","Tortillas","Rye Loaf"],
  "Meat & Seafood": ["Ribeye","Chicken Thighs","Pork Loin","Salmon","Shrimp","Ground Beef","Cod"],
  Household: ["Dish Soap","Laundry Pods","Paper Towels","Trash Bags","Storage Bins"],
  "Personal Care": ["Face Cream","Shampoo","Toothpaste","Body Wash","Deodorant","Hand Soap"],
  Pet: ["Dry Dog Food","Wet Cat Food","Dog Treats","Cat Toys","Pet Shampoo"],
  Breakfast: ["Granola","Oatmeal","Cornflakes","Pancake Mix","Maple Syrup","Muesli"],
};

const UNITS = ["12oz","16oz","24oz","32oz","1L","2L","500g","1kg","Pack of 6","Pack of 12","Family Size"];
const TAGS_POOL = ["vegan","gluten-free","organic","non-gmo","kosher","halal","low-sugar","high-protein","keto","paleo","spicy","mild","frozen","ready-to-eat","imported","local","small-batch"];
const NANOID_ALPHA = "0123456789abcdefghijklmnopqrstuvwxyz".split("");
const SKU_ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".split("");

function nanoid(rng: Mulberry32, size = 12): string {
  return Array.from({ length: size }, () => rng.choice(NANOID_ALPHA)).join("");
}
function sku(rng: Mulberry32): string {
  return "SKU-" + Array.from({ length: 6 }, () => rng.choice(SKU_ALPHA)).join("");
}
function ean13(rng: Mulberry32): string {
  return Array.from({ length: 13 }, () => rng.randint(0, 10)).join("");
}
function isoTs(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

export interface RawProduct {
  id: string; sku: string; name: string; brand: string;
  category: string; subcategory: string; description: string | null;
  price_cents: number; currency: "USD"; inventory: number;
  barcode: string | null; image_url: string | null; weight_g: number | null;
  tags: string[]; enrichment_status: string; validation_status: string;
  validation_issues: unknown[]; review_status: string;
  created_at: string; updated_at: string;
}

export function* streamProducts(opts: {
  count: number; seed: number; defectRate: number;
}): Generator<RawProduct> {
  const rng = new Mulberry32(opts.seed);
  const baseMs = Date.now();
  const seenSkus = new Map<string, true>();

  for (let i = 0; i < opts.count; i++) {
    const category = rng.choice(CATEGORIES);
    const subcategory = rng.choice(CATEGORIES_TREE[category]);
    let brand = rng.choice(BRANDS);
    const adj = rng.choice(ADJECTIVES);
    const noun = rng.choice(NOUNS[category]);
    const unit = rng.choice(UNITS);
    const name = `${brand} ${adj} ${noun} - ${unit}`;

    let skuVal = sku(rng);
    if (rng.chance(0.005) && seenSkus.size > 0) {
      skuVal = seenSkus.keys().next().value!;
    }
    seenSkus.set(skuVal, true);

    let price_cents = Math.max(99, Math.floor(rng.random() * 4900) + 99);
    let inventory = rng.randint(0, 800);
    let weight_g: number | null = Math.floor(50 + rng.random() * 4000);
    let description: string | null = `${adj.toLowerCase()} ${noun.toLowerCase()} from ${brand}. ${unit}. A staple from our ${category.toLowerCase()} aisle.`;
    let image_url: string | null = `https://cdn.granary.app/p/${nanoid(rng, 10)}.jpg`;
    let barcode: string | null = ean13(rng);
    const tagCount = rng.randint(0, 4);
    const tags = [...new Set(Array.from({ length: tagCount }, () => rng.choice(TAGS_POOL)))];

    if (rng.chance(opts.defectRate)) {
      const kind = rng.randint(0, 7);
      if (kind === 0) description = null;
      else if (kind === 1) brand = "";
      else if (kind === 2) image_url = null;
      else if (kind === 3) barcode = null;
      else if (kind === 4) price_cents = -100;
      else if (kind === 5) inventory = 0;
      else weight_g = 999_999;
    }

    const createdMs = baseMs - rng.randint(0, 365) * 86_400_000;
    const updatedMs = createdMs + rng.randint(0, 720) * 3_600_000;

    yield {
      id: `prod_${nanoid(rng, 14)}`,
      sku: skuVal, name, brand, category, subcategory,
      description, price_cents, currency: "USD", inventory,
      barcode, image_url, weight_g, tags,
      enrichment_status: "pending",
      validation_status: "unreviewed",
      validation_issues: [],
      review_status: "unreviewed",
      created_at: isoTs(createdMs),
      updated_at: isoTs(updatedMs),
    };
  }
}
