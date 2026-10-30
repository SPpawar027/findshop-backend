"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableExists = await queryInterface.tableExists("categories").catch(() => false);
    if (!tableExists) {
      await queryInterface.createTable("categories", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },

        name: {
          type: Sequelize.STRING(100),
          allowNull: false,
        },

        slug: {
          type: Sequelize.STRING(120),
          allowNull: false,
          unique: true,
        },

        description: {
          type: Sequelize.TEXT,
          allowNull: true,
        },

        parentId: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: "categories",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },

        level: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1, // 1 = L1 Department / Sector, 2 = L2 Product Category
        },

        icon: {
          type: Sequelize.STRING(100),
          allowNull: true,
          defaultValue: "shopping-bag",
        },

        emoji: {
          type: Sequelize.STRING(10),
          allowNull: true,
          defaultValue: "📦",
        },

        orderIndex: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },

        isActive: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
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
    }

    try { await queryInterface.addIndex("categories", ["parentId"]); } catch (_) {}
    try { await queryInterface.addIndex("categories", ["slug"]); } catch (_) {}
    try { await queryInterface.addIndex("categories", ["level", "isActive"]); } catch (_) {}
    try { await queryInterface.addIndex("categories", ["orderIndex"]); } catch (_) {}
  },

  async down(queryInterface) {
    const tableExists = await queryInterface.tableExists("categories").catch(() => false);
    if (tableExists) {
      await queryInterface.dropTable("categories");
    }
  },
};
