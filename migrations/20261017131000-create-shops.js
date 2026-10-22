"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("shops", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },

      ownerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },

      slug: {
        type: Sequelize.STRING(180),
        allowNull: false,
        unique: true,
      },

      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      category: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },

      address: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },

      city: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },

      state: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },

      postalCode: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },

      latitude: {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: false,
      },

      longitude: {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: false,
      },

      phone: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },

      email: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },

      rating: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: false,
        defaultValue: 0.0,
      },

      reviewCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      isVerified: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      isOpen: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      openingHours: {
        type: Sequelize.JSONB,
        allowNull: true,
      },

      bannerUrl: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },

      logoUrl: {
        type: Sequelize.STRING(500),
        allowNull: true,
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

    await queryInterface.addIndex("shops", ["ownerId"]);
    await queryInterface.addIndex("shops", ["category"]);
    await queryInterface.addIndex("shops", ["city"]);
    await queryInterface.addIndex("shops", ["latitude", "longitude"]);
    await queryInterface.addIndex("shops", ["slug"], { unique: true });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("shops");
  },
};
