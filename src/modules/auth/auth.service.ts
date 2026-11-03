import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import { User, type UserRole } from "../users/user.model";
import { NotFoundError, BadRequestError, UnauthorizedError, ConflictError, ForbiddenError } from "../../core/errors/AppError";
import { emailService } from "../../core/mail/email.service";

const JWT_SECRET = process.env.JWT_SECRET || "findshop_jwt_secret_dev_key_change_in_prod";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || `${JWT_SECRET}_refresh_key_v1`;

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  phone?: string | null;
  role?: UserRole;
}

export interface LoginInput {
  email: string;
  password: string;
  expectedRole?: UserRole | UserRole[];
}

export class AuthService {
  private getAccessExpiryForRole(_role: UserRole): string {
    // 15 minutes access token lifetime across roles
    return "15m";
  }

  private getRefreshExpiryForRole(role: UserRole): string {
    // For superadmin and shopadmin: strictly 1 hour validity. After that, user must log in again.
    if (role === "super_admin" || role === "shop_admin") {
      return "1h";
    }
    // Consumers retain a 7-day refresh window
    return "7d";
  }

  private generateAccessToken(user: User): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        type: "access",
      },
      JWT_SECRET,
      { expiresIn: this.getAccessExpiryForRole(user.role) as jwt.SignOptions["expiresIn"] }
    );
  }

  private generateRefreshToken(user: User): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        type: "refresh",
      },
      JWT_REFRESH_SECRET,
      { expiresIn: this.getRefreshExpiryForRole(user.role) as jwt.SignOptions["expiresIn"] }
    );
  }

  private generateAuthTokens(user: User) {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);
    return {
      accessToken,
      refreshToken,
      token: accessToken, // backwards compatibility
      expiresIn: 15 * 60, // 900 seconds
    };
  }

  async register(data: RegisterInput) {
    const existing = await User.findOne({ where: { email: data.email.toLowerCase().trim() } });
    if (existing) {
      throw new ConflictError("Email already registered");
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    const user = await User.create({
      name: data.name.trim(),
      email: data.email.toLowerCase().trim(),
      passwordHash,
      phone: data.phone?.trim() ?? null,
      role: data.role ?? "customer",
      isActive: true,
    });

    const tokens = this.generateAuthTokens(user);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
      ...tokens,
    };
  }

  async login(data: LoginInput) {
    const user = await User.findOne({ where: { email: data.email.toLowerCase().trim() } });
    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }

    if (!user.isActive) {
      throw new UnauthorizedError("Account is inactive. Please contact support.");
    }

    const isMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError("Invalid email or password");
    }

    // Role-based portal authorization check
    if (data.expectedRole) {
      const allowed = Array.isArray(data.expectedRole) ? data.expectedRole : [data.expectedRole];
      if (!allowed.includes(user.role)) {
        // Generic security message: NEVER reveal secret role or admin existence
        throw new ForbiddenError("Invalid credentials or access denied for this portal");
      }
    }

    const tokens = this.generateAuthTokens(user);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
      ...tokens,
    };
  }

  /**
   * Refreshes access token using a valid, unexpired refresh token.
   * If refresh token has expired (past 1 hour for admins), rejects with 401.
   */
  async refreshToken(refreshToken: string) {
    if (!refreshToken) {
      throw new BadRequestError("Refresh token is required");
    }

    let decoded: { id: number; email: string; role: UserRole; type: string };
    try {
      decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as typeof decoded;
    } catch (err: unknown) {
      const name = err instanceof Error ? err.name : "";
      if (name === "TokenExpiredError") {
        throw new UnauthorizedError("Session expired. Please log in again.");
      }
      throw new UnauthorizedError("Invalid session refresh token");
    }

    if (decoded.type !== "refresh") {
      throw new UnauthorizedError("Invalid token type presented for session refresh");
    }

    const user = await User.findByPk(decoded.id);
    if (!user || !user.isActive) {
      throw new UnauthorizedError("Account is inactive or no longer exists");
    }

    const tokens = this.generateAuthTokens(user);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
      ...tokens,
    };
  }

  async getCurrentUser(userId: number) {
    const user = await User.findByPk(userId, {
      attributes: { exclude: ["passwordHash"] },
    });
    if (!user) {
      throw new NotFoundError("User not found");
    }
    return user;
  }

  /**
   * Generates a 32-byte cryptographically secure reset token,
   * stores its SHA-256 hash in PostgreSQL with a 30-minute expiry,
   * and emails the raw token URL to the user via Nodemailer.
   */
  async forgotPassword(email: string, originHeader?: string) {
    const user = await User.findOne({
      where: { email: email.toLowerCase().trim() },
    });

    // Security practice: Always return generic success to prevent email enumeration
    const genericResponse = {
      message: "If an account exists with this email, a password reset link has been dispatched.",
    };

    if (!user || !user.isActive) {
      return genericResponse;
    }

    // 1. Generate 256-bit cryptographic random raw token
    const rawToken = crypto.randomBytes(32).toString("hex");

    // 2. Hash token using SHA-256 before persisting in DB
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    // 3. Set expiry to 30 minutes from now
    const tokenExpires = new Date(Date.now() + 30 * 60 * 1000);

    user.resetPasswordToken = tokenHash;
    user.resetPasswordExpires = tokenExpires;
    await user.save();

    // 4. Determine base URL according to role or request origin
    let baseUrl = originHeader || process.env.CLIENT_URL || "https://findshopeasily.com";
    if (user.role === "shop_admin" && process.env.SHOP_ADMIN_URL) {
      baseUrl = process.env.SHOP_ADMIN_URL;
    } else if (user.role === "super_admin" && process.env.SUPER_ADMIN_URL) {
      baseUrl = process.env.SUPER_ADMIN_URL;
    }

    const resetUrl = `${baseUrl.replace(/\/+$/, "")}/reset-password?token=${rawToken}`;

    // 5. Send email asynchronously (non-blocking)
    await emailService.sendPasswordResetEmail({
      to: user.email,
      userName: user.name,
      resetUrl,
      tokenExpiresMinutes: 30,
    });

    return genericResponse;
  }

  /**
   * Validates the provided raw reset token against the stored SHA-256 hash,
   * checks expiry, updates password with bcrypt, and invalidates the token.
   */
  async resetPassword(token: string, newPassword: string) {
    if (!token || typeof token !== "string" || !token.trim()) {
      throw new BadRequestError("Password reset token is required");
    }

    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestError("New password must be at least 8 characters long");
    }

    // Hash the raw token to match against the DB stored hash
    const tokenHash = crypto.createHash("sha256").update(token.trim()).digest("hex");

    const user = await User.findOne({
      where: {
        resetPasswordToken: tokenHash,
        resetPasswordExpires: {
          [Op.gt]: new Date(),
        },
      },
    });

    if (!user) {
      throw new BadRequestError("Invalid or expired password reset token");
    }

    // Hash the new password with bcrypt
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);

    // Invalidate reset token (single-use protection)
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    return {
      message: "Password has been reset successfully. You can now log in with your new password.",
    };
  }
}

export const authService = new AuthService();
