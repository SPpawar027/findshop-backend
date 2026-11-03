"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("shop_analytics_daily", {
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
      analytics_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      total_views: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      unique_visitors: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      directions_clicks: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      call_clicks: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      product_views: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      wishlist_adds: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      offer_views: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      offer_redemptions: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
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

    await queryInterface.addConstraint("shop_analytics_daily", {
      fields: ["shop_id", "analytics_date"],
      type: "unique",
      name: "uq_shop_analytics_daily_shop_date",
    });

    await queryInterface.addIndex("shop_analytics_daily", ["analytics_date"], {
      name: "idx_shop_analytics_daily_date",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("shop_analytics_daily");
  },
};

