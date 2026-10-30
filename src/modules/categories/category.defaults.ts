export interface DefaultCategorySeed {
  name: string;
  slug: string;
  description: string;
  level: number;
  icon: string;
  emoji: string;
  orderIndex: number;
  subcategories: Array<{
    name: string;
    slug: string;
    description: string;
    icon: string;
    emoji: string;
    orderIndex: number;
  }>;
}

export const DEFAULT_PRIMARY_CATEGORIES: DefaultCategorySeed[] = [
  {
    name: "Grocery & Essentials",
    slug: "grocery-and-essentials",
    description: "Daily household staples, pulses, grains, dairy, cooking oils, snacks, and home care items.",
    level: 1,
    icon: "shopping-basket",
    emoji: "🛒",
    orderIndex: 1,
    subcategories: [
      {
        name: "Dairy, Bread & Eggs",
        slug: "dairy-bread-and-eggs",
        description: "Fresh cow & buffalo milk, curd, paneer, butter, cheese, sliced breads, and farm fresh eggs.",
        icon: "milk",
        emoji: "🥛",
        orderIndex: 1,
      },
      {
        name: "Atta, Rice, Oil & Dals",
        slug: "atta-rice-oil-and-dals",
        description: "Premium wheat atta, basmati rice, mustard/sunflower oil, toor dal, moong, and whole spices.",
        icon: "wheat",
        emoji: "🌾",
        orderIndex: 2,
      },
      {
        name: "Snacks, Biscuits & Munchies",
        slug: "snacks-biscuits-and-munchies",
        description: "Potato chips, namkeen, roasted nuts, tea-time biscuits, cookies, and traditional savories.",
        icon: "cookie",
        emoji: "🍪",
        orderIndex: 3,
      },
      {
        name: "Beverages & Cold Drinks",
        slug: "beverages-and-cold-drinks",
        description: "Soft drinks, fruit juices, packaged drinking water, tea powder, coffee, and energy drinks.",
        icon: "cup-soda",
        emoji: "🥤",
        orderIndex: 4,
      },
      {
        name: "Cleaning & Household",
        slug: "cleaning-and-household",
        description: "Detergents, floor cleaners, dishwash liquids, garbage bags, and household disinfectant sprays.",
        icon: "sparkles",
        emoji: "✨",
        orderIndex: 5,
      },
      {
        name: "Personal Care & Hygiene",
        slug: "personal-care-and-hygiene",
        description: "Bath soaps, shampoos, hair oils, toothpastes, skincare lotions, and personal hygiene essentials.",
        icon: "smile",
        emoji: "🧴",
        orderIndex: 6,
      },
    ],
  },
  {
    name: "Fresh Produce",
    slug: "fresh-produce",
    description: "Locally sourced garden-fresh vegetables, seasonal juicy fruits, and aromatic cooking herbs.",
    level: 1,
    icon: "apple",
    emoji: "🥦",
    orderIndex: 2,
    subcategories: [
      {
        name: "Fresh Vegetables",
        slug: "fresh-vegetables",
        description: "Potatoes, onions, tomatoes, green chilies, leafy spinach, gourds, and seasonal veggies.",
        icon: "carrot",
        emoji: "🥕",
        orderIndex: 1,
      },
      {
        name: "Fresh Fruits",
        slug: "fresh-fruits",
        description: "Fresh apples, bananas, pomegranates, oranges, papayas, and seasonal regional fruits.",
        icon: "apple",
        emoji: "🍎",
        orderIndex: 2,
      },
      {
        name: "Exotic & Seasonal Herbs",
        slug: "exotic-and-seasonal-herbs",
        description: "Fresh coriander, mint leaves, curry leaves, ginger, garlic, lemon, and culinary herbs.",
        icon: "leaf",
        emoji: "🌿",
        orderIndex: 3,
      },
    ],
  },
  {
    name: "Bakery & Confectionery",
    slug: "bakery-and-confectionery",
    description: "Freshly baked oven goods, artisanal pastries, breads, celebratory cakes, and festive sweets.",
    level: 1,
    icon: "croissant",
    emoji: "🥐",
    orderIndex: 3,
    subcategories: [
      {
        name: "Cakes & Pastries",
        slug: "cakes-and-pastries",
        description: "Birthday cakes, chocolate pastries, black forest, red velvet, cheesecakes, and tea-cakes.",
        icon: "cake",
        emoji: "🎂",
        orderIndex: 1,
      },
      {
        name: "Artisanal Breads & Buns",
        slug: "artisanal-breads-and-buns",
        description: "Whole wheat breads, pav buns, burger buns, garlic breads, pizza bases, and croissants.",
        icon: "bread",
        emoji: "🍞",
        orderIndex: 2,
      },
      {
        name: "Cookies & Rusks",
        slug: "cookies-and-rusks",
        description: "Crunchy suji rusks, butter cookies, coconut biscuits, khari puff, and namkeen puffs.",
        icon: "cookie",
        emoji: "🥮",
        orderIndex: 3,
      },
      {
        name: "Sweets & Mithai",
        slug: "sweets-and-mithai",
        description: "Gulab jamun, rasgulla, kaju katli, motichoor laddu, peda, and regional sweet delicacies.",
        icon: "gift",
        emoji: "🍬",
        orderIndex: 4,
      },
    ],
  },
  {
    name: "Pharmacy & Wellness",
    slug: "pharmacy-and-wellness",
    description: "Prescription & OTC medicines, first aid kits, ayurvedic remedies, and health supplements.",
    level: 1,
    icon: "pill",
    emoji: "💊",
    orderIndex: 4,
    subcategories: [
      {
        name: "Medicines & First Aid",
        slug: "medicines-and-first-aid",
        description: "Pain relief, fever medicine, antacids, bandages, antiseptic liquids, and emergency first aid.",
        icon: "cross",
        emoji: "🩹",
        orderIndex: 1,
      },
      {
        name: "Ayurvedic & Herbal Care",
        slug: "ayurvedic-and-herbal-care",
        description: "Chyawanprash, herbal juices, ashwagandha, triphala, giloy, and traditional wellness tonics.",
        icon: "flower-2",
        emoji: "🌱",
        orderIndex: 2,
      },
      {
        name: "Vitamins & Supplements",
        slug: "vitamins-and-supplements",
        description: "Multivitamins, Vitamin C, Vitamin D3, calcium supplements, protein powders, and omega-3.",
        icon: "heart-pulse",
        emoji: "💪",
        orderIndex: 3,
      },
      {
        name: "Baby Care & Nutrition",
        slug: "baby-care-and-nutrition",
        description: "Baby diapers, wet wipes, baby gentle soap, infant milk formula, and baby massage oil.",
        icon: "baby",
        emoji: "👶",
        orderIndex: 4,
      },
    ],
  },
  {
    name: "Mobile & Electronics",
    slug: "mobile-and-electronics",
    description: "Smartphones, electronic accessories, audio gadgets, fast chargers, and smart wearables.",
    level: 1,
    icon: "smartphone",
    emoji: "📱",
    orderIndex: 5,
    subcategories: [
      {
        name: "Smartphones & Tablets",
        slug: "smartphones-and-tablets",
        description: "Android smartphones, iPhones, feature phones, screen guards, protective back covers.",
        icon: "smartphone",
        emoji: "📲",
        orderIndex: 1,
      },
      {
        name: "Cables, Chargers & Powerbanks",
        slug: "cables-chargers-and-powerbanks",
        description: "Type-C fast cables, lightning cables, 65W charging bricks, high-capacity power banks.",
        icon: "zap",
        emoji: "🔌",
        orderIndex: 2,
      },
      {
        name: "Headphones & Audio",
        slug: "headphones-and-audio",
        description: "True wireless earbuds (TWS), bluetooth neckbands, over-ear headphones, and portable speakers.",
        icon: "headphones",
        emoji: "🎧",
        orderIndex: 3,
      },
      {
        name: "Smart Watches & Wearables",
        slug: "smart-watches-and-wearables",
        description: "Fitness tracker bands, AMOLED smart watches, smart health rings, and replacement straps.",
        icon: "watch",
        emoji: "⌚",
        orderIndex: 4,
      },
    ],
  },
];
