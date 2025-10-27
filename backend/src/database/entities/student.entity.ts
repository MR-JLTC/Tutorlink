import { Entity, PrimaryGeneratedColumn, OneToOne, JoinColumn, OneToMany, Column, ManyToOne } from 'typeorm';
import { User } from './user.entity';
import { Payment } from './payment.entity';
import { Rating } from './rating.entity';
import { Session } from './session.entity';
import { University } from './university.entity';
import { Course } from './course.entity';

@Entity('students')
export class Student {
  @PrimaryGeneratedColumn()
  student_id: number;

  @Column({ nullable: true })
  university_id: number;

  @Column({ nullable: true })
  course_id: number;

  @Column({ nullable: true })
  year_level: number;

  @OneToOne(() => User, (user) => user.student_profile)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => University, (university) => university.students)
  @JoinColumn({ name: 'university_id' })
  university: University;

  @ManyToOne(() => Course, (course) => course.students)
  @JoinColumn({ name: 'course_id' })
  course: Course;

  @OneToMany(() => Payment, (payment) => payment.student)
  payments: Payment[];
  
  @OneToMany(() => Rating, (rating) => rating.student)
  ratings: Rating[];

  @OneToMany(() => Session, (session) => session.student)
  sessions: Session[];
}
