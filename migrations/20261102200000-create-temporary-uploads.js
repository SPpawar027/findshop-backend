"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("temporary_uploads", {
      id: {
        type: Sequelize.STRING(64),
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      shop_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "shops",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
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
      object_key: {
        type: Sequelize.STRING(500),
        allowNull: false,
        unique: true,
      },
      original_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
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
      upload_status: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "pending",
      },
      intended_usage: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      attached_at: {
        type: Sequelize.DATE,
        allowNull: true,
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

    await queryInterface.addIndex("temporary_uploads", ["user_id"]);
    await queryInterface.addIndex("temporary_uploads", ["shop_id"]);
    await queryInterface.addIndex("temporary_uploads", ["upload_status"]);
    await queryInterface.addIndex("temporary_uploads", ["expires_at"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("temporary_uploads");
  },
};
