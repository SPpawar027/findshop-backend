import { User, type UserRole } from "./user.model";
import { NotFoundError, ConflictError } from "../../core/errors/AppError";

export interface CreateUserInput {
  name: string;
  email: string;
  passwordHash: string;
  phone?: string | null;
  role?: UserRole;
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

    await user.update({
      name: data.name ?? user.name,
      email: data.email ?? user.email,
      phone: data.phone !== undefined ? data.phone : user.phone,
      role: data.role ?? user.role,
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
}

export const userService = new UserService();
