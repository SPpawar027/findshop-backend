"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("legal_documents", {
      id: {
        type: Sequelize.STRING(64),
        primaryKey: true,
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      version: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: "1.0.0",
      },
      lastUpdatedBy: {
        type: Sequelize.STRING(128),
        allowNull: true,
        defaultValue: "Super Admin",
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("legal_documents");
  },
};
