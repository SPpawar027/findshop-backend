"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable("products");
    if (!tableInfo.deletedAt && !tableInfo.deleted_at) {
      await queryInterface.addColumn("products", "deletedAt", {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      });

      await queryInterface.addIndex("products", ["deletedAt"]);
    }
  },

  async down(queryInterface) {
    const tableInfo = await queryInterface.describeTable("products");
    if (tableInfo.deletedAt) {
      await queryInterface.removeColumn("products", "deletedAt");
    } else if (tableInfo.deleted_at) {
      await queryInterface.removeColumn("products", "deleted_at");
    }
  },
};
