import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, Admin } from '../database/entities';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from '../auth/auth.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
  ) {}

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({ relations: ['university', 'admin_profile', 'tutor_profile'] });
  }

  async findOneById(id: number): Promise<User | undefined> {
    return this.usersRepository.findOne({ where: { user_id: id } });
  }

  async findOneByEmail(email: string): Promise<User | undefined> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async createAdmin(registerDto: RegisterDto): Promise<User> {
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const newUser = this.usersRepository.create({
      ...registerDto,
      password: hashedPassword,
      is_verified: true,
    });
    const savedUser = await this.usersRepository.save(newUser);

    // Create an admin profile for this user
    const adminProfile = this.adminRepository.create({ user: savedUser });
    await this.adminRepository.save(adminProfile);
    
    // Reload user with profile
    return this.findOneById(savedUser.user_id);
  }

  async isAdmin(userId: number): Promise<boolean> {
      const admin = await this.adminRepository.findOne({ where: { user: { user_id: userId } } });
      return !!admin;
  }

  async updateStatus(userId: number, status: 'active' | 'inactive'): Promise<User> {
    const user = await this.findOneById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    (user as any).status = status;
    return this.usersRepository.save(user);
  }

  async resetPassword(userId: number, newPassword: string): Promise<{ success: true }>
  {
    const user = await this.findOneById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await this.usersRepository.save(user);
    return { success: true };
  }

  async updateUser(userId: number, body: { name?: string; email?: string; status?: 'active' | 'inactive'; year_level?: number; university_id?: number }): Promise<User> {
    const user = await this.findOneById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    if (body.name !== undefined) user.name = body.name;
    if (body.email !== undefined) user.email = body.email as any;
    if (body.status !== undefined) (user as any).status = body.status;
    if (body.year_level !== undefined) (user as any).year_level = body.year_level as any;
    if (body.university_id !== undefined) (user as any).university_id = body.university_id as any;
    return this.usersRepository.save(user);
  }

  async deleteUser(userId: number): Promise<{ success: true }> {
    try {
      await this.usersRepository.delete({ user_id: userId });
    } catch (error) {
      // Likely foreign key constraints (admin/tutor/student profiles, sessions, payments)
      throw new BadRequestException(
        'Unable to delete this user because they have related records (e.g., profiles, sessions, or payments). Please resolve related records first or deactivate the user instead.'
      );
    }
    return { success: true };
  }
}
