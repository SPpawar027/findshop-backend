"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if column already exists before adding
    const tableInfo = await queryInterface.describeTable("products");
    if (!tableInfo.categoryId) {
      await queryInterface.addColumn("products", "categoryId", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "categories",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });

      await queryInterface.addIndex("products", ["categoryId"]);
    }
  },

  async down(queryInterface) {
    const tableInfo = await queryInterface.describeTable("products");
    if (tableInfo.categoryId) {
      await queryInterface.removeColumn("products", "categoryId");
    }
  },
};
