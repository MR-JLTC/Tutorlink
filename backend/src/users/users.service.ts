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
    return this.usersRepository.find({ relations: ['admin_profile', 'tutor_profile', 'student_profile', 'student_profile.university', 'student_profile.course', 'tutor_profile.university', 'tutor_profile.course'] });
  }

  async findOneById(id: number): Promise<User | undefined> {
    return this.usersRepository.findOne({ where: { user_id: id }, relations: ['admin_profile', 'tutor_profile', 'student_profile', 'student_profile.university', 'student_profile.course', 'tutor_profile.university', 'tutor_profile.course'] });
  }

  async findOneByEmail(email: string): Promise<User | undefined> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async createAdmin(registerDto: RegisterDto): Promise<User> {
    let university: University | undefined;
    if (registerDto.university_id) {
      university = await this.universitiesRepository.findOne({ where: { university_id: registerDto.university_id } });
      if (!university) {
        throw new BadRequestException('Invalid university ID');
      }
    }

    const newUser = this.usersRepository.create({
      name: registerDto.name,
      email: registerDto.email,
      password: registerDto.password,
      user_type: 'admin',
      status: 'active',
    });
    const savedUser: User = await this.usersRepository.save(newUser);

    // Create an admin profile for this user and link university if provided
    const adminProfile = this.adminRepository.create({ 
      user: savedUser,
      ...(university && { university: university, university_id: university.university_id }) // Link university to admin profile if exists
    });
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

  async updatePassword(userId: number, hashedPassword: string): Promise<void> {
    await this.usersRepository.update(userId, { password: hashedPassword });
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

  async createStudent(body: RegisterDto): Promise<User> {
    // Password is already hashed in AuthService.register(), so use it directly
    console.log('=== CREATE STUDENT DEBUG ===');
    console.log('Password already hashed:', body.password.startsWith('$2b$'));

    // Resolve course: either provided course_id or create/find by name under university
    let resolvedCourseId: number | null = body.course_id ?? null;
    if (!resolvedCourseId && body.course_name && body.course_name.trim().length > 0) {
      const uni = await this.universitiesRepository.findOne({ where: { university_id: body.university_id } });
      if (uni) {
        const existingCourse = await this.coursesRepository.findOne({ where: { course_name: body.course_name.trim(), university: { university_id: uni.university_id } }, relations: ['university'] });
        if (existingCourse) {
          resolvedCourseId = existingCourse.course_id;
        } else {
          const newCourse = this.coursesRepository.create({ course_name: body.course_name.trim(), university: uni });
          const savedCourse: Course = await this.coursesRepository.save(newCourse);
          resolvedCourseId = savedCourse.course_id;
        }
      }
    }

    const user = this.usersRepository.create({
      name: body.name,
      email: body.email,
      password: body.password, // Use the already hashed password
      user_type: 'tutee',
      status: 'active', // Assuming registration only happens after email is verified
    });
    const savedUser: User = await this.usersRepository.save(user);

    // Resolve university and course for student profile
    let university: University | undefined;
    if (body.university_id) {
      university = await this.universitiesRepository.findOne({ where: { university_id: body.university_id } });
      if (!university) {
        throw new BadRequestException('Invalid university ID');
      }
    }

    let course: Course | undefined;
    if (resolvedCourseId) {
      course = await this.coursesRepository.findOne({ where: { course_id: resolvedCourseId } });
    }

    // Create student profile
    const student = this.studentRepository.create({
      user: savedUser,
      year_level: body.year_level,
      ...(university && { university: university, university_id: university.university_id }),
      ...(course && { course: course, course_id: course.course_id }),
    });
    await this.studentRepository.save(student);

    // Reload user with profile
    return (await this.usersRepository.findOne({ where: { user_id: savedUser.user_id }, relations: ['student_profile', 'student_profile.university', 'student_profile.course'] })) as User;
  }

  async createTutor(body: RegisterDto): Promise<User> {
    // Password is already hashed in AuthService.register(), so use it directly
    console.log('=== CREATE TUTOR DEBUG ===');
    console.log('Password already hashed:', body.password.startsWith('$2b$'));
    
    // Resolve course: either provided course_id or create/find by name under university
    let resolvedCourseId: number | null = body.course_id ?? null;
    if (!resolvedCourseId && body.course_name && body.course_name.trim().length > 0) {
      const uni = await this.universitiesRepository.findOne({ where: { university_id: body.university_id } });
      if (uni) {
        const existingCourse = await this.coursesRepository.findOne({ where: { course_name: body.course_name.trim(), university: { university_id: uni.university_id } }, relations: ['university'] });
        if (existingCourse) {
          resolvedCourseId = existingCourse.course_id;
        } else {
          const newCourse = this.coursesRepository.create({ course_name: body.course_name.trim(), university: uni });
          const savedCourse: Course = await this.coursesRepository.save(newCourse);
          resolvedCourseId = savedCourse.course_id;
        }
      }
    }

    const user = this.usersRepository.create({
      name: body.name,
      email: body.email,
      password: body.password, // Use the already hashed password
      user_type: 'tutor',
      status: 'active',
    });
    const savedUser: User = await this.usersRepository.save(user);

    // Resolve university and course for tutor profile
    let university: University | undefined;
    if (body.university_id) {
      university = await this.universitiesRepository.findOne({ where: { university_id: body.university_id } });
      if (!university) {
        throw new BadRequestException('Invalid university ID');
      }
    }

    let course: Course | undefined;
    if (resolvedCourseId) {
      course = await this.coursesRepository.findOne({ where: { course_id: resolvedCourseId } });
    }

    // Create tutor profile
    const tutor = this.tutorRepository.create({
      user: savedUser,
      bio: body.bio,
      year_level: body.year_level,
      gcash_number: body.gcash_number,
      ...(university && { university: university, university_id: university.university_id }),
      ...(course && { course: course, course_id: course.course_id }),
    });
    await this.tutorRepository.save(tutor);

    // Reload user with profile
    return (await this.usersRepository.findOne({ where: { user_id: savedUser.user_id }, relations: ['tutor_profile', 'tutor_profile.university', 'tutor_profile.course'] })) as User;
  }
}
