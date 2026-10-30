"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Ensure products table has rating and reviewCount columns
    const productTableInfo = await queryInterface.describeTable("products");
    if (!productTableInfo.rating) {
      await queryInterface.addColumn("products", "rating", {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: false,
        defaultValue: 0,
      });
    }
    if (!productTableInfo.reviewCount) {
      await queryInterface.addColumn("products", "reviewCount", {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }

    // 2. Create reviews table
    const tableExists = await queryInterface.tableExists("reviews").catch(() => false);
    if (!tableExists) {
      await queryInterface.createTable("reviews", {
        id: {
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        userId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: "users",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        shopId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: "shops",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        productId: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: "products",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        targetType: {
          type: Sequelize.STRING(20),
          allowNull: false,
          defaultValue: "SHOP",
        },
        rating: {
          type: Sequelize.SMALLINT,
          allowNull: false,
        },
        title: {
          type: Sequelize.STRING(150),
          allowNull: true,
        },
        comment: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        authorName: {
          type: Sequelize.STRING(100),
          allowNull: true,
        },
        merchantReply: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        merchantRepliedAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        isReported: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        reportReason: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        reportedByShopId: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: "shops",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        },
        reportedAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        status: {
          type: Sequelize.STRING(20),
          allowNull: false,
          defaultValue: "PUBLISHED",
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
      });

      // 3. Add Indexes for high-performance reading and filtering
      await queryInterface.addIndex("reviews", ["shopId"]);
      await queryInterface.addIndex("reviews", ["productId"]);
      await queryInterface.addIndex("reviews", ["userId"]);
      await queryInterface.addIndex("reviews", ["status"]);
      await queryInterface.addIndex("reviews", ["isReported"]);
    }
  },

  async down(queryInterface) {
    const tableExists = await queryInterface.tableExists("reviews").catch(() => false);
    if (tableExists) {
      await queryInterface.dropTable("reviews");
    }

    const productTableInfo = await queryInterface.describeTable("products");
    if (productTableInfo.rating) {
      await queryInterface.removeColumn("products", "rating");
    }
    if (productTableInfo.reviewCount) {
      await queryInterface.removeColumn("products", "reviewCount");
    }
  },
};
