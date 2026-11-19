"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable("shops");

    if (!tableInfo.deletedAt && !tableInfo.deleted_at) {
      await queryInterface.addColumn("shops", "deletedAt", {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      });
      await queryInterface.addIndex("shops", ["deletedAt"]);
    }

    if (!tableInfo.deletionRequestedAt && !tableInfo.deletion_requested_at) {
      await queryInterface.addColumn("shops", "deletionRequestedAt", {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      });
    }

    if (!tableInfo.purgeAfter && !tableInfo.purge_after) {
      await queryInterface.addColumn("shops", "purgeAfter", {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      });
      await queryInterface.addIndex("shops", ["purgeAfter"]);
    }

    if (!tableInfo.deletionReason && !tableInfo.deletion_reason) {
      await queryInterface.addColumn("shops", "deletionReason", {
        type: Sequelize.STRING(500),
        allowNull: true,
        defaultValue: null,
      });
    }

    if (!tableInfo.deletedByUserId && !tableInfo.deleted_by_user_id) {
      await queryInterface.addColumn("shops", "deletedByUserId", {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
    }
  },

  async down(queryInterface) {
    const tableInfo = await queryInterface.describeTable("shops");

    if (tableInfo.deletedAt) {
      await queryInterface.removeColumn("shops", "deletedAt");
    } else if (tableInfo.deleted_at) {
      await queryInterface.removeColumn("shops", "deleted_at");
    }

    if (tableInfo.deletionRequestedAt) {
      await queryInterface.removeColumn("shops", "deletionRequestedAt");
    } else if (tableInfo.deletion_requested_at) {
      await queryInterface.removeColumn("shops", "deletion_requested_at");
    }

    if (tableInfo.purgeAfter) {
      await queryInterface.removeColumn("shops", "purgeAfter");
    } else if (tableInfo.purge_after) {
      await queryInterface.removeColumn("shops", "purge_after");
    }

    if (tableInfo.deletionReason) {
      await queryInterface.removeColumn("shops", "deletionReason");
    } else if (tableInfo.deletion_reason) {
      await queryInterface.removeColumn("shops", "deletion_reason");
    }

    if (tableInfo.deletedByUserId) {
      await queryInterface.removeColumn("shops", "deletedByUserId");
    } else if (tableInfo.deleted_by_user_id) {
      await queryInterface.removeColumn("shops", "deleted_by_user_id");
    }
  },
};
