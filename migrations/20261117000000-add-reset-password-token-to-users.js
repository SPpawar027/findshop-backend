"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable("users").catch(() => ({}));

    if (!tableInfo.resetPasswordToken && !tableInfo.reset_password_token) {
      await queryInterface.addColumn("users", "resetPasswordToken", {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }

    if (!tableInfo.resetPasswordExpires && !tableInfo.reset_password_expires) {
      await queryInterface.addColumn("users", "resetPasswordExpires", {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("users", "resetPasswordToken").catch(() => {});
    await queryInterface.removeColumn("users", "resetPasswordExpires").catch(() => {});
  },
};
