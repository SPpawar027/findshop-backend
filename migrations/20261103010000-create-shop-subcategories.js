"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableExists = await queryInterface.tableExists("shop_subcategories").catch(() => false);
    if (!tableExists) {
      await queryInterface.createTable("shop_subcategories", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        shop_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: "shops",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        subcategory_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: "categories",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        sort_order: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        is_visible: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
      });

      await queryInterface.addConstraint("shop_subcategories", {
        fields: ["shop_id", "subcategory_id"],
        type: "unique",
        name: "uq_shop_subcategories_shop_subcat",
      });

      await queryInterface.addIndex("shop_subcategories", ["shop_id", "sort_order"], {
        name: "idx_shop_subcategories_shop_sort",
      });

      await queryInterface.addIndex("shop_subcategories", ["subcategory_id"], {
        name: "idx_shop_subcategories_subcat",
      });
    }
  },

  async down(queryInterface) {
    const tableExists = await queryInterface.tableExists("shop_subcategories").catch(() => false);
    if (tableExists) {
      await queryInterface.dropTable("shop_subcategories");
    }
  },
};

