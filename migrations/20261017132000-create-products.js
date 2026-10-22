"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("products", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
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

      name: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },

      slug: {
        type: Sequelize.STRING(220),
        allowNull: false,
      },

      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      category: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },

      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },

      discountPrice: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },

      stockQuantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      sku: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },

      images: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },

      isAvailable: {
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

    await queryInterface.addIndex("products", ["shopId"]);
    await queryInterface.addIndex("products", ["category"]);
    await queryInterface.addIndex("products", ["isAvailable"]);
    await queryInterface.addIndex("products", ["shopId", "slug"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("products");
  },
};
