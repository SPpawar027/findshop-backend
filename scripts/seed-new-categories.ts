import "dotenv/config";
import { sequelize } from "../src/config/database";
import { Category } from "../src/modules/categories/category.model";
import { ShopSubcategory } from "../src/modules/categories/shopSubcategory.model";
import { Product } from "../src/modules/products/product.model";
import { DEFAULT_PRIMARY_CATEGORIES } from "../src/modules/categories/category.defaults";

async function seedNewCategories() {
  const transaction = await sequelize.transaction();

  try {
    console.log("=================================================");
    console.log("🌱 STARTING CATEGORY DATABASE REPLACEMENT (NEON)");
    console.log("=================================================");

    await sequelize.authenticate();
    console.log("✅ Authenticated with Neon database successfully.");

    // 1. Temporarily clear categoryId references in products
    console.log("Step 1: Unlinking existing products from old categories...");
    const [updatedProducts] = await sequelize.query(
      'UPDATE products SET "categoryId" = NULL WHERE "categoryId" IS NOT NULL;',
      { transaction }
    );
    console.log(` - Unlinked products.`);

    // 2. Clear shop_subcategories table
    console.log("Step 2: Clearing shop_subcategories table...");
    await sequelize.query('DELETE FROM shop_subcategories;', { transaction });
    console.log(` - shop_subcategories cleared.`);

    // 3. Delete existing categories (subcategories first, then parents)
    console.log("Step 3: Deleting old categories from categories table...");
    await sequelize.query('DELETE FROM categories WHERE level = 2;', { transaction });
    await sequelize.query('DELETE FROM categories WHERE level = 1;', { transaction });
    await sequelize.query('DELETE FROM categories;', { transaction });
    console.log(` - All old categories removed.`);

    // 4. Insert New 5 Primary Categories and 62 Subcategories
    console.log("Step 4: Inserting new Primary Categories and Subcategories...");
    let l1Count = 0;
    let l2Count = 0;

    for (const catData of DEFAULT_PRIMARY_CATEGORIES) {
      // Create L1 Category
      const [parent] = await Category.findOrCreate({
        where: { slug: catData.slug },
        defaults: {
          name: catData.name,
          slug: catData.slug,
          description: catData.description,
          level: 1,
          parentId: null,
          icon: catData.icon,
          emoji: catData.emoji,
          orderIndex: catData.orderIndex,
          isActive: true,
        },
        transaction,
      });
      l1Count++;

      console.log(`\n📁 Created Main Category: "${parent.name}" (ID: ${parent.id}, ${catData.subcategories.length} subcategories)`);

      // Create L2 Subcategories
      for (const sub of catData.subcategories) {
        await Category.create(
          {
            name: sub.name,
            slug: sub.slug,
            description: sub.description,
            level: 2,
            parentId: parent.id,
            icon: sub.icon,
            emoji: sub.emoji,
            orderIndex: sub.orderIndex,
            isActive: true,
          },
          { transaction }
        );
        l2Count++;
      }
    }

    // 5. Remap existing products if possible
    console.log("\nStep 5: Remapping existing products to matching new subcategories...");
    // If product is named custom hamper, link to Gift Hampers
    const giftHampers = await Category.findOne({ where: { slug: "gift-hampers" }, transaction });
    if (giftHampers) {
      await sequelize.query(
        `UPDATE products SET "categoryId" = ${giftHampers.id}, category = 'Gift Hampers' WHERE name ILIKE '%hamper%';`,
        { transaction }
      );
    }
    // If product is Laptop Bag, link to Mobile Accessories or Sports Bags
    const phoneCovers = await Category.findOne({ where: { slug: "sports-bags" }, transaction });
    if (phoneCovers) {
      await sequelize.query(
        `UPDATE products SET "categoryId" = ${phoneCovers.id}, category = 'Sports Bags' WHERE name ILIKE '%laptop bag%';`,
        { transaction }
      );
    }

    await transaction.commit();
    console.log("\n=================================================");
    console.log("🎉 TRANSACTION COMMITTED SUCCESSFULLY!");
    console.log(`✅ Main Categories (L1) Created: ${l1Count}`);
    console.log(`✅ Subcategories (L2) Created:   ${l2Count}`);
    console.log(`✅ Total Categories Created:     ${l1Count + l2Count}`);
    console.log("=================================================");

    // Verify final state
    const breakdown = await Category.findAll({
      where: { level: 1 },
      include: [
        {
          model: Category,
          as: "subcategories",
          attributes: ["id", "name", "slug"],
        },
      ],
      order: [
        ["orderIndex", "ASC"],
        [{ model: Category, as: "subcategories" }, "orderIndex", "ASC"],
      ],
    });

    console.log("\n📊 FINAL DATABASE VERIFICATION BREAKDOWN:");
    for (const main of breakdown) {
      const subs = (main as any).subcategories || [];
      console.log(`\n• [${main.emoji} ${main.name}] (${subs.length} subcategories):`);
      subs.forEach((s: any, idx: number) => {
        console.log(`    ${idx + 1}. ${s.name} (slug: ${s.slug})`);
      });
    }

    await sequelize.close();
    process.exit(0);
  } catch (err) {
    await transaction.rollback();
    console.error("❌ Transaction rolled back due to error:", err);
    await sequelize.close();
    process.exit(1);
  }
}

seedNewCategories();

