import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, Admin, Tutor, Course, University, Student } from '../database/entities';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from '../auth/auth.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
    @InjectRepository(Tutor)
    private tutorRepository: Repository<Tutor>,
    @InjectRepository(Course)
    private coursesRepository: Repository<Course>,
    @InjectRepository(University)
    private universitiesRepository: Repository<University>,
    @InjectRepository(Student)
    private studentRepository: Repository<Student>,
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

  async findTutorProfile(userId: number): Promise<Tutor | null> {
    return this.tutorRepository.findOne({ where: { user: { user_id: userId } } });
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

  async createStudent(body: { name: string; email: string; password: string; university_id: number; course_id?: number; course_name?: string; year_level: number }): Promise<User> {
    const hashed = await bcrypt.hash(body.password, 10);

    // Resolve course: either provided course_id or create/find by name under university
    let resolvedCourseId: number | null = body.course_id ?? null;
    if (!resolvedCourseId && body.course_name && body.course_name.trim().length > 0) {
      const uni = await this.universitiesRepository.findOne({ where: { university_id: body.university_id as any } });
      if (uni) {
        const existingCourse = await this.coursesRepository.findOne({ where: { course_name: body.course_name.trim(), university: { university_id: uni.university_id } as any }, relations: ['university'] });
        if (existingCourse) {
          resolvedCourseId = existingCourse.course_id;
        } else {
          const newCourse = this.coursesRepository.create({ course_name: body.course_name.trim(), university: uni } as any);
          const savedCourse: Course = await this.coursesRepository.save(newCourse as any);
          resolvedCourseId = savedCourse.course_id;
        }
      }
    }

    const user = this.usersRepository.create({
      name: body.name,
      email: body.email,
      password: hashed,
      is_verified: false,
      status: 'active' as any,
      university_id: body.university_id as any,
      course_id: (resolvedCourseId ?? null) as any,
      year_level: body.year_level as any,
    } as any);
    const savedUser: User = await this.usersRepository.save(user as any as User);

    // Create student profile
    const student = this.studentRepository.create({ user: savedUser } as any);
    await this.studentRepository.save(student as any);

    return (await this.findOneById(savedUser.user_id)) as User;
  }
}
