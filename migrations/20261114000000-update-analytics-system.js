"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // -------------------------------------------------------------------------
    // 1. UPDATE shop_analytics_daily: Add whatsapp_clicks & ensure uniqueness
    // -------------------------------------------------------------------------
    const dailyTableDesc = await queryInterface.describeTable("shop_analytics_daily");
    if (!dailyTableDesc.whatsapp_clicks) {
      await queryInterface.addColumn("shop_analytics_daily", "whatsapp_clicks", {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }

    // Safely deduplicate any existing daily records if needed before unique constraint
    await queryInterface.sequelize.query(`
      DELETE FROM shop_analytics_daily a
      USING shop_analytics_daily b
      WHERE a.id < b.id
        AND a.shop_id = b.shop_id
        AND a.analytics_date = b.analytics_date;
    `);

    // Ensure unique constraint on (shop_id, analytics_date) exists
    try {
      await queryInterface.addConstraint("shop_analytics_daily", {
        fields: ["shop_id", "analytics_date"],
        type: "unique",
        name: "uq_shop_analytics_daily_shop_date",
      });
    } catch {
      // Constraint already exists from prior migration, proceed safely
    }

    // -------------------------------------------------------------------------
    // 2. UPDATE shop_analytics_events: Add event_id UUID NOT NULL UNIQUE
    // -------------------------------------------------------------------------
    const eventsTableDesc = await queryInterface.describeTable("shop_analytics_events");
    if (!eventsTableDesc.event_id) {
      // Step A: Add nullable column
      await queryInterface.addColumn("shop_analytics_events", "event_id", {
        type: Sequelize.UUID,
        allowNull: true,
      });

      // Step B: Backfill existing rows safely with gen_random_uuid()
      await queryInterface.sequelize.query(`
        UPDATE shop_analytics_events
        SET event_id = gen_random_uuid()
        WHERE event_id IS NULL;
      `);

      // Step C: Set NOT NULL
      await queryInterface.changeColumn("shop_analytics_events", "event_id", {
        type: Sequelize.UUID,
        allowNull: false,
      });

      // Step D: Add Unique Constraint
      await queryInterface.addConstraint("shop_analytics_events", {
        fields: ["event_id"],
        type: "unique",
        name: "uq_shop_analytics_events_event_id",
      });
    }

    // -------------------------------------------------------------------------
    // 3. CREATE shop_analytics_unique_visitors table
    // -------------------------------------------------------------------------
    const tables = await queryInterface.showAllTables();
    if (!tables.includes("shop_analytics_unique_visitors")) {
      await queryInterface.createTable("shop_analytics_unique_visitors", {
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
        visitor_id: {
          type: Sequelize.STRING(100),
          allowNull: false,
        },
        analytics_date: {
          type: Sequelize.DATEONLY,
          allowNull: false,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
      });

      // Unique constraint: (shop_id, visitor_id, analytics_date)
      await queryInterface.addConstraint("shop_analytics_unique_visitors", {
        fields: ["shop_id", "visitor_id", "analytics_date"],
        type: "unique",
        name: "uq_shop_analytics_unique_visitors",
      });

      // Index for fast 7-day retention cleanup
      await queryInterface.addIndex("shop_analytics_unique_visitors", ["created_at"], {
        name: "idx_shop_analytics_unique_visitors_created_at",
      });

      // Index for analytics date queries
      await queryInterface.addIndex("shop_analytics_unique_visitors", ["analytics_date"], {
        name: "idx_shop_analytics_unique_visitors_date",
      });
    }
  },

  async down(queryInterface) {
    // 1. Drop shop_analytics_unique_visitors table
    const tables = await queryInterface.showAllTables();
    if (tables.includes("shop_analytics_unique_visitors")) {
      await queryInterface.dropTable("shop_analytics_unique_visitors");
    }

    // 2. Remove event_id from shop_analytics_events
    try {
      await queryInterface.removeConstraint("shop_analytics_events", "uq_shop_analytics_events_event_id");
    } catch {
      // Ignore if constraint does not exist
    }

    const eventsTableDesc = await queryInterface.describeTable("shop_analytics_events");
    if (eventsTableDesc.event_id) {
      await queryInterface.removeColumn("shop_analytics_events", "event_id");
    }

    // 3. Remove whatsapp_clicks from shop_analytics_daily
    const dailyTableDesc = await queryInterface.describeTable("shop_analytics_daily");
    if (dailyTableDesc.whatsapp_clicks) {
      await queryInterface.removeColumn("shop_analytics_daily", "whatsapp_clicks");
    }
  },
};

