import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User, type UserRole } from "../users/user.model";
import { NotFoundError, BadRequestError, UnauthorizedError, ConflictError } from "../../core/errors/AppError";

const JWT_SECRET = process.env.JWT_SECRET || "findshop_jwt_secret_dev_key_change_in_prod";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "30d";

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
}

export class AuthService {
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

    const token = this.generateToken(user);

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
      token,
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

    const token = this.generateToken(user);

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
      token,
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

  private generateToken(user: User): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] }
    );
  }
}


export const authService = new AuthService();
