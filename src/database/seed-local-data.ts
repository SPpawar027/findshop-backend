import bcrypt from "bcryptjs";
import { sequelize } from "../config/database";
import { User } from "../modules/users/user.model";
import { Shop } from "../modules/shops/shop.model";
import { Product } from "../modules/products/product.model";
import { Category } from "../modules/categories/category.model";
import { Review } from "../modules/reviews/review.model";
import { reviewService } from "../modules/reviews/review.service";
import { categoryService } from "../modules/categories/category.service";
import { setupAssociations } from "./associations";

export async function runLocalSeed() {
  console.log("🌱 Starting Rich Local Database Seeder (Rau & Indore)...");

  try {
    setupAssociations();
    await sequelize.authenticate();
    console.log("✓ Connected to PostgreSQL database.");

    // =========================================================================
    // 1. ENSURE CATEGORIES
    // =========================================================================
    console.log(" Seeding Categories...");
    await categoryService.ensureDefaultCategories();

    // Add Fashion & Apparel sector if not present
    let fashionSector = await Category.findOne({ where: { slug: "fashion-and-apparel" } });
    if (!fashionSector) {
      fashionSector = await Category.create({
        name: "Fashion & Apparel",
        slug: "fashion-and-apparel",
        description: "Ethnic wear, casuals, bridal sarees, shirts, trousers, and festive collections.",
        level: 1,
        icon: "shirt",
        emoji: "👗",
        orderIndex: 6,
        isActive: true,
      });

      await Category.bulkCreate([
        {
          name: "Traditional & Ethnic Wear",
          slug: "traditional-and-ethnic-wear",
          description: "Chanderi sarees, Banarasi zaris, festive kurtas, and bridal lehengas.",
          level: 2,
          parentId: fashionSector.id,
          icon: "sparkles",
          emoji: "🥻",
          orderIndex: 1,
          isActive: true,
        },
        {
          name: "Men's Casuals & Denim",
          slug: "mens-casuals-and-denim",
          description: "Branded jeans, cotton shirts, hoodies, t-shirts, and tailored trousers.",
          level: 2,
          parentId: fashionSector.id,
          icon: "shirt",
          emoji: "👔",
          orderIndex: 2,
          isActive: true,
        },
      ]);
    }

    // Add Footwear & Sportswear sector if not present
    let footwearSector = await Category.findOne({ where: { slug: "footwear-and-sportswear" } });
    if (!footwearSector) {
      footwearSector = await Category.create({
        name: "Footwear & Sportswear",
        slug: "footwear-and-sportswear",
        description: "Running sneakers, sports apparel, formal shoes, leather boots, and sandals.",
        level: 1,
        icon: "footprints",
        emoji: "👟",
        orderIndex: 7,
        isActive: true,
      });

      await Category.bulkCreate([
        {
          name: "Athletic & Running Shoes",
          slug: "athletic-and-running-shoes",
          description: "Cushioned running shoes, gym trainers, trail sneakers, and marathon footwear.",
          level: 2,
          parentId: footwearSector.id,
          icon: "activity",
          emoji: "🏃",
          orderIndex: 1,
          isActive: true,
        },
        {
          name: "Casual Sneakers & Loafers",
          slug: "casual-sneakers-and-loafers",
          description: "Everyday canvas shoes, slip-on loafers, sliders, and lightweight sandals.",
          level: 2,
          parentId: footwearSector.id,
          icon: "footprints",
          emoji: "👞",
          orderIndex: 2,
          isActive: true,
        },
      ]);
    }

    // Map all categories for easy lookup
    const allCategories = await Category.findAll({ where: { isActive: true } });
    const catMapBySlug = new Map<string, number>();
    allCategories.forEach((c) => catMapBySlug.set(c.slug, c.id));
    console.log(`✓ Ensured ${allCategories.length} categories in Category Master.`);

    // =========================================================================
    // 2. SEED / UPDATE USERS
    // =========================================================================
    console.log(" Seeding Users...");
    const defaultPasswordHash = await bcrypt.hash("Findshop123!", 10);

    const usersData = [
      { name: "Platform Superadmin", email: "superadmin@findshop.com", role: "super_admin" as const, phone: "+919800000001" },
      { name: "Mukesh Patidar", email: "mukesh@raukirana.com", role: "shop_admin" as const, phone: "+919826011223" },
      { name: "Sunil Verma", email: "sunil@siliconmobile.com", role: "shop_admin" as const, phone: "+919826022334" },
      { name: "Govind Sharma", email: "govind@rausweets.com", role: "shop_admin" as const, phone: "+919826033445" },
      { name: "Priya Agrawal", email: "priya@mahalaxmi.com", role: "shop_admin" as const, phone: "+919826044556" },
      { name: "Dr. Ritu Verma", email: "ritu@apollo.com", role: "shop_admin" as const, phone: "+919826055667" },
      { name: "Deepak Chouhan", email: "deepak@rausports.com", role: "shop_admin" as const, phone: "+919826066778" },
      { name: "Rajesh Sharma", email: "rajesh@kirana.com", role: "shop_admin" as const, phone: "+919876543210" },
      { name: "Vikram Jain", email: "vikram@citymobile.com", role: "shop_admin" as const, phone: "+919876543211" },
      { name: "Balaji Rathore", email: "balaji@crafts.com", role: "shop_admin" as const, phone: "+919425012345" },
      { name: "Suresh Gupta", email: "suresh@bikanervala.com", role: "shop_admin" as const, phone: "+919876543213" },
      { name: "Arjun Nair", email: "arjun@sportsplus.com", role: "shop_admin" as const, phone: "+919876543212" },
      { name: "Aarav Patel", email: "aarav@customer.com", role: "customer" as const, phone: "+919800000002" },
    ];

    const userMap = new Map<string, User>();
    for (const u of usersData) {
      let user = await User.findOne({ where: { email: u.email } });
      if (!user) {
        user = await User.create({
          name: u.name,
          email: u.email,
          passwordHash: defaultPasswordHash,
          phone: u.phone,
          role: u.role,
          isActive: true,
        });
      } else {
        await user.update({ name: u.name, phone: u.phone, role: u.role, isActive: true });
      }
      userMap.set(u.email, user);
    }
    console.log(`✓ Seeded ${userMap.size} users.`);

    // =========================================================================
    // 3. SEED / UPDATE SHOPS (Rau & Indore Focus)
    // =========================================================================
    console.log(" Seeding Shops in Rau & Indore...");

    const standardWeeklyHours = {
      monday: { open: "09:00", close: "21:30", closed: false },
      tuesday: { open: "09:00", close: "21:30", closed: false },
      wednesday: { open: "09:00", close: "21:30", closed: false },
      thursday: { open: "09:00", close: "21:30", closed: false },
      friday: { open: "09:00", close: "21:30", closed: false },
      saturday: { open: "09:00", close: "22:00", closed: false },
      sunday: { open: "10:00", close: "21:00", closed: false },
    };

    const shopsData = [
      // ---------------- RAU SHOPS (Exact user neighborhood ~22.685, 75.795) ----------------
      {
        ownerEmail: "mukesh@raukirana.com",
        name: "Rau Organic Fresh & Daily Needs",
        slug: "rau-organic-fresh-supermarket",
        category: "Grocery & Supermarket",
        description: "Rau's premier family supermarket offering certified organic farm staples, A2 Gir cow ghee, cold-pressed oils, Daawat basmati rice, and daily dairy with instant 20-min local home delivery.",
        address: "Shop 1-3, Rau Circle Commercial Complex, AB Road",
        city: "Rau",
        state: "Madhya Pradesh",
        postalCode: "453331",
        latitude: 22.6854,
        longitude: 75.7959,
        phone: "+91 98260 11223",
        email: "order@raukirana.com",
        rating: 4.8,
        reviewCount: 148,
        isVerified: true,
        isOpen: true,
        openingHours: standardWeeklyHours,
        bannerUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80",
        logoUrl: "https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=400&q=80",
      },
      {
        ownerEmail: "sunil@siliconmobile.com",
        name: "Silicon City Mobile World & Gadgets",
        slug: "silicon-city-mobile-world",
        category: "Smartphones & Electronics",
        description: "Authorized multi-brand mobile gallery featuring Apple, Samsung, OnePlus, and Xiaomi with direct brand warranty, 0% EMI financing, and professional tempered glass laser installation.",
        address: "Shop 4, Silicon City Commercial Gate 1, Cat Road",
        city: "Rau",
        state: "Madhya Pradesh",
        postalCode: "453331",
        latitude: 22.6875,
        longitude: 75.7942,
        phone: "+91 98260 22334",
        email: "support@siliconmobile.com",
        rating: 4.7,
        reviewCount: 96,
        isVerified: true,
        isOpen: true,
        openingHours: standardWeeklyHours,
        bannerUrl: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80",
        logoUrl: "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&w=400&q=80",
      },
      {
        ownerEmail: "govind@rausweets.com",
        name: "Rau Royal Sweets, Namkeen & Chaat",
        slug: "rau-royal-sweets-namkeen",
        category: "Sweets & Confectionery",
        description: "Heritage pure desi ghee sweetshop famous for hot Jalebi-Poha, Kaju Katli, Motichoor Laddoos, Ratlami Sev, and freshly baked festive dry fruit gift boxes.",
        address: "12 Old AB Road, Near Rau Bus Station",
        city: "Rau",
        state: "Madhya Pradesh",
        postalCode: "453331",
        latitude: 22.6838,
        longitude: 75.7972,
        phone: "+91 98260 33445",
        email: "orders@rausweets.com",
        rating: 4.9,
        reviewCount: 210,
        isVerified: true,
        isOpen: true,
        openingHours: standardWeeklyHours,
        bannerUrl: "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=1200&q=80",
        logoUrl: "https://images.unsplash.com/photo-1505253758473-96b3d5ebcd94?auto=format&fit=crop&w=400&q=80",
      },
      {
        ownerEmail: "priya@mahalaxmi.com",
        name: "Chanderi & Maheshwari Heritage Wear - Rau",
        slug: "chanderi-heritage-ethnic-wear-rau",
        category: "Traditional & Ethnic Wear",
        description: "Authentic handloom boutique showcasing certified Maheshwari silk sarees, Chanderi zaris, designer festive kurtas, and bridal lehenga collections directly from master weavers.",
        address: "Opp. Police Station, Main Market Road",
        city: "Rau",
        state: "Madhya Pradesh",
        postalCode: "453331",
        latitude: 22.6865,
        longitude: 75.7985,
        phone: "+91 98260 44556",
        email: "contact@chanderirau.com",
        rating: 4.8,
        reviewCount: 82,
        isVerified: true,
        isOpen: true,
        openingHours: standardWeeklyHours,
        bannerUrl: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1200&q=80",
        logoUrl: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=400&q=80",
      },
      {
        ownerEmail: "ritu@apollo.com",
        name: "Apollo 24x7 Pharmacy & Wellness - Rau",
        slug: "apollo-pharmacy-wellness-rau",
        category: "Pharmacy & Health",
        description: "24/7 licensed pharmacy stocking genuine prescription medicines, baby care essentials, Ayurvedic wellness remedies, diagnostic test strips, and digital BP monitors.",
        address: "Silicon City Square, Cat Road",
        city: "Rau",
        state: "Madhya Pradesh",
        postalCode: "453331",
        latitude: 22.6840,
        longitude: 75.7938,
        phone: "+91 98260 55667",
        email: "care@apollorau.com",
        rating: 4.9,
        reviewCount: 135,
        isVerified: true,
        isOpen: true,
        openingHours: standardWeeklyHours,
        bannerUrl: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=1200&q=80",
        logoUrl: "https://images.unsplash.com/photo-1631549916768-4119b2e5f926?auto=format&fit=crop&w=400&q=80",
      },
      {
        ownerEmail: "deepak@rausports.com",
        name: "Campus & Nike Sports Footwear Hub - Rau",
        slug: "campus-nike-sports-footwear-rau",
        category: "Footwear & Sportswear",
        description: "Official athletic footwear retailer carrying genuine running shoes, walking sneakers, training activewear, and badminton gear with instant in-store try-on.",
        address: "Near Rau Bypass Flyover, AB Road",
        city: "Rau",
        state: "Madhya Pradesh",
        postalCode: "453331",
        latitude: 22.6888,
        longitude: 75.7968,
        phone: "+91 98260 66778",
        email: "support@rausports.com",
        rating: 4.6,
        reviewCount: 74,
        isVerified: true,
        isOpen: true,
        openingHours: standardWeeklyHours,
        bannerUrl: "https://images.unsplash.com/photo-1556906781-9a412961c28c?auto=format&fit=crop&w=1200&q=80",
        logoUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80",
      },

      // ---------------- INDORE CITY SHOPS (Central Hubs) ----------------
      {
        ownerEmail: "rajesh@kirana.com",
        name: "Sharma Electronics & Home Appliances",
        slug: "sharma-electronics-vijay-nagar",
        category: "Smartphones & Electronics",
        description: "Indore's trusted consumer electronics showroom for 18+ years. 4K OLED Smart TVs, split ACs, frost-free refrigerators, and home soundbars with same-day delivery.",
        address: "Scheme 54, PU-4 Commercial Complex, Near Velocity III, Vijay Nagar",
        city: "Indore",
        state: "Madhya Pradesh",
        postalCode: "452010",
        latitude: 22.7533,
        longitude: 75.8937,
        phone: "+91 98260 12345",
        email: "sharma.vijaynagar@electronics.com",
        rating: 4.8,
        reviewCount: 340,
        isVerified: true,
        isOpen: true,
        openingHours: standardWeeklyHours,
        bannerUrl: "https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=1200&q=80",
        logoUrl: "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=400&q=80",
      },
      {
        ownerEmail: "vikram@citymobile.com",
        name: "Fashion Hub & Denim Studio - New Palasia",
        slug: "fashion-hub-denim-new-palasia",
        category: "Men's & Women's Fashion",
        description: "Curated modern denim, linen casuals, party dresses, and premium formalwear. Direct manufacturer warranty and on-the-spot tailoring.",
        address: "123 MG Road, Near Treasure Island, New Palasia",
        city: "Indore",
        state: "Madhya Pradesh",
        postalCode: "452001",
        latitude: 22.7244,
        longitude: 75.8839,
        phone: "+91 98765 43210",
        email: "palasia@fashionhub.com",
        rating: 4.6,
        reviewCount: 190,
        isVerified: true,
        isOpen: true,
        openingHours: standardWeeklyHours,
        bannerUrl: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80",
        logoUrl: "https://images.unsplash.com/photo-1589310243389-96a5483213a8?auto=format&fit=crop&w=400&q=80",
      },
      {
        ownerEmail: "suresh@bikanervala.com",
        name: "Chappan Bhog Sweets, Namkeen & Chaat",
        slug: "chappan-bhog-sweets-56-dukan",
        category: "Sweets & Confectionery",
        description: "The iconic flavor of Indore. Pure desi ghee Shrikhand, crispy Malpua, Sev Parmal, Khopra Patties, and authentic festival sweet boxes.",
        address: "Shop 18, 56 Dukan Street, New Palasia",
        city: "Indore",
        state: "Madhya Pradesh",
        postalCode: "452001",
        latitude: 22.7250,
        longitude: 75.8800,
        phone: "+91 98260 77889",
        email: "chappanbhog@indore.com",
        rating: 4.9,
        reviewCount: 650,
        isVerified: true,
        isOpen: true,
        openingHours: standardWeeklyHours,
        bannerUrl: "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=1200&q=80",
        logoUrl: "https://images.unsplash.com/photo-1505253758473-96b3d5ebcd94?auto=format&fit=crop&w=400&q=80",
      },
      {
        ownerEmail: "balaji@crafts.com",
        name: "Shree Balaji Heritage Handicrafts & Wooden Decor",
        slug: "shree-balaji-handicrafts-rajwada",
        category: "Gifts & Handicrafts",
        description: "Handcrafted teakwood artifacts, brass inlay jewelry chests, temple decor, and festive gift sets hand-carved by heritage artisans.",
        address: "Near Sarafa Gate, Rajwada Chowk",
        city: "Indore",
        state: "Madhya Pradesh",
        postalCode: "452002",
        latitude: 22.7196,
        longitude: 75.8577,
        phone: "+91 94250 12345",
        email: "balajicrafts@rajwada.com",
        rating: 4.9,
        reviewCount: 220,
        isVerified: true,
        isOpen: true,
        openingHours: standardWeeklyHours,
        bannerUrl: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1200&q=80",
        logoUrl: "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=400&q=80",
      },
    ];

    const shopMap = new Map<string, Shop>();

    for (const s of shopsData) {
      const owner = userMap.get(s.ownerEmail);
      if (!owner) continue;

      let shop = await Shop.findOne({ where: { slug: s.slug } });
      const shopPayload = {
        ownerId: owner.id,
        name: s.name,
        slug: s.slug,
        category: s.category,
        description: s.description,
        address: s.address,
        city: s.city,
        state: s.state,
        postalCode: s.postalCode,
        latitude: s.latitude,
        longitude: s.longitude,
        phone: s.phone,
        email: s.email,
        rating: s.rating,
        reviewCount: s.reviewCount,
        isVerified: s.isVerified,
        isOpen: s.isOpen,
        openingHours: s.openingHours,
        bannerUrl: s.bannerUrl,
        logoUrl: s.logoUrl,
      };

      if (!shop) {
        shop = await Shop.create(shopPayload);
      } else {
        await shop.update(shopPayload);
      }
      shopMap.set(s.slug, shop);
    }
    console.log(`✓ Seeded/Updated ${shopMap.size} shops across Rau and Indore.`);

    // =========================================================================
    // 4. SEED PRODUCTS WITH CATEGORY IDS
    // =========================================================================
    console.log(" Seeding Products with valid Category References...");

    const productsData = [
      // --- Rau Organic Supermarket ---
      {
        shopSlug: "rau-organic-fresh-supermarket",
        categorySlug: "atta-rice-oil-and-dals",
        name: "Daawat Rozana Gold Basmati Rice (5 Kg)",
        slug: "daawat-rozana-gold-basmati-rice-5kg",
        category: "Atta, Rice, Oil & Dals",
        description: "Naturally aged long-grain basmati rice with irresistible aroma and fluffy non-sticky grains, perfect for daily family meals and biryanis.",
        price: 385,
        discountPrice: 460,
        stockQuantity: 35,
        sku: "RAU-RICE-001",
        images: ["https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80"],
        isAvailable: true,
      },
      {
        shopSlug: "rau-organic-fresh-supermarket",
        categorySlug: "atta-rice-oil-and-dals",
        name: "Fortune Kachi Ghani Mustard Oil (1 Litre Pouch)",
        slug: "fortune-kachi-ghani-mustard-oil-1l",
        category: "Atta, Rice, Oil & Dals",
        description: "Traditional cold-pressed mustard oil with sharp pungent aroma and natural antioxidants for authentic Indian cooking.",
        price: 145,
        discountPrice: 175,
        stockQuantity: 40,
        sku: "RAU-OIL-002",
        images: ["https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=800&q=80"],
        isAvailable: true,
      },
      {
        shopSlug: "rau-organic-fresh-supermarket",
        categorySlug: "dairy-bread-and-eggs",
        name: "Amul Pasteurised Butter (500g Block)",
        slug: "amul-pasteurised-butter-500g",
        category: "Dairy, Bread & Eggs",
        description: "Rich and creamy pure cow & buffalo milk butter, the gold standard of taste for Indian breakfasts, parathas, and baking.",
        price: 275,
        discountPrice: 285,
        stockQuantity: 25,
        sku: "RAU-DAIRY-003",
        images: ["https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=800&q=80"],
        isAvailable: true,
      },
      {
        shopSlug: "rau-organic-fresh-supermarket",
        categorySlug: "snacks-biscuits-and-munchies",
        name: "Haldiram's Ratlami Sev Special (400g Pouch)",
        slug: "haldirams-ratlami-sev-special-400g",
        category: "Snacks, Biscuits & Munchies",
        description: "Crispy clove and black pepper infused gram-flour sev, the authentic Malwa namkeen to sprinkle over Indori poha or enjoy with chai.",
        price: 110,
        discountPrice: 130,
        stockQuantity: 50,
        sku: "RAU-SEV-004",
        images: ["https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=800&q=80"],
        isAvailable: true,
      },

      // --- Silicon City Mobile World ---
      {
        shopSlug: "silicon-city-mobile-world",
        categorySlug: "smartphones-and-tablets",
        name: "OnePlus Nord CE4 5G (8GB RAM, 128GB, Dark Chrome)",
        slug: "oneplus-nord-ce4-5g-8gb-128gb",
        category: "Smartphones & Tablets",
        description: "Features Snapdragon 7 Gen 3 processor, 100W SUPERVOOC charging, 5500mAh durable battery, and vibrant 120Hz AMOLED display with brand warranty.",
        price: 24999,
        discountPrice: 26999,
        stockQuantity: 8,
        sku: "SIL-PHONE-001",
        images: ["https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80"],
        isAvailable: true,
      },
      {
        shopSlug: "silicon-city-mobile-world",
        categorySlug: "headphones-and-audio",
        name: "boAt Airdopes 141 ANC Wireless Earbuds (42H Playtime)",
        slug: "boat-airdopes-141-anc-earbuds",
        category: "Headphones & Audio",
        description: "True wireless earbuds featuring 32dB Active Noise Cancellation, low-latency BEAST gaming mode, ENx quad mics, and IPX5 sweat resistance.",
        price: 1499,
        discountPrice: 2990,
        stockQuantity: 20,
        sku: "SIL-AUDIO-002",
        images: ["https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80"],
        isAvailable: true,
      },
      {
        shopSlug: "silicon-city-mobile-world",
        categorySlug: "cables-chargers-and-powerbanks",
        name: "Mi 20000mAh 18W Fast Charging Power Bank 3i",
        slug: "mi-20000mah-fast-charging-power-bank",
        category: "Cables, Chargers & Powerbanks",
        description: "Triple port output with dual input Micro-USB & Type-C, high density lithium polymer batteries, and 12-layer advanced circuit protection.",
        price: 1999,
        discountPrice: 2499,
        stockQuantity: 15,
        sku: "SIL-PWR-003",
        images: ["https://images.unsplash.com/photo-1609592426508-cc85348b11c9?auto=format&fit=crop&w=800&q=80"],
        isAvailable: true,
      },

      // --- Rau Royal Sweets ---
      {
        shopSlug: "rau-royal-sweets-namkeen",
        categorySlug: "sweets-and-mithai",
        name: "Pure Kaju Katli Diamond Silver Foil (500g Box)",
        slug: "pure-kaju-katli-diamond-500g",
        category: "Sweets & Mithai",
        description: "Crafted with 100% premium Goan cashews and pure refined sugar, delicately finished with edible vegetarian silver vark.",
        price: 490,
        discountPrice: 560,
        stockQuantity: 30,
        sku: "ROYAL-SWEET-001",
        images: ["https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=800&q=80"],
        isAvailable: true,
      },
      {
        shopSlug: "rau-royal-sweets-namkeen",
        categorySlug: "sweets-and-mithai",
        name: "Desi Ghee Motichoor Laddoos (1 Kg Festive Pack)",
        slug: "desi-ghee-motichoor-laddoos-1kg",
        category: "Sweets & Mithai",
        description: "Mouth-melting fine gram-flour pearls fried in pure cow ghee, soaked in saffron cardamom syrup, and garnished with roasted melon seeds.",
        price: 520,
        discountPrice: 600,
        stockQuantity: 25,
        sku: "ROYAL-SWEET-002",
        images: ["https://images.unsplash.com/photo-1505253758473-96b3d5ebcd94?auto=format&fit=crop&w=800&q=80"],
        isAvailable: true,
      },

      // --- Chanderi & Maheshwari Heritage Wear - Rau ---
      {
        shopSlug: "chanderi-heritage-ethnic-wear-rau",
        categorySlug: "traditional-and-ethnic-wear",
        name: "Authentic Maheshwari Pure Silk Zari Saree (Crimson Red)",
        slug: "authentic-maheshwari-pure-silk-zari-saree",
        category: "Traditional & Ethnic Wear",
        description: "Handwoven pure silk-cotton saree with reversible Maheshwari border, intricate pallu design, and running blouse piece direct from master weavers.",
        price: 4200,
        discountPrice: 5500,
        stockQuantity: 6,
        sku: "CHAND-SAREE-001",
        images: ["https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80"],
        isAvailable: true,
      },
      {
        shopSlug: "chanderi-heritage-ethnic-wear-rau",
        categorySlug: "traditional-and-ethnic-wear",
        name: "Chanderi Handloom Kurta Set with Dupatta (Emerald Green)",
        slug: "chanderi-handloom-kurta-set-emerald",
        category: "Traditional & Ethnic Wear",
        description: "Lightweight sheer Chanderi festive kurta with fine dabka hand embroidery, scalloped organza dupatta, and matching straight trousers.",
        price: 2950,
        discountPrice: 3800,
        stockQuantity: 8,
        sku: "CHAND-KURTA-002",
        images: ["https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=800&q=80"],
        isAvailable: true,
      },

      // --- Apollo 24x7 Pharmacy - Rau ---
      {
        shopSlug: "apollo-pharmacy-wellness-rau",
        categorySlug: "medicines-and-first-aid",
        name: "Omron HEM 7120 Fully Automatic Digital BP Monitor",
        slug: "omron-hem-7120-digital-bp-monitor",
        category: "Medicines & First Aid",
        description: "Clinically validated blood pressure monitor with Intellisense technology, one-touch operation, and hypertension indicator with 3-year brand warranty.",
        price: 1949,
        discountPrice: 2450,
        stockQuantity: 12,
        sku: "APOLLO-MED-001",
        images: ["https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80"],
        isAvailable: true,
      },
      {
        shopSlug: "apollo-pharmacy-wellness-rau",
        categorySlug: "ayurvedic-and-herbal-care",
        name: "Dabur Chyawanprash 2X Immunity Booster (1 Kg)",
        slug: "dabur-chyawanprash-2x-immunity-1kg",
        category: "Ayurvedic & Herbal Care",
        description: "Time-tested Ayurvedic formulation packed with 40+ natural herbs and amla to strengthen physical strength, energy, and respiratory immunity.",
        price: 395,
        discountPrice: 450,
        stockQuantity: 30,
        sku: "APOLLO-AYUR-002",
        images: ["https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=800&q=80"],
        isAvailable: true,
      },

      // --- Campus & Nike Sports Footwear - Rau ---
      {
        shopSlug: "campus-nike-sports-footwear-rau",
        categorySlug: "athletic-and-running-shoes",
        name: "Campus OXYFIT Lightweight Men's Running Shoes",
        slug: "campus-oxyfit-lightweight-running-shoes",
        category: "Athletic & Running Shoes",
        description: "Breathable mesh upper with Springy Phylon responsive sole, memory foam insole, and reinforced heel counter for everyday jogging and gym workouts.",
        price: 1299,
        discountPrice: 1899,
        stockQuantity: 18,
        sku: "CAMPUS-SHOE-001",
        images: ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80"],
        isAvailable: true,
      },
      {
        shopSlug: "campus-nike-sports-footwear-rau",
        categorySlug: "athletic-and-running-shoes",
        name: "Nike Revolution 6 Next Nature Men's Road Running Shoes",
        slug: "nike-revolution-6-next-nature-shoes",
        category: "Athletic & Running Shoes",
        description: "Plush foam midsole delivers a smooth ride with high-abrasion traction outsole and at least 20% recycled content by weight.",
        price: 3195,
        discountPrice: 3695,
        stockQuantity: 10,
        sku: "NIKE-SHOE-002",
        images: ["https://images.unsplash.com/photo-1556906781-9a412961c28c?auto=format&fit=crop&w=800&q=80"],
        isAvailable: true,
      },

      // --- Sharma Electronics - Vijay Nagar Indore ---
      {
        shopSlug: "sharma-electronics-vijay-nagar",
        categorySlug: "smartphones-and-tablets",
        name: "Samsung Galaxy S24 5G (8GB RAM, 256GB, Onyx Black)",
        slug: "samsung-galaxy-s24-5g-256gb",
        category: "Smartphones & Tablets",
        description: "Galaxy AI powered flagship phone with Dynamic AMOLED 2X 120Hz display, pro-grade 50MP triple camera system, and all-day battery life.",
        price: 69999,
        discountPrice: 79999,
        stockQuantity: 6,
        sku: "SHAR-TECH-001",
        images: ["https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=800&q=80"],
        isAvailable: true,
      },
      {
        shopSlug: "sharma-electronics-vijay-nagar",
        categorySlug: "headphones-and-audio",
        name: "Sony WH-1000XM4 Wireless Noise Cancelling Headphones",
        slug: "sony-wh1000xm4-noise-cancelling-headphones",
        category: "Headphones & Audio",
        description: "Industry-leading dual noise sensor technology with Speak-to-Chat, multi-point connection, and 30-hour battery life on a single charge.",
        price: 22990,
        discountPrice: 29990,
        stockQuantity: 10,
        sku: "SHAR-AUDIO-002",
        images: ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80"],
        isAvailable: true,
      },

      // --- Fashion Hub - New Palasia Indore ---
      {
        shopSlug: "fashion-hub-denim-new-palasia",
        categorySlug: "mens-casuals-and-denim",
        name: "Levi's 511 Slim Fit Stretch Denim Jeans (Dark Indigo)",
        slug: "levis-511-slim-fit-stretch-jeans",
        category: "Men's Casuals & Denim",
        description: "Modern slim with room to move, crafted from premium stretch cotton denim with authentic 5-pocket styling and signature red tab.",
        price: 2399,
        discountPrice: 3199,
        stockQuantity: 24,
        sku: "FASH-DENIM-001",
        images: ["https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=800&q=80"],
        isAvailable: true,
      },

      // --- Chappan Bhog - 56 Dukan Indore ---
      {
        shopSlug: "chappan-bhog-sweets-56-dukan",
        categorySlug: "sweets-and-mithai",
        name: "Signature Indori Kesar Shrikhand (500g Tub)",
        slug: "signature-indori-kesar-shrikhand-500g",
        category: "Sweets & Mithai",
        description: "Traditional strained curd dessert infused with Kashmiri saffron strands, green cardamom, roasted pistachios, and almonds.",
        price: 220,
        discountPrice: 250,
        stockQuantity: 30,
        sku: "CHAPPAN-SHRI-001",
        images: ["https://images.unsplash.com/photo-1505253758473-96b3d5ebcd94?auto=format&fit=crop&w=800&q=80"],
        isAvailable: true,
      },
    ];

    let seededProductCount = 0;
    for (const p of productsData) {
      const shop = shopMap.get(p.shopSlug);
      if (!shop) {
        console.warn(`Shop with slug '${p.shopSlug}' not found. Skipping product '${p.name}'.`);
        continue;
      }

      const categoryId = catMapBySlug.get(p.categorySlug) || null;

      let product = await Product.findOne({ where: { slug: p.slug } });
      const productPayload = {
        shopId: shop.id,
        categoryId,
        name: p.name,
        slug: p.slug,
        category: p.category,
        description: p.description,
        price: p.price,
        discountPrice: p.discountPrice,
        stockQuantity: p.stockQuantity,
        sku: p.sku,
        images: p.images,
        isAvailable: p.isAvailable,
      };

      if (!product) {
        product = await Product.create(productPayload);
      } else {
        await product.update(productPayload);
      }
      seededProductCount++;
    }
    console.log(`✓ Seeded ${seededProductCount} products across ${shopMap.size} shops with valid Category Master references.`);

    // =========================================================================
    // 5. SEED INITIAL VERIFIED REVIEWS
    // =========================================================================
    console.log("⭐ Seeding Initial Reviews & Moderation Test Cases...");
    const customerUser = userMap.get("aarav@customer.com") || (await User.findOne({ where: { role: "customer" } }))!;
    const superAdminUser = userMap.get("superadmin@findshop.com") || (await User.findOne({ where: { role: "super_admin" } }))!;
    const rauKirana = shopMap.get("rau-organic-fresh-supermarket");
    const rauMobile = shopMap.get("silicon-city-mobile-world");
    const rauSweets = shopMap.get("rau-royal-sweets-namkeen");

    if (rauKirana) {
      await Review.upsert({
        userId: customerUser.id,
        shopId: rauKirana.id,
        targetType: "SHOP",
        rating: 5,
        title: "Best organic groceries and dairy in Rau!",
        comment: "Found pure Gir cow A2 ghee and cold pressed mustard oil. The owner Mukesh was very humble and delivered right to our society in 20 minutes.",
        authorName: "Aarav Patel",
        merchantReply: "Thank you so much Aarav ji! We take pride in sourcing unadulterated farm goods directly from Malwa farmers.",
        merchantRepliedAt: new Date(),
        status: "PUBLISHED",
      });
      await reviewService.recalculateRatings("SHOP", rauKirana.id);
    }

    if (rauMobile) {
      // 1. Legitimate 5-star review
      await Review.upsert({
        userId: customerUser.id,
        shopId: rauMobile.id,
        targetType: "SHOP",
        rating: 5,
        title: "Genuine OnePlus stock with official brand warranty!",
        comment: "Bought OnePlus 12R here. Best retail pricing in Rau area and got free tempered glass installation.",
        authorName: "Rahul Sharma",
        status: "PUBLISHED",
      });

      // 2. Reported review test case (Shop Owner reported to Super Admin)
      await Review.upsert({
        userId: superAdminUser.id,
        shopId: rauMobile.id,
        targetType: "SHOP",
        rating: 1,
        title: "Refused unreasonable discount",
        comment: "Demanded 30% flat discount below cost price and they politely declined.",
        authorName: "Anonymous Critic",
        isReported: true,
        reportReason: "Customer requested unviable below-cost discount and threatened with bad review when declined.",
        reportedByShopId: rauMobile.id,
        reportedAt: new Date(),
        status: "PUBLISHED",
      });
      await reviewService.recalculateRatings("SHOP", rauMobile.id);
    }

    if (rauSweets) {
      await Review.upsert({
        userId: customerUser.id,
        shopId: rauSweets.id,
        targetType: "SHOP",
        rating: 5,
        title: "Authentic Indori Poha & Kaju Katli!",
        comment: "Freshly made desi ghee sweets and crisp namkeen. A must-visit whenever crossing Rau circle.",
        authorName: "Pooja Verma",
        merchantReply: "Dhanyawaad Pooja ji! Looking forward to serving your family again.",
        merchantRepliedAt: new Date(),
        status: "PUBLISHED",
      });
      await reviewService.recalculateRatings("SHOP", rauSweets.id);
    }

    // Product review for OnePlus 12R
    const oneplus = await Product.findOne({ where: { slug: "oneplus-12r-5g-iron-gray" } });
    if (oneplus) {
      await Review.upsert({
        userId: customerUser.id,
        shopId: oneplus.shopId,
        productId: oneplus.id,
        targetType: "PRODUCT",
        rating: 5,
        title: "Smooth 120Hz display and beast battery life",
        comment: "Switched from older phone, super fast 100W charging in 25 mins. Verified genuine IMEI and brand bill.",
        authorName: "Aarav Patel",
        status: "PUBLISHED",
      });
      await reviewService.recalculateRatings("PRODUCT", oneplus.shopId, oneplus.id);
    }

    console.log("✓ Seeded realistic reviews with merchant replies and moderation report flags.");

    console.log("\n🎉 Local Database Seeder Finished Successfully! High-quality data ready for testing on website.");
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Database seeding failed:", error);
    await sequelize.close();
    process.exit(1);
  }
}

if (require.main === module) {
  runLocalSeed();
}
