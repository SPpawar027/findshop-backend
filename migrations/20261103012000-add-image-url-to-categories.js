"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable("categories").catch(() => ({}));
    if (!tableInfo.image_url && !tableInfo.imageUrl) {
      await queryInterface.addColumn("categories", "image_url", {
        type: Sequelize.STRING(500),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const tableInfo = await queryInterface.describeTable("categories").catch(() => ({}));
    if (tableInfo.image_url) {
      await queryInterface.removeColumn("categories", "image_url");
    }
  },
};

