import bcrypt from "bcryptjs";
import { sequelize } from "../config/database";
import { User } from "../modules/users/user.model";
import { Shop } from "../modules/shops/shop.model";
import { Product } from "../modules/products/product.model";
import { LegalDocument } from "../modules/legal/legal.model";
import { setupAssociations } from "./associations";
import { DEFAULT_LEGAL_DOCS } from "../modules/legal/legal.defaults";

export async function runSeed() {
  console.log("🌱 Starting FindShop Database Seeder...");

  try {
    setupAssociations();
    await sequelize.authenticate();
    console.log(" Connected to PostgreSQL database.");

    const defaultPasswordHash = await bcrypt.hash("Findshop123!", 10);

    // =========================================================================
    // 1. SEED USERS
    // =========================================================================
    console.log(" Seeding Users...");

    const usersData = [
      {
        name: "Platform Superadmin",
        email: "superadmin@findshop.com",
        passwordHash: defaultPasswordHash,
        phone: "+919800000001",
        role: "super_admin" as const,
        isActive: true,
      },
      {
        name: "Rajesh Sharma",
        email: "rajesh@kirana.com",
        passwordHash: defaultPasswordHash,
        phone: "+919876543210",
        role: "shop_admin" as const,
        isActive: true,
      },
      {
        name: "Priya Agrawal",
        email: "priya@mahalaxmi.com",
        passwordHash: defaultPasswordHash,
        phone: "+917141234567",
        role: "shop_admin" as const,
        isActive: true,
      },
      {
        name: "Balaji Rathore",
        email: "balaji@crafts.com",
        passwordHash: defaultPasswordHash,
        phone: "+919425012345",
        role: "shop_admin" as const,
        isActive: true,
      },
      {
        name: "Vikram Jain",
        email: "vikram@citymobile.com",
        passwordHash: defaultPasswordHash,
        phone: "+919876543211",
        role: "shop_admin" as const,
        isActive: true,
      },
      {
        name: "Arjun Nair",
        email: "arjun@sportsplus.com",
        passwordHash: defaultPasswordHash,
        phone: "+919876543212",
        role: "shop_admin" as const,
        isActive: true,
      },
      {
        name: "Suresh Gupta",
        email: "suresh@bikanervala.com",
        passwordHash: defaultPasswordHash,
        phone: "+919876543213",
        role: "shop_admin" as const,
        isActive: true,
      },
      {
        name: "Dr. Ritu Verma",
        email: "ritu@apollo.com",
        passwordHash: defaultPasswordHash,
        phone: "+919876543214",
        role: "shop_admin" as const,
        isActive: true,
      },
      {
        name: "Aarav Patel",
        email: "aarav@customer.com",
        passwordHash: defaultPasswordHash,
        phone: "+919800000002",
        role: "customer" as const,
        isActive: true,
      },
    ];

    const userMap = new Map<string, User>();

    for (const u of usersData) {
      let user = await User.findOne({ where: { email: u.email } });
      if (!user) {
        user = await User.create(u);
      } else {
        await user.update({
          name: u.name,
          phone: u.phone,
          role: u.role,
          isActive: u.isActive,
          passwordHash: defaultPasswordHash,
        });
      }
      userMap.set(u.email, user);
    }
    console.log(`✓ Seeded ${userMap.size} users.`);

    // =========================================================================
    // 2. SEED SHOPS
    // =========================================================================
    console.log(" Seeding Shops...");

    const standardWeeklyHours = {
      monday: { open: "09:30", close: "21:30", closed: false },
      tuesday: { open: "09:30", close: "21:30", closed: false },
      wednesday: { open: "09:30", close: "21:30", closed: false },
      thursday: { open: "09:30", close: "21:30", closed: false },
      friday: { open: "09:30", close: "21:30", closed: false },
      saturday: { open: "09:30", close: "22:00", closed: false },
      sunday: { open: "10:30", close: "20:30", closed: false },
    };

    const shopsData = [
      {
        ownerEmail: "priya@mahalaxmi.com",
        name: "Mahalaxmi Heritage Fabrics & Saree Studio",
        slug: "mahalaxmi-heritage-fabrics",
        category: "Traditional & Ethnic Wear",
        description:
          "Known for mastercraft Banarasi zaris, pure Chanderi silhouettes, bridal ensembles, and handwoven festive sarees directly from master artisan clusters.",
        address: "Shop 14, Ganj Bazaar Main Street, Near Old Town Clock Tower",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        latitude: 12.9716,
        longitude: 77.5946,
        phone: "+917141234567",
        email: "contact@mahalaxmisarees.com",
        rating: 4.8,
        reviewCount: 142,
        isVerified: true,
        isOpen: true,
        openingHours: standardWeeklyHours,
        bannerUrl: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1200&q=80",
        logoUrl: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=400&q=80",
      },
      {
        ownerEmail: "balaji@crafts.com",
        name: "Shree Balaji Gift & Wooden Toys",
        slug: "shree-balaji-gifts",
        category: "Gifts & Handicrafts",
        description:
          "Family-owned boutique known for handcrafted wooden collectibles, brass inlay jewelry boxes, home decor, and festival gift packs.",
        address: "Station Road, Opp. City Clock Tower, Commercial District",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        latitude: 12.975,
        longitude: 77.601,
        phone: "+919425012345",
        email: "balajigifts@gmail.com",
        rating: 4.9,
        reviewCount: 88,
        isVerified: true,
        isOpen: true,
        openingHours: standardWeeklyHours,
        bannerUrl: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1200&q=80",
        logoUrl: "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=400&q=80",
      },
      {
        ownerEmail: "vikram@citymobile.com",
        name: "City Mobile Hub & Electronics",
        slug: "city-mobile-hub",
        category: "Smartphones & Electronics",
        description:
          "Central tech destination featuring authentic accessories from top brands, fast tempered glass fitting, on-the-spot battery replacement, and warranty services.",
        address: "Shop 8, Commercial Complex, Central Avenue",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        latitude: 12.978,
        longitude: 77.59,
        phone: "+919876543211",
        email: "support@citymobile.com",
        rating: 4.6,
        reviewCount: 210,
        isVerified: true,
        isOpen: true,
        openingHours: standardWeeklyHours,
        bannerUrl: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80",
        logoUrl: "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&w=400&q=80",
      },
      {
        ownerEmail: "arjun@sportsplus.com",
        name: "Nike Authorized Sports Hub",
        slug: "nike-sports-hub",
        category: "Footwear & Sportswear",
        description:
          "Official athletic footwear store stocking genuine running sneakers, training shorts, Dri-FIT activewear, and athletic backpacks.",
        address: "Near Railway Station Road Plaza, Ground Floor",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        latitude: 12.969,
        longitude: 77.61,
        phone: "+919876543212",
        email: "support@nikehub.com",
        rating: 4.8,
        reviewCount: 94,
        isVerified: true,
        isOpen: true,
        openingHours: standardWeeklyHours,
        bannerUrl: "https://images.unsplash.com/photo-1556906781-9a412961c28c?auto=format&fit=crop&w=1200&q=80",
        logoUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80",
      },
      {
        ownerEmail: "rajesh@kirana.com",
        name: "Sharma Organic Grocery & Daily Needs",
        slug: "sharma-organic-grocery",
        category: "Grocery & Supermarket",
        description:
          "Certified organic farm-fresh staples, unadulterated cold-pressed oils, premium basmati rice, dry fruits, and Vedic A2 Gir cow ghee.",
        address: "12th Main, Indiranagar, 2nd Stage",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560038",
        latitude: 12.9784,
        longitude: 77.6408,
        phone: "+919876543210",
        email: "rajesh@kirana.com",
        rating: 4.8,
        reviewCount: 120,
        isVerified: true,
        isOpen: true,
        openingHours: standardWeeklyHours,
        bannerUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80",
        logoUrl: "https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=400&q=80",
      },
      {
        ownerEmail: "suresh@bikanervala.com",
        name: "Bikanervala Sweets & Savouries",
        slug: "bikanervala-sweets",
        category: "Sweets & Confectionery",
        description:
          "Traditional pure ghee Indian sweets, authentic Bikaneri namkeen, rich dry fruit hampers, festive gift boxes, and freshly fried snacks.",
        address: "45, Commercial Street, Tasker Town",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        latitude: 12.982,
        longitude: 77.608,
        phone: "+919876543213",
        email: "orders@bikanervala.com",
        rating: 4.7,
        reviewCount: 312,
        isVerified: true,
        isOpen: true,
        openingHours: standardWeeklyHours,
        bannerUrl: "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=1200&q=80",
        logoUrl: "https://images.unsplash.com/photo-1505253758473-96b3d5ebcd94?auto=format&fit=crop&w=400&q=80",
      },
      {
        ownerEmail: "ritu@apollo.com",
        name: "Apollo Pharmacy & Healthcare",
        slug: "apollo-pharmacy-wellness",
        category: "Pharmacy & Health",
        description:
          "24/7 licensed retail pharmacy with complete prescription medications, genuine wellness supplements, baby care essentials, and diagnostic monitoring devices.",
        address: "100 Feet Road, 4th Block, Koramangala",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560034",
        latitude: 12.9352,
        longitude: 77.6245,
        phone: "+919876543214",
        email: "care@apollopharmacy.com",
        rating: 4.9,
        reviewCount: 185,
        isVerified: true,
        isOpen: true,
        openingHours: standardWeeklyHours,
        bannerUrl: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=1200&q=80",
        logoUrl: "https://images.unsplash.com/photo-1631549916768-4119b2e5f926?auto=format&fit=crop&w=400&q=80",
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
    console.log(`✓ Seeded ${shopMap.size} shops.`);

    // =========================================================================
    // 3. SEED PRODUCTS
    // =========================================================================
    console.log(" Seeding Products...");

    const productsData = [
      // ---------------- Traditional & Ethnic Wear (Mahalaxmi) ----------------
      {
        shopSlug: "mahalaxmi-heritage-fabrics",
        name: "Pure Katan Silk Banarasi Saree with Antique Gold Zari",
        slug: "pure-katan-silk-banarasi-saree",
        category: "Bridal & Traditional Sarees",
        description:
          "Hand-woven bridal Katan silk saree featuring intricate floral kadwa jangla jaal in rich crimson red with certified pure zari border and heavy pallu.",
        price: 8499,
        discountPrice: 10999,
        stockQuantity: 4,
        sku: "MAHA-KATAN-001",
        images: [
          "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80",
          "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80",
        ],
        isAvailable: true,
      },
      {
        shopSlug: "mahalaxmi-heritage-fabrics",
        name: "Chanderi Silk Festive Kurta Set with Zardozi Neckline",
        slug: "chanderi-silk-festive-kurta-set",
        category: "Suits & Ensembles",
        description:
          "Handcrafted emerald green Chanderi silk kurta with fine zardozi dabka embroidery, pure organza scalloped dupatta, and matching straight pants.",
        price: 3250,
        discountPrice: 3999,
        stockQuantity: 6,
        sku: "MAHA-CHAND-002",
        images: [
          "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=800&q=80",
          "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=800&q=80",
        ],
        isAvailable: true,
      },
      {
        shopSlug: "mahalaxmi-heritage-fabrics",
        name: "Handwoven Pure Tussar Silk Embroidered Dupatta",
        slug: "handwoven-pure-tussar-silk-dupatta",
        category: "Dupattas & Stoles",
        description:
          "Natural beige Tussar silk stole adorned with traditional Kantha thread embroidery and pompom tassel borders.",
        price: 1450,
        discountPrice: 1800,
        stockQuantity: 12,
        sku: "MAHA-TUSSAR-003",
        images: [
          "https://images.unsplash.com/photo-1607522370275-f14206abe5d3?auto=format&fit=crop&w=800&q=80",
        ],
        isAvailable: true,
      },
      {
        shopSlug: "mahalaxmi-heritage-fabrics",
        name: "Men Royal Jacquard Sherwani Jacket with Brocade Weave",
        slug: "men-royal-jacquard-sherwani-jacket",
        category: "Men Ethnic Wear",
        description:
          "Regal royal blue jacquard tailored jacket featuring mandarin collar, metallic crest buttons, and fine inner lining.",
        price: 5999,
        discountPrice: 7499,
        stockQuantity: 5,
        sku: "MAHA-SHERW-004",
        images: [
          "https://images.unsplash.com/photo-1597983073493-88cd35cf93b0?auto=format&fit=crop&w=800&q=80",
        ],
        isAvailable: true,
      },

      // ---------------- Gifts & Handicrafts (Shree Balaji) ----------------
      {
        shopSlug: "shree-balaji-gifts",
        name: "Handcrafted Sheesham Wood Jewelry Box with Brass Inlay",
        slug: "handcrafted-sheesham-wood-jewelry-box",
        category: "Gifts & Handicrafts",
        description:
          "Authentic handcrafted Sheesham wooden jewelry box featuring detailed brass floral inlay work, royal velvet lined compartments, ring slots, and smooth wax luster finish.",
        price: 850,
        discountPrice: 1100,
        stockQuantity: 8,
        sku: "BALAJI-BOX-001",
        images: [
          "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80",
          "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80",
        ],
        isAvailable: true,
      },
      {
        shopSlug: "shree-balaji-gifts",
        name: "Vintage Brass Lord Ganesha Idol with Antique Patina",
        slug: "vintage-brass-lord-ganesha-idol",
        category: "Home Decor & Idols",
        description:
          "Solid cast brass Vinayaka figurine with intricate crown detailing and polished protective protective clear coat.",
        price: 1299,
        discountPrice: 1699,
        stockQuantity: 10,
        sku: "BALAJI-GANESHA-002",
        images: [
          "https://images.unsplash.com/photo-1567591414240-e26090288eb0?auto=format&fit=crop&w=800&q=80",
        ],
        isAvailable: true,
      },
      {
        shopSlug: "shree-balaji-gifts",
        name: "Handcrafted Wooden Chess Set with Magnetic Foldable Board",
        slug: "wooden-chess-set-magnetic-foldable",
        category: "Wooden Games & Curios",
        description:
          "12x12 inch natural rosewood and boxwood carved pieces with interior velvet lined slots for secure game storage.",
        price: 1499,
        discountPrice: 1999,
        stockQuantity: 7,
        sku: "BALAJI-CHESS-003",
        images: [
          "https://images.unsplash.com/photo-1529699211952-734e80c4d42b?auto=format&fit=crop&w=800&q=80",
        ],
        isAvailable: true,
      },

      // ---------------- Smartphones & Electronics (City Mobile) ----------------
      {
        shopSlug: "city-mobile-hub",
        name: "Noise-Cancelling Wireless Bluetooth Earbuds Pro",
        slug: "noise-cancelling-wireless-earbuds-pro",
        category: "Audio & Wearables",
        description:
          "Active Noise Cancellation (ANC) with 32-hour playback, IPX5 water resistance, ultra-low latency gaming mode, and dual mic ENC for crystal clear calling.",
        price: 2199,
        discountPrice: 3999,
        stockQuantity: 18,
        sku: "CITY-EARBUD-001",
        images: [
          "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80",
          "https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?auto=format&fit=crop&w=800&q=80",
        ],
        isAvailable: true,
      },
      {
        shopSlug: "city-mobile-hub",
        name: "65W GaN Fast Charger Multi-Port (Type-C + USB-A)",
        slug: "65w-gan-fast-charger-multiport",
        category: "Charging Accessories",
        description:
          "Ultra-compact Gallium Nitride (GaN) high-speed charger capable of powering MacBooks, iPads, iPhones, and Android smartphones at top speed.",
        price: 1299,
        discountPrice: 1899,
        stockQuantity: 25,
        sku: "CITY-GAN65-002",
        images: [
          "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=800&q=80",
        ],
        isAvailable: true,
      },
      {
        shopSlug: "city-mobile-hub",
        name: "10000mAh Magnetic Wireless Power Bank with Kickstand",
        slug: "10000mah-magnetic-wireless-powerbank",
        category: "Power Banks",
        description:
          "Snap-on magnetic 15W wireless charging pad with 20W PD Type-C output and foldable viewing kickstand.",
        price: 1799,
        discountPrice: 2499,
        stockQuantity: 14,
        sku: "CITY-PB10K-003",
        images: [
          "https://images.unsplash.com/photo-1609592807664-88f5fef87201?auto=format&fit=crop&w=800&q=80",
        ],
        isAvailable: true,
      },

      // ---------------- Footwear & Sportswear (Nike Sports Hub) ----------------
      {
        shopSlug: "nike-sports-hub",
        name: "Air Pegasus Lightweight Road Running Shoes",
        slug: "air-pegasus-road-running-shoes",
        category: "Running Footwear",
        description:
          "Engineered breathable mesh upper with Zoom Air cushioning responsive foam midsole designed for marathon and daily road workouts.",
        price: 7495,
        discountPrice: 9995,
        stockQuantity: 9,
        sku: "NIKE-PEGASUS-001",
        images: [
          "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80",
          "https://images.unsplash.com/photo-1556906781-9a412961c28c?auto=format&fit=crop&w=800&q=80",
        ],
        isAvailable: true,
      },
      {
        shopSlug: "nike-sports-hub",
        name: "Dri-FIT Breathe Athletic Training T-Shirt",
        slug: "drifit-breathe-athletic-training-tshirt",
        category: "Training Apparel",
        description:
          "Moisture-wicking microfiber polyester jersey designed to keep you cool during intense gym sessions and outdoor sports.",
        price: 1495,
        discountPrice: 1995,
        stockQuantity: 20,
        sku: "NIKE-DRIFIT-002",
        images: [
          "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80",
        ],
        isAvailable: true,
      },
      {
        shopSlug: "nike-sports-hub",
        name: "Water-Resistant Gym & Sports Training Duffle Bag 35L",
        slug: "water-resistant-sports-duffle-bag",
        category: "Bags & Backpacks",
        description:
          "Spacious 35-liter duffle featuring separate ventilated shoe compartment, padded shoulder strap, and waterproof base.",
        price: 2495,
        discountPrice: 3295,
        stockQuantity: 11,
        sku: "NIKE-DUFFLE-003",
        images: [
          "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80",
        ],
        isAvailable: true,
      },

      // ---------------- Grocery & Daily Needs (Sharma Organic) ----------------
      {
        shopSlug: "sharma-organic-grocery",
        name: "Organic Basmati Rice 5kg (Aged Long Grain)",
        slug: "organic-basmati-rice-5kg",
        category: "Grains & Pulses",
        description:
          "2-year aged naturally fragrant long grain Himalayan basmati rice. Non-GMO, pesticide-free, and perfect for royal biryanis and pulao.",
        price: 399,
        discountPrice: 499,
        stockQuantity: 30,
        sku: "SHARMA-RICE-001",
        images: [
          "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80",
        ],
        isAvailable: true,
      },
      {
        shopSlug: "sharma-organic-grocery",
        name: "Cold Pressed Kachi Ghani Mustard Oil 1L",
        slug: "mustard-oil-1l",
        category: "Edible Oils & Ghee",
        description:
          "100% pure cold-pressed organic yellow mustard oil extracted on wooden kolhus. Rich in natural pungency, antioxidants, and Omega-3.",
        price: 180,
        discountPrice: 220,
        stockQuantity: 24,
        sku: "SHARMA-OIL-002",
        images: [
          "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=800&q=80",
        ],
        isAvailable: true,
      },
      {
        shopSlug: "sharma-organic-grocery",
        name: "Vedic A2 Gir Cow Bilona Cultured Ghee 500ml",
        slug: "vedic-a2-gir-cow-bilona-ghee",
        category: "Edible Oils & Ghee",
        description:
          "Hand-churned grass-fed Gir cow A2 cultured ghee prepared using ancient wood-fire Bilona method in clay pots. Golden granular texture and divine aroma.",
        price: 950,
        discountPrice: 1150,
        stockQuantity: 16,
        sku: "SHARMA-GHEE-003",
        images: [
          "https://images.unsplash.com/photo-1631729371254-42c2892f0e6e?auto=format&fit=crop&w=800&q=80",
        ],
        isAvailable: true,
      },
      {
        shopSlug: "sharma-organic-grocery",
        name: "Organic Kashmiri Mongra Saffron (Kesar) 1g",
        slug: "organic-kashmiri-mongra-saffron",
        category: "Spices & Condiments",
        description:
          "Grade A1 authentic Pampore Kashmiri saffron threads with deep crimson color, potent aroma, and high crocin content.",
        price: 350,
        discountPrice: 420,
        stockQuantity: 40,
        sku: "SHARMA-KESAR-004",
        images: [
          "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80",
        ],
        isAvailable: true,
      },

      // ---------------- Sweets & Confectionery (Bikanervala) ----------------
      {
        shopSlug: "bikanervala-sweets",
        name: "Premium Silver Vark Kaju Katli Gift Pack 500g",
        slug: "premium-silver-vark-kaju-katli-500g",
        category: "Traditional Sweets",
        description:
          "Handmade diamond cashew confectionery made from top-grade Goan cashews, refined cane sugar, and certified vegetarian edible silver foil.",
        price: 550,
        discountPrice: 620,
        stockQuantity: 22,
        sku: "BIKANER-KAJU-001",
        images: [
          "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=800&q=80",
        ],
        isAvailable: true,
      },
      {
        shopSlug: "bikanervala-sweets",
        name: "Pure Desi Ghee Motichoor Ladoo 500g",
        slug: "pure-desi-ghee-motichoor-ladoo-500g",
        category: "Traditional Sweets",
        description:
          "Soft melt-in-mouth gram flour pearls cooked in aromatic pure desi ghee, infused with saffron strands and cardamom seeds.",
        price: 380,
        discountPrice: 420,
        stockQuantity: 18,
        sku: "BIKANER-LADOO-002",
        images: [
          "https://images.unsplash.com/photo-1505253758473-96b3d5ebcd94?auto=format&fit=crop&w=800&q=80",
        ],
        isAvailable: true,
      },
      {
        shopSlug: "bikanervala-sweets",
        name: "Crispy Bikaneri Bhujia Sev 1kg Family Pack",
        slug: "crispy-bikaneri-bhujia-sev-1kg",
        category: "Namkeen & Snacks",
        description:
          "Original Rajasthani moth dal and gram flour spiced crispy bhujia seasoned with black pepper, cloves, and asafoetida.",
        price: 290,
        discountPrice: 340,
        stockQuantity: 35,
        sku: "BIKANER-BHUJIA-003",
        images: [
          "https://images.unsplash.com/photo-1567337710282-00832b415979?auto=format&fit=crop&w=800&q=80",
        ],
        isAvailable: true,
      },

      // ---------------- Pharmacy & Health (Apollo) ----------------
      {
        shopSlug: "apollo-pharmacy-wellness",
        name: "Automatic Digital Blood Pressure Monitor with Arm Cuff",
        slug: "digital-blood-pressure-monitor-arm-cuff",
        category: "Diagnostic Equipment",
        description:
          "Clinically validated upper-arm BP monitor with hypertension indicator, large backlit display, and dual-user memory tracking (2x90 readings).",
        price: 1499,
        discountPrice: 2199,
        stockQuantity: 15,
        sku: "APOLLO-BP-001",
        images: [
          "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80",
        ],
        isAvailable: true,
      },
      {
        shopSlug: "apollo-pharmacy-wellness",
        name: "Pure Ashwagandha Root Extract Immunity Capsules 60s",
        slug: "ashwagandha-root-extract-capsules",
        category: "Ayurvedic & Wellness",
        description:
          "Standardized withanolides herbal supplement formulated to reduce stress, improve sleep quality, and boost physical stamina naturally.",
        price: 340,
        discountPrice: 450,
        stockQuantity: 28,
        sku: "APOLLO-ASHWA-002",
        images: [
          "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?auto=format&fit=crop&w=800&q=80",
        ],
        isAvailable: true,
      },
      {
        shopSlug: "apollo-pharmacy-wellness",
        name: "First Aid Emergency Medical Care Kit (Home & Travel)",
        slug: "first-aid-emergency-medical-kit",
        category: "First Aid & Wound Care",
        description:
          "Comprehensive medical pouch packed with antiseptic solutions, sterile gauze rolls, adhesive bandages, scissors, pain relief spray, and medical tape.",
        price: 550,
        discountPrice: 699,
        stockQuantity: 20,
        sku: "APOLLO-FA-003",
        images: [
          "https://images.unsplash.com/photo-1603398938378-e54eab446dde?auto=format&fit=crop&w=800&q=80",
        ],
        isAvailable: true,
      },
    ];

    let seededProductCount = 0;

    for (const p of productsData) {
      const shop = shopMap.get(p.shopSlug);
      if (!shop) continue;

      let product = await Product.findOne({ where: { slug: p.slug } });
      const productPayload = {
        shopId: shop.id,
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
    console.log(`✓ Seeded ${seededProductCount} products across ${shopMap.size} shops.`);

    // =========================================================================
    // 4. SEED LEGAL DOCUMENTS
    // =========================================================================
    console.log(" Seeding Legal Documents...");

    const legalDocs = [
      {
        id: "privacy-policy",
        title: DEFAULT_LEGAL_DOCS["privacy-policy"].title,
        content: DEFAULT_LEGAL_DOCS["privacy-policy"].content,
        version: "1.0.0",
        lastUpdatedBy: "Super Admin",
      },
      {
        id: "terms-and-conditions",
        title: DEFAULT_LEGAL_DOCS["terms-and-conditions"].title,
        content: DEFAULT_LEGAL_DOCS["terms-and-conditions"].content,
        version: "1.0.0",
        lastUpdatedBy: "Super Admin",
      },
    ];

    // Ensure table exists even if migrations were pending
    await LegalDocument.sync();

    for (const doc of legalDocs) {
      let existing = await LegalDocument.findByPk(doc.id);
      if (!existing) {
        await LegalDocument.create(doc);
      } else if (!existing.content) {
        await existing.update({ content: doc.content });
      }
    }
    console.log("✓ Seeded Legal Documents (Privacy Policy & Terms and Conditions).");

    console.log("\n Database Seeding Completed Successfully! 🎉");
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Database seeding failed:", error);
    await sequelize.close();
    process.exit(1);
  }
}

if (require.main === module) {
  runSeed();
}
