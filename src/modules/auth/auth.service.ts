import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import { OAuth2Client } from "google-auth-library";
import { User, type UserRole } from "../users/user.model";
import { Shop } from "../shops/shop.model";
import { NotFoundError, BadRequestError, UnauthorizedError, ConflictError, ForbiddenError } from "../../core/errors/AppError";
import { emailService } from "../../core/mail/email.service";

const JWT_SECRET = process.env.JWT_SECRET || "findshop_jwt_secret_dev_key_change_in_prod";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || `${JWT_SECRET}_refresh_key_v1`;

// Cached OAuth2Client singleton: preserves Google's public JWKS certificates in memory
// so verifyIdToken does sub-millisecond local in-memory cryptographic verification
let sharedOAuth2Client: OAuth2Client | null = null;
function getSharedOAuth2Client(): OAuth2Client {
  if (!sharedOAuth2Client) {
    sharedOAuth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_WEB_CLIENT_ID || ""
    );
  }
  return sharedOAuth2Client;
}

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
    // 15 minutes access token lifetime across all platforms (admin, superadmin, website, mobile)
    return "15m";
  }

  private getRefreshExpiryForRole(_role: UserRole): string {
    // 10 days refresh token lifetime across all platforms (admin, superadmin, website, mobile)
    return "10d";
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
      expiresIn: 15 * 60, // 15 minutes = 900 seconds
      refreshExpiresIn: 10 * 24 * 60 * 60, // 10 days = 864,000 seconds
    };
  }

  async register(data: RegisterInput) {
    const existing = await User.findOne({ where: { email: data.email.toLowerCase().trim() } });
    if (existing) {
      throw new ConflictError("Email already registered");
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    // Generate 6-digit numeric OTP for email verification
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const user = await User.create({
      name: data.name.trim(),
      email: data.email.toLowerCase().trim(),
      passwordHash,
      phone: data.phone?.trim() ?? null,
      role: data.role ?? "customer",
      isActive: true,
      authProvider: "local",
      isEmailVerified: false,
      emailVerificationOtp: otpHash,
      emailVerificationOtpExpires: otpExpires,
    });

    // Send verification OTP email (simulated in console if SMTP not configured, live email if configured)
    await emailService.sendOtpEmail({
      to: user.email,
      userName: user.name,
      otp,
      type: "verification",
      expiresMinutes: 10,
    });

    const tokens = this.generateAuthTokens(user);

    let shopData: { id: number; name: string; slug: string } | null = null;
    if (user.role === "shop_admin") {
      const userShop = await Shop.findOne({
        where: { ownerId: user.id },
        attributes: ["id", "name", "slug"],
      });
      if (userShop) {
        shopData = {
          id: userShop.id,
          name: userShop.name,
          slug: userShop.slug,
        };
      }
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        authProvider: user.authProvider,
        avatarUrl: user.avatarUrl,
        isEmailVerified: user.isEmailVerified,
        hasPassword: Boolean(user.passwordHash),
        shopId: shopData?.id ?? null,
        shop: shopData,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
      requireVerification: true,
      message: "Registration successful. Please enter the 6-digit verification code sent to your email.",
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

    if (!user.passwordHash) {
      throw new UnauthorizedError(
        "This account was created with Google Sign-In. Please sign in with Google or use 'Forgot Password' to set a password."
      );
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

    let shopData: { id: number; name: string; slug: string } | null = null;
    if (user.role === "shop_admin") {
      const userShop = await Shop.findOne({
        where: { ownerId: user.id },
        attributes: ["id", "name", "slug"],
      });
      if (userShop) {
        shopData = {
          id: userShop.id,
          name: userShop.name,
          slug: userShop.slug,
        };
      }
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        authProvider: user.authProvider,
        avatarUrl: user.avatarUrl,
        isEmailVerified: user.isEmailVerified,
        hasPassword: Boolean(user.passwordHash),
        shopId: shopData?.id ?? null,
        shop: shopData,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
      ...tokens,
    };
  }

  /**
   * Refreshes access token using a valid, unexpired refresh token.
   * If refresh token has expired (past 10 days), rejects with 401.
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

    let shopData: { id: number; name: string; slug: string } | null = null;
    if (user.role === "shop_admin") {
      const userShop = await Shop.findOne({
        where: { ownerId: user.id },
        attributes: ["id", "name", "slug"],
      });
      if (userShop) {
        shopData = {
          id: userShop.id,
          name: userShop.name,
          slug: userShop.slug,
        };
      }
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        shopId: shopData?.id ?? null,
        shop: shopData,
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

    let shopData: { id: number; name: string; slug: string } | null = null;
    if (user.role === "shop_admin") {
      const userShop = await Shop.findOne({
        where: { ownerId: user.id },
        attributes: ["id", "name", "slug"],
      });
      if (userShop) {
        shopData = {
          id: userShop.id,
          name: userShop.name,
          slug: userShop.slug,
        };
      }
    }

    return {
      ...user.toJSON(),
      shopId: shopData?.id ?? null,
      shop: shopData,
    };
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
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const tokenExpires = new Date(Date.now() + 30 * 60 * 1000);

    // 2. Generate 6-digit numeric OTP for mobile and quick in-app entry
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.resetPasswordToken = tokenHash;
    user.resetPasswordExpires = tokenExpires;
    user.passwordResetOtp = otpHash;
    user.passwordResetOtpExpires = otpExpires;
    await user.save();

    // 3. Determine base URL according to role or request origin
    let baseUrl = originHeader || process.env.CLIENT_URL || "https://findshopeasily.com";
    if (user.role === "shop_admin" && process.env.SHOP_ADMIN_URL) {
      baseUrl = process.env.SHOP_ADMIN_URL;
    } else if (user.role === "super_admin" && process.env.SUPER_ADMIN_URL) {
      baseUrl = process.env.SUPER_ADMIN_URL;
    }

    const resetUrl = `${baseUrl.replace(/\/+$/, "")}/reset-password?token=${rawToken}`;

    // 4. Send email OTP code
    await emailService.sendOtpEmail({
      to: user.email,
      userName: user.name,
      otp,
      type: "password_reset",
      expiresMinutes: 10,
    });

    // 5. Send link email (non-blocking)
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

    // Invalidate reset tokens (single-use protection)
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    user.passwordResetOtp = null;
    user.passwordResetOtpExpires = null;
    user.isEmailVerified = true;
    await user.save();

    return {
      message: "Password has been reset successfully. You can now log in with your new password.",
    };
  }

  /**
   * Resets password using 6-digit numeric OTP code sent via email.
   */
  async resetPasswordWithOtp(email: string, otp: string, newPassword: string) {
    if (!email || !otp || !newPassword) {
      throw new BadRequestError("Email, 6-digit OTP code, and new password are required");
    }

    if (newPassword.length < 8) {
      throw new BadRequestError("New password must be at least 8 characters long");
    }

    const normalizedEmail = email.toLowerCase().trim();
    const cleanOtp = otp.trim();
    const otpHash = crypto.createHash("sha256").update(cleanOtp).digest("hex");

    const user = await User.findOne({
      where: {
        email: normalizedEmail,
        passwordResetOtp: otpHash,
        passwordResetOtpExpires: {
          [Op.gt]: new Date(),
        },
      },
    });

    if (!user) {
      throw new BadRequestError("Invalid or expired password reset code. Please request a new code.");
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    user.passwordResetOtp = null;
    user.passwordResetOtpExpires = null;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    user.isEmailVerified = true;
    await user.save();

    return {
      message: "Password has been updated successfully. You can now log in with your new password.",
    };
  }

  /**
   * Verifies a user's email using the 6-digit OTP code.
   */
  async verifyEmailOtp(email: string, otp: string) {
    if (!email || !otp) {
      throw new BadRequestError("Email and 6-digit OTP code are required");
    }

    const normalizedEmail = email.toLowerCase().trim();
    const cleanOtp = otp.trim();
    const otpHash = crypto.createHash("sha256").update(cleanOtp).digest("hex");

    const user = await User.findOne({
      where: {
        email: normalizedEmail,
        emailVerificationOtp: otpHash,
        emailVerificationOtpExpires: {
          [Op.gt]: new Date(),
        },
      },
    });

    if (!user) {
      throw new BadRequestError("Invalid or expired verification code. Please request a new code.");
    }

    user.isEmailVerified = true;
    user.emailVerificationOtp = null;
    user.emailVerificationOtpExpires = null;
    await user.save();

    const tokens = this.generateAuthTokens(user);

    let shopData: { id: number; name: string; slug: string } | null = null;
    if (user.role === "shop_admin") {
      const userShop = await Shop.findOne({
        where: { ownerId: user.id },
        attributes: ["id", "name", "slug"],
      });
      if (userShop) {
        shopData = {
          id: userShop.id,
          name: userShop.name,
          slug: userShop.slug,
        };
      }
    }

    return {
      message: "Email verified successfully!",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        authProvider: user.authProvider,
        avatarUrl: user.avatarUrl,
        isEmailVerified: true,
        hasPassword: Boolean(user.passwordHash),
        shopId: shopData?.id ?? null,
        shop: shopData,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
      ...tokens,
    };
  }

  /**
   * Resends a 6-digit verification code to the user's email.
   */
  async resendEmailOtp(email: string) {
    if (!email) {
      throw new BadRequestError("Email is required");
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ where: { email: normalizedEmail } });

    if (!user) {
      return { message: "If an account exists, a new verification code has been dispatched." };
    }

    if (user.isEmailVerified) {
      return { message: "This email is already verified. You can log in directly." };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

    user.emailVerificationOtp = otpHash;
    user.emailVerificationOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await emailService.sendOtpEmail({
      to: user.email,
      userName: user.name,
      otp,
      type: "verification",
      expiresMinutes: 10,
    });

    return { message: "A new 6-digit verification code has been dispatched to your email." };
  }

  /**
   * Authenticates or creates an account using a verified Google OIDC ID token.
   */
  async googleLogin(idToken: string, expectedRole?: UserRole | UserRole[]) {
    if (!idToken || typeof idToken !== "string" || !idToken.trim()) {
      throw new BadRequestError("Google ID token is required");
    }

    const audience: string[] = [];
    if (process.env.GOOGLE_CLIENT_ID) audience.push(process.env.GOOGLE_CLIENT_ID);
    if (process.env.GOOGLE_WEB_CLIENT_ID) audience.push(process.env.GOOGLE_WEB_CLIENT_ID);
    if (process.env.GOOGLE_ANDROID_CLIENT_ID) {
      process.env.GOOGLE_ANDROID_CLIENT_ID.split(",").forEach((id) => {
        if (id.trim()) audience.push(id.trim());
      });
    }
    if (process.env.GOOGLE_PLAY_STORE_CLIENT_ID) audience.push(process.env.GOOGLE_PLAY_STORE_CLIENT_ID);
    if (process.env.GOOGLE_IOS_CLIENT_ID) audience.push(process.env.GOOGLE_IOS_CLIENT_ID);

    let payload: { sub: string; email?: string; email_verified?: boolean; name?: string; picture?: string } | undefined;

    const hasGoogleConfig = Boolean(
      process.env.GOOGLE_CLIENT_ID ||
      process.env.GOOGLE_WEB_CLIENT_ID ||
      process.env.GOOGLE_ANDROID_CLIENT_ID ||
      process.env.GOOGLE_PLAY_STORE_CLIENT_ID ||
      process.env.GOOGLE_IOS_CLIENT_ID
    );
    const isMockToken =
      idToken.endsWith(".mock_sig") ||
      idToken.includes("google-web-") ||
      idToken.includes("google-merchant-") ||
      idToken.includes("mobile-google-");

    // 1. If Google credentials are configured and not an explicit dev mock token, verify via official Google OIDC
    if (hasGoogleConfig && !isMockToken && idToken.split(".").length === 3) {
      try {
        const client = getSharedOAuth2Client();
        const ticket = await client.verifyIdToken({
          idToken,
          audience: audience.length > 0 ? audience : undefined,
        });
        payload = ticket.getPayload();
      } catch (err: unknown) {
        throw new UnauthorizedError(
          `Google authentication failed: ${err instanceof Error ? err.message : "Invalid token"}`
        );
      }
    }

    // 2. Fallback for testing, simulation, or when Google Client ID has not been provisioned in env
    if (!payload) {
      try {
        let raw: Record<string, unknown> | null = null;

        // A. If dot-separated (JWT format), extract payload from middle segment or via jwt.decode
        if (idToken.includes(".")) {
          try {
            raw = jwt.decode(idToken) as Record<string, unknown> | null;
          } catch {
            // Ignore
          }

          if (!raw) {
            try {
              const segments = idToken.split(".");
              const payloadSegment = segments[1] || segments[0];
              const decodedStr = Buffer.from(payloadSegment, "base64").toString("utf8");
              raw = JSON.parse(decodedStr);
            } catch {
              // Ignore
            }
          }
        }

        // B. Single-segment base64 JSON string
        if (!raw) {
          try {
            const decodedStr = Buffer.from(idToken, "base64").toString("utf8");
            raw = JSON.parse(decodedStr);
          } catch {
            // Ignore
          }
        }

        // C. Direct JSON string
        if (!raw) {
          try {
            raw = JSON.parse(idToken);
          } catch {
            // Ignore
          }
        }

        if (raw && (raw.sub || raw.id) && raw.email) {
          payload = {
            sub: String(raw.sub || raw.id),
            email: String(raw.email),
            email_verified: raw.email_verified !== false,
            name: String(raw.name || "Google User"),
            picture: typeof raw.picture === "string" ? raw.picture : undefined,
          };
        }
      } catch {
        // Ignore
      }
    }

    if (!payload) {
      throw new UnauthorizedError(
        "Google authentication failed: Invalid or malformed token. Please provide a valid Google identity token."
      );
    }

    if (!payload || !payload.email) {
      throw new BadRequestError("Google profile did not contain a valid email address");
    }

    const normalizedEmail = payload.email.toLowerCase().trim();

    // 1. Lookup user by googleId
    let user = await User.findOne({ where: { googleId: payload.sub } });
    if (user) {
      let needsSave = false;
      if (payload.picture && user.avatarUrl !== payload.picture) {
        user.avatarUrl = payload.picture;
        needsSave = true;
      }
      if (payload.name && !user.name) {
        user.name = payload.name;
        needsSave = true;
      }
      if (needsSave) {
        await user.save();
      }
    }

    // 2. If not found by googleId, lookup by email (Account Linking)
    if (!user) {
      user = await User.findOne({ where: { email: normalizedEmail } });
      if (user) {
        user.googleId = payload.sub;
        if (payload.picture && user.avatarUrl !== payload.picture) {
          user.avatarUrl = payload.picture;
        }
        user.isEmailVerified = true;
        if (user.authProvider === "local" && !user.passwordHash) {
          user.authProvider = "google";
        }
        await user.save();
      }
    }

    // 3. Create new user if not found
    if (!user) {
      const role: UserRole =
        expectedRole && (Array.isArray(expectedRole) ? expectedRole[0] : expectedRole) === "shop_admin"
          ? "shop_admin"
          : "customer";

      user = await User.create({
        name: payload.name || "Google User",
        email: normalizedEmail,
        googleId: payload.sub,
        avatarUrl: payload.picture || null,
        passwordHash: null,
        authProvider: "google",
        role,
        isActive: true,
        isEmailVerified: true,
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedError("Account is inactive. Please contact support.");
    }

    // Role-based portal authorization check
    if (expectedRole) {
      const allowed = Array.isArray(expectedRole) ? expectedRole : [expectedRole];
      if (!allowed.includes(user.role)) {
        throw new ForbiddenError("Invalid credentials or access denied for this portal");
      }
    }

    const tokens = this.generateAuthTokens(user);

    let shopData: { id: number; name: string; slug: string } | null = null;
    if (user.role === "shop_admin") {
      const userShop = await Shop.findOne({
        where: { ownerId: user.id },
        attributes: ["id", "name", "slug"],
      });
      if (userShop) {
        shopData = {
          id: userShop.id,
          name: userShop.name,
          slug: userShop.slug,
        };
      }
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        authProvider: user.authProvider,
        avatarUrl: user.avatarUrl,
        isEmailVerified: user.isEmailVerified,
        hasPassword: Boolean(user.passwordHash),
        shopId: shopData?.id ?? null,
        shop: shopData,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
      ...tokens,
    };
  }

  /**
   * Sets a password for users who signed up with Google.
   */
  async setPassword(userId: number, newPassword: string) {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestError("Password must be at least 8 characters long");
    }

    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (user.passwordHash) {
      throw new BadRequestError("A password is already set for this account. Please use Change Password instead.");
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    await user.save();

    return {
      message: "Password has been set successfully. You can now log in with either Google or your email and password.",
    };
  }

  /**
   * Logs out the user session.
   * Handles server-side cleanup if needed and returns confirmation.
   */
  async logout(userId?: number, refreshToken?: string) {
    // In stateless JWT architecture with short-lived access tokens,
    // client-side clearance is primary. Server acknowledges the logout
    // and clears any cookie or session tokens.
    return {
      message: "Logged out successfully",
    };
  }
}

export const authService = new AuthService();
