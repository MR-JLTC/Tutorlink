import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToOne, OneToMany } from 'typeorm';
import { University } from './university.entity';
import { Course } from './course.entity';
import { Admin } from './admin.entity';
import { Student } from './student.entity';
import { Tutor } from './tutor.entity';
import { BookingRequest } from './booking-request.entity';
import { PasswordResetToken } from './password-reset-token.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  user_id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password?: string;

  @Column({
    type: 'enum',
    enum: ['tutor', 'tutee', 'admin'],
    nullable: true,
  })
  user_type: 'tutor' | 'tutee' | 'admin';

  @Column({
    type: 'enum',
    enum: ['active', 'inactive', 'pending_verification'],
    nullable: true,
  })
  status: 'active' | 'inactive' | 'pending_verification';

  @CreateDateColumn()
  created_at: Date;

  @Column({ nullable: true })
  profile_image_url: string;

  // Removed university_id and course_id columns from User entity as they are profile-specific

  // Removed ManyToOne and JoinColumn for university and course as they are profile-specific

  @OneToOne(() => Admin, (admin) => admin.user)
  admin_profile: Admin;

  @OneToOne(() => Student, (student) => student.user)
  student_profile: Student;

  @OneToOne(() => Tutor, (tutor) => tutor.user)
  tutor_profile: Tutor;

  @OneToMany(() => BookingRequest, (request) => request.student)
  bookingRequests: BookingRequest[];

  @OneToMany(() => PasswordResetToken, (token) => token.user)
  passwordResetTokens: PasswordResetToken[];
}
