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

  @Column({ default: false })
  is_verified: boolean;

  @Column({
    type: 'enum',
    enum: ['active', 'inactive'],
    default: 'active',
  })
  status: 'active' | 'inactive';

  @CreateDateColumn()
  created_at: Date;

  @Column({ nullable: true })
  university_id: number;

  @Column({ nullable: true })
  course_id: number;

  @Column({ nullable: true })
  profile_image_url: string;

  @Column({ nullable: true })
  year_level: number;

  @ManyToOne(() => University, (university) => university.users)
  @JoinColumn({ name: 'university_id' })
  university: University;

  @ManyToOne(() => Course, (course) => course.users)
  @JoinColumn({ name: 'course_id' })
  course: Course;

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
