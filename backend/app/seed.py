"""Synthetic catalog generator. Deterministic via seeded mulberry32 RNG."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

from .schemas import Product

# --------------------------------------------------------------------------- RNG


class Mulberry32:
    """Tiny, deterministic 32-bit PRNG. Same algorithm as the JS reference."""

    __slots__ = ("state",)

    def __init__(self, seed: int) -> None:
        self.state = seed & 0xFFFFFFFF

    def next_u32(self) -> int:
        self.state = (self.state + 0x6D2B79F5) & 0xFFFFFFFF
        t = self.state
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return (t ^ (t >> 14)) & 0xFFFFFFFF

    def random(self) -> float:
        return self.next_u32() / 0x100000000

    def randint(self, lo: int, hi_exclusive: int) -> int:
        return lo + int(self.random() * (hi_exclusive - lo))

    def choice(self, seq: list):
        return seq[int(self.random() * len(seq))]

    def chance(self, p: float) -> bool:
        return self.random() < p


# --------------------------------------------------------------------------- Vocab

BRANDS = [
    "Aurora", "Northwind", "Kettle & Co", "Harvest Lane", "Cedar Mills",
    "Bluepine", "Marigold", "Stonepath", "Riverbend", "Goldleaf",
    "Saltwater", "Pinecrest", "Ironclad", "Sunhaven", "Brookfield",
    "Wildgrove", "Copper Hill", "Mossbridge", "Driftwood", "Hayfield",
    "Snowpeak", "Coppermill", "Rivertown", "Ashbury", "Foggy Coast",
    "Black Forest", "Goldenrod", "Heartland", "Lakeshore", "Maplewood",
    "Pebble Bay", "Quail Run", "Redwood", "Silvercrest", "Trailblazer",
    "Underwood", "Verdant", "Westwind", "Wilderness", "Yellowstone",
]

CATEGORIES_TREE: dict[str, list[str]] = {
    "Pantry": ["Pasta", "Rice & Grains", "Sauces", "Oils", "Canned Goods", "Spices"],
    "Beverages": ["Coffee", "Tea", "Juice", "Soda", "Sparkling Water", "Energy"],
    "Snacks": ["Chips", "Crackers", "Cookies", "Nuts", "Bars", "Popcorn"],
    "Dairy": ["Milk", "Cheese", "Yogurt", "Butter", "Cream"],
    "Frozen": ["Ice Cream", "Frozen Meals", "Frozen Veg", "Frozen Fruit"],
    "Produce": ["Fruit", "Vegetables", "Herbs"],
    "Bakery": ["Bread", "Pastries", "Tortillas", "Bagels"],
    "Meat & Seafood": ["Beef", "Poultry", "Pork", "Fish", "Shellfish"],
    "Household": ["Cleaning", "Laundry", "Paper Goods", "Storage"],
    "Personal Care": ["Skincare", "Haircare", "Oral Care", "Bath"],
    "Pet": ["Dog Food", "Cat Food", "Treats", "Toys"],
    "Breakfast": ["Cereal", "Granola", "Oatmeal", "Pancake Mix"],
}

CATEGORIES = list(CATEGORIES_TREE.keys())

ADJECTIVES = [
    "Organic", "Roasted", "Cold-Pressed", "Sun-Ripened", "Hand-Rolled",
    "Stone-Ground", "Slow-Aged", "Smoked", "Wild-Caught", "Grass-Fed",
    "Heirloom", "Artisan", "Small-Batch", "Vintage", "Premium",
    "Classic", "Original", "Reserve", "Signature", "Single-Origin",
    "Bold", "Mellow", "Rich", "Crisp", "Smooth",
    "Spiced", "Honey-Glazed", "Maple-Cured", "Pepper-Crusted", "Citrus-Infused",
    "Toasted", "Whipped", "Whole-Grain", "Gluten-Free", "Plant-Based",
    "Cage-Free", "Free-Range", "Fair-Trade", "Single-Source", "Estate-Grown",
]

NOUNS_BY_CATEGORY: dict[str, list[str]] = {
    "Pantry": ["Spaghetti", "Lentils", "Rice", "Tomato Sauce", "Olive Oil", "Sea Salt", "Cumin", "Basmati", "Quinoa"],
    "Beverages": ["Espresso", "Green Tea", "Apple Juice", "Cola", "Sparkling Lemon", "Energy Drink", "Cold Brew"],
    "Snacks": ["Potato Chips", "Tortilla Chips", "Almonds", "Walnuts", "Granola Bar", "Popcorn", "Pretzels", "Trail Mix"],
    "Dairy": ["Whole Milk", "Cheddar", "Greek Yogurt", "Brie", "Butter", "Heavy Cream", "Mozzarella"],
    "Frozen": ["Vanilla Ice Cream", "Frozen Pizza", "Mixed Berries", "Stir-Fry Mix", "Veggie Burgers"],
    "Produce": ["Apples", "Bananas", "Spinach", "Kale", "Strawberries", "Avocados", "Carrots"],
    "Bakery": ["Sourdough", "Croissant", "Bagel", "Focaccia", "Baguette", "Tortillas", "Rye Loaf"],
    "Meat & Seafood": ["Ribeye", "Chicken Thighs", "Pork Loin", "Salmon", "Shrimp", "Ground Beef", "Cod"],
    "Household": ["Dish Soap", "Laundry Pods", "Paper Towels", "Trash Bags", "Storage Bins"],
    "Personal Care": ["Face Cream", "Shampoo", "Toothpaste", "Body Wash", "Deodorant", "Hand Soap"],
    "Pet": ["Dry Dog Food", "Wet Cat Food", "Dog Treats", "Cat Toys", "Pet Shampoo"],
    "Breakfast": ["Granola", "Oatmeal", "Cornflakes", "Pancake Mix", "Maple Syrup", "Muesli"],
}

UNITS = ["12oz", "16oz", "24oz", "32oz", "1L", "2L", "500g", "1kg", "Pack of 6", "Pack of 12", "Family Size"]

TAGS_POOL = [
    "vegan", "gluten-free", "organic", "non-gmo", "kosher", "halal",
    "low-sugar", "high-protein", "keto", "paleo", "spicy", "mild",
    "frozen", "ready-to-eat", "imported", "local", "small-batch",
]


# --------------------------------------------------------------------------- Helpers

_NANOID_ALPHABET = list("0123456789abcdefghijklmnopqrstuvwxyz")
_SKU_ALPHABET = list("ABCDEFGHJKLMNPQRSTUVWXYZ23456789")


def _nanoid(rng: Mulberry32, size: int = 12) -> str:
    return "".join(rng.choice(_NANOID_ALPHABET) for _ in range(size))


def _sku(rng: Mulberry32) -> str:
    return "SKU-" + "".join(rng.choice(_SKU_ALPHABET) for _ in range(6))


def _ean13(rng: Mulberry32) -> str:
    return "".join(str(rng.randint(0, 10)) for _ in range(13))


def _iso(dt: datetime) -> str:
    return dt.replace(microsecond=0).isoformat().replace("+00:00", "Z")


# --------------------------------------------------------------------------- Generator


def generate_products(
    *,
    count: int,
    seed: int,
    defect_rate: float,
    base_time: datetime | None = None,
) -> list[Product]:
    """Generate ``count`` products deterministically.

    ``defect_rate`` is the probability that a product has at least one intentional
    defect. Defects are field-level: missing description, missing brand, etc.
    """
    rng = Mulberry32(seed)
    base_time = base_time or datetime.now(UTC)
    products: list[Product] = []
    seen_skus: dict[str, str] = {}

    for _i in range(count):
        category = rng.choice(CATEGORIES)
        subcategory = rng.choice(CATEGORIES_TREE[category])
        brand = rng.choice(BRANDS)
        adj = rng.choice(ADJECTIVES)
        noun = rng.choice(NOUNS_BY_CATEGORY[category])
        unit = rng.choice(UNITS)
        name = f"{brand} {adj} {noun} - {unit}"

        sku = _sku(rng)
        if rng.chance(0.005) and seen_skus:
            sku = next(iter(seen_skus.keys()))
        seen_skus[sku] = ""

        price_cents = max(99, int(rng.random() * 4900) + 99)
        inventory = rng.randint(0, 800)
        weight_g: int | None = int(50 + rng.random() * 4000)

        description: str | None = (
            f"{adj.lower()} {noun.lower()} from {brand}. {unit}. "
            f"A staple from our {category.lower()} aisle."
        )
        image_url: str | None = f"https://cdn.granary.app/p/{_nanoid(rng, 10)}.jpg"
        barcode: str | None = _ean13(rng)
        tags = [rng.choice(TAGS_POOL) for _ in range(rng.randint(0, 4))]
        tags = list(dict.fromkeys(tags))

        if rng.chance(defect_rate):
            kind = rng.randint(0, 7)
            if kind == 0:
                description = None
            elif kind == 1:
                brand = ""
            elif kind == 2:
                image_url = None
            elif kind == 3:
                barcode = None
            elif kind == 4:
                price_cents = -100
            elif kind == 5:
                inventory = 0
            else:
                weight_g = 999_999

        created_at = base_time - timedelta(days=rng.randint(0, 365))
        updated_at = created_at + timedelta(hours=rng.randint(0, 720))

        product = Product(
            id=f"prod_{_nanoid(rng, 14)}",
            sku=sku,
            name=name,
            brand=brand,
            category=category,
            subcategory=subcategory,
            description=description,
            price_cents=price_cents,
            currency="USD",
            inventory=inventory,
            barcode=barcode,
            image_url=image_url,
            weight_g=weight_g,
            tags=tags,
            enrichment_status="pending",
            validation_status="unreviewed",
            validation_issues=[],
            review_status="unreviewed",
            created_at=_iso(created_at),
            updated_at=_iso(updated_at),
        )
        products.append(product)

    return products


def stream_products(
    *,
    count: int,
    seed: int,
    defect_rate: float,
    base_time: datetime | None = None,
) -> Iterator[Product]:
    """True generator — yields one product at a time, O(1) memory per item.

    seen_skus lives in generator scope so duplicate-SKU injection still works
    across the full run (~10 MB for 1 M entries, acceptable).
    """
    rng = Mulberry32(seed)
    base_time = base_time or datetime.now(UTC)
    seen_skus: dict[str, str] = {}

    for _i in range(count):
        category = rng.choice(CATEGORIES)
        subcategory = rng.choice(CATEGORIES_TREE[category])
        brand = rng.choice(BRANDS)
        adj = rng.choice(ADJECTIVES)
        noun = rng.choice(NOUNS_BY_CATEGORY[category])
        unit = rng.choice(UNITS)
        name = f"{brand} {adj} {noun} - {unit}"

        sku = _sku(rng)
        if rng.chance(0.005) and seen_skus:
            sku = next(iter(seen_skus.keys()))
        seen_skus[sku] = ""

        price_cents = max(99, int(rng.random() * 4900) + 99)
        inventory = rng.randint(0, 800)
        weight_g: int | None = int(50 + rng.random() * 4000)

        description: str | None = (
            f"{adj.lower()} {noun.lower()} from {brand}. {unit}. "
            f"A staple from our {category.lower()} aisle."
        )
        image_url: str | None = f"https://cdn.granary.app/p/{_nanoid(rng, 10)}.jpg"
        barcode: str | None = _ean13(rng)
        tags = [rng.choice(TAGS_POOL) for _ in range(rng.randint(0, 4))]
        tags = list(dict.fromkeys(tags))

        if rng.chance(defect_rate):
            kind = rng.randint(0, 7)
            if kind == 0:
                description = None
            elif kind == 1:
                brand = ""
            elif kind == 2:
                image_url = None
            elif kind == 3:
                barcode = None
            elif kind == 4:
                price_cents = -100
            elif kind == 5:
                inventory = 0
            else:
                weight_g = 999_999

        created_at = base_time - timedelta(days=rng.randint(0, 365))
        updated_at = created_at + timedelta(hours=rng.randint(0, 720))

        yield Product(
            id=f"prod_{_nanoid(rng, 14)}",
            sku=sku,
            name=name,
            brand=brand,
            category=category,
            subcategory=subcategory,
            description=description,
            price_cents=price_cents,
            currency="USD",
            inventory=inventory,
            barcode=barcode,
            image_url=image_url,
            weight_g=weight_g,
            tags=tags,
            enrichment_status="pending",
            validation_status="unreviewed",
            validation_issues=[],
            review_status="unreviewed",
            created_at=_iso(created_at),
            updated_at=_iso(updated_at),
        )


__all__ = [
    "BRANDS",
    "CATEGORIES",
    "CATEGORIES_TREE",
    "Mulberry32",
    "generate_products",
    "stream_products",
]
