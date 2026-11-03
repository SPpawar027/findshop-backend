"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("shop_analytics_events", {
      id: {
        type: Sequelize.BIGINT,
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
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      visitor_id: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      product_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "products",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      event_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      platform: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "website",
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
    });

    await queryInterface.addIndex("shop_analytics_events", ["shop_id", "created_at"], {
      name: "idx_shop_analytics_events_shop_id_created_at",
    });

    await queryInterface.addIndex("shop_analytics_events", ["event_type"], {
      name: "idx_shop_analytics_events_event_type",
    });

    await queryInterface.addIndex("shop_analytics_events", ["visitor_id", "created_at"], {
      name: "idx_shop_analytics_events_visitor_id",
    });

    await queryInterface.addIndex("shop_analytics_events", ["shop_id", "event_type", "created_at"], {
      name: "idx_shop_analytics_events_shop_event",
    });

    await queryInterface.addIndex("shop_analytics_events", ["product_id", "created_at"], {
      name: "idx_shop_analytics_events_product_id",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("shop_analytics_events");
  },
};

