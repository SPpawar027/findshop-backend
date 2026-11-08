"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable("users").catch(() => ({}));

    // 1. Make passwordHash nullable to allow OAuth users without password
    if (tableInfo.passwordHash) {
      await queryInterface.changeColumn("users", "passwordHash", {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }

    // 2. Google OAuth ID
    if (!tableInfo.googleId && !tableInfo.google_id) {
      await queryInterface.addColumn("users", "googleId", {
        type: Sequelize.STRING(255),
        allowNull: true,
      });

      await queryInterface.addIndex("users", ["googleId"], {
        name: "idx_users_google_id",
        unique: true,
        where: {
          googleId: {
            [Sequelize.Op.ne]: null,
          },
        },
      });
    }

    // 3. User Avatar URL
    if (!tableInfo.avatarUrl && !tableInfo.avatar_url) {
      await queryInterface.addColumn("users", "avatarUrl", {
        type: Sequelize.STRING(500),
        allowNull: true,
      });
    }

    // 4. Auth Provider ("local" | "google")
    if (!tableInfo.authProvider && !tableInfo.auth_provider) {
      await queryInterface.addColumn("users", "authProvider", {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: "local",
      });
    }

    // 5. Email Verification Flag
    if (!tableInfo.isEmailVerified && !tableInfo.is_email_verified) {
      await queryInterface.addColumn("users", "isEmailVerified", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    // 6. Email Verification 6-Digit OTP & Expiry
    if (!tableInfo.emailVerificationOtp && !tableInfo.email_verification_otp) {
      await queryInterface.addColumn("users", "emailVerificationOtp", {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
    if (!tableInfo.emailVerificationOtpExpires && !tableInfo.email_verification_otp_expires) {
      await queryInterface.addColumn("users", "emailVerificationOtpExpires", {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    // 7. Password Reset 6-Digit OTP & Expiry
    if (!tableInfo.passwordResetOtp && !tableInfo.password_reset_otp) {
      await queryInterface.addColumn("users", "passwordResetOtp", {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
    if (!tableInfo.passwordResetOtpExpires && !tableInfo.password_reset_otp_expires) {
      await queryInterface.addColumn("users", "passwordResetOtpExpires", {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    // Backfill existing users: mark verified since they were created in past
    try {
      await queryInterface.sequelize.query(`
        UPDATE users
        SET "isEmailVerified" = TRUE
        WHERE "isEmailVerified" = FALSE AND "passwordHash" IS NOT NULL;
      `);
    } catch {
      // Ignore if query fails on certain environments
    }
  },

  async down(queryInterface) {
    const tableInfo = await queryInterface.describeTable("users").catch(() => ({}));

    if (tableInfo.passwordResetOtpExpires) {
      await queryInterface.removeColumn("users", "passwordResetOtpExpires");
    }
    if (tableInfo.passwordResetOtp) {
      await queryInterface.removeColumn("users", "passwordResetOtp");
    }
    if (tableInfo.emailVerificationOtpExpires) {
      await queryInterface.removeColumn("users", "emailVerificationOtpExpires");
    }
    if (tableInfo.emailVerificationOtp) {
      await queryInterface.removeColumn("users", "emailVerificationOtp");
    }
    if (tableInfo.isEmailVerified) {
      await queryInterface.removeColumn("users", "isEmailVerified");
    }
    if (tableInfo.authProvider) {
      await queryInterface.removeColumn("users", "authProvider");
    }
    if (tableInfo.avatarUrl) {
      await queryInterface.removeColumn("users", "avatarUrl");
    }
    if (tableInfo.googleId) {
      await queryInterface.removeIndex("users", "idx_users_google_id").catch(() => {});
      await queryInterface.removeColumn("users", "googleId");
    }
  },
};

