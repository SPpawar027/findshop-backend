"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("image_assets", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      entity_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      entity_id: {
        type: Sequelize.INTEGER,
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
      object_key: {
        type: Sequelize.STRING(500),
        allowNull: false,
        unique: true,
      },
      mime_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: "image/webp",
      },
      file_size: {
        type: Sequelize.BIGINT,
        allowNull: false,
        defaultValue: 0,
      },
      image_role: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "active",
      },
      created_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
    });

    await queryInterface.addIndex("image_assets", ["entity_type", "entity_id"]);
    await queryInterface.addIndex("image_assets", ["shop_id"]);
    await queryInterface.addIndex("image_assets", ["object_key"]);
    await queryInterface.addIndex("image_assets", ["status"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("image_assets");
  },
};
