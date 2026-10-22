import bcrypt from "bcryptjs";
import { User } from "./modules/users/user.model";
import { sequelize } from "./config/database";

async function seedSuperAdmin() {
  try {
    await sequelize.authenticate();
    console.log("Connected to AWS RDS...");

    const email = "superadmin@findshopeasily.com";
    const password = "SuperAdmin@2026!";

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const [user, created] = await User.findOrCreate({
      where: { email },
      defaults: {
        name: "Super Admin",
        email,
        passwordHash,
        phone: "+919999999999",
        role: "super_admin",
        isActive: true,
      },
    });

    if (!created) {
      // Update password hash and role if already exists
      await user.update({ passwordHash, role: "super_admin", isActive: true });
      console.log(`Updated existing superadmin account: ${email}`);
    } else {
      console.log(`Created new superadmin account: ${email}`);
    }

    console.log("\n==========================================");
    console.log("🔑 Super Admin Credentials:");
    console.log(`   Email:    ${email}`);
    console.log(`   Password: ${password}`);
    console.log("==========================================\n");

    process.exit(0);
  } catch (error) {
    console.error("Error seeding superadmin:", error);
    process.exit(1);
  }
}

seedSuperAdmin();
