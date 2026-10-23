"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("app_version_configs", {
      id: {
        type: Sequelize.STRING(32),
        primaryKey: true,
        allowNull: false,
      },
      platform: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: "android",
      },
      currentVersion: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: "1.0.0",
      },
      minimumVersion: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: "1.0.0",
      },
      updateType: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: "none",
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      releaseNotes: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      storeUrl: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      isMaintenance: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      maintenanceMessage: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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
    await queryInterface.dropTable("app_version_configs");
  },
};
