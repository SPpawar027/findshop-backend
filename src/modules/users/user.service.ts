import { User, type UserRole } from "./user.model";
import { Shop } from "../shops/shop.model";
import { Review } from "../reviews/review.model";
import { NotFoundError, ConflictError, BadRequestError } from "../../core/errors/AppError";

export interface CreateUserInput {
  name: string;
  email: string;
  passwordHash: string;
  phone?: string | null;
  role?: UserRole;
  searchRadiusKm?: number;
  avatarUrl?: string | null;
}

export class UserService {
  async getById(id: number): Promise<User> {
    const user = await User.findByPk(id, {
      attributes: { exclude: ["passwordHash"] },
    });

    if (!user) {
      throw new NotFoundError(`User with id ${id} not found`);
    }

    return user;
  }

  async getAll(): Promise<User[]> {
    const users = await User.findAll({
      attributes: { exclude: ["passwordHash"] },
    });
    return users;
  }

  async getByEmail(email: string): Promise<User | null> {
    return User.findOne({ where: { email } });
  }

  async create(data: CreateUserInput): Promise<User> {
    const existing = await this.getByEmail(data.email);
    if (existing) {
      throw new ConflictError("Email already registered");
    }

    const user = await User.create({
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      phone: data.phone ?? null,
      role: data.role ?? "customer",
      isActive: true,
    });

    // Return without password hash
    return this.getById(user.id);
  }

  async update(id: number, data: Partial<Omit<CreateUserInput, "passwordHash">> & { isActive?: boolean }): Promise<User> {
    const user = await User.findByPk(id);
    if (!user) {
      throw new NotFoundError(`User with id ${id} not found`);
    }

    if (data.email && data.email !== user.email) {
      const existing = await this.getByEmail(data.email);
      if (existing) {
        throw new ConflictError("Email already in use");
      }
    }

    const radiusUpdate = data.searchRadiusKm !== undefined
      ? Math.min(80, Math.max(1, Number(data.searchRadiusKm)))
      : user.searchRadiusKm;

    await user.update({
      name: data.name ?? user.name,
      email: data.email ?? user.email,
      phone: data.phone !== undefined ? data.phone : user.phone,
      role: data.role ?? user.role,
      searchRadiusKm: radiusUpdate,
      avatarUrl: data.avatarUrl !== undefined ? data.avatarUrl : user.avatarUrl,
      isActive: data.isActive !== undefined ? data.isActive : user.isActive,
    });

    return this.getById(user.id);
  }

  async delete(id: number): Promise<void> {
    const user = await User.findByPk(id);
    if (!user) {
      throw new NotFoundError(`User with id ${id} not found`);
    }

    // Soft delete by setting isActive to false
    await user.update({ isActive: false });
  }

  /**
   * User-initiated self account deletion (mandated by Google Play & App Store policies).
   * Verifies that the user has no active shops, revokes credentials, and anonymizes personal data.
   */
  async deleteSelf(userId: number, reason?: string): Promise<void> {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (!user.isActive) {
      throw new BadRequestError("Account is already deactivated");
    }

    // Business rule: If user is a merchant who still owns an active shop, require shop closure first
    const activeShop = await Shop.findOne({
      where: {
        ownerId: userId,
        deletedAt: null,
      },
    });

    if (activeShop) {
      throw new BadRequestError(
        `Cannot delete account: You are the registered owner of an active shop ("${activeShop.name}"). Please schedule shop closure in Settings before deleting your personal account.`
      );
    }

    const timestamp = Date.now();
    const anonymizedEmail = `deleted_${userId}_${timestamp}@anonymized.findshopeasily.com`;

    // 1. Anonymize personal identifiable information (PII) and deactivate account
    await user.update({
      isActive: false,
      name: "Deleted Account",
      email: anonymizedEmail,
      passwordHash: null,
      phone: null,
      avatarUrl: null,
      googleId: null,
      emailVerificationOtp: null,
      emailVerificationOtpExpires: null,
      passwordResetOtp: null,
      passwordResetOtpExpires: null,
      resetPasswordToken: null,
      resetPasswordExpires: null,
    });

    // 2. Anonymize author name in existing reviews to preserve ratings without leaking personal name
    await Review.update(
      { authorName: "Deleted User" },
      { where: { userId } }
    ).catch((err) => {
      console.warn(`[Review Anonymization Warning] Failed to update reviews for user ${userId}:`, err?.message);
    });

    console.log(
      `[Account Deletion] User ID ${userId} successfully anonymized and deactivated. Reason: ${reason || "Self-deletion"}`
    );
  }
}

export const userService = new UserService();
