import { Entity, PrimaryGeneratedColumn, OneToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from './user.entity';
import { Payment } from './payment.entity';
import { Rating } from './rating.entity';
import { Session } from './session.entity';

@Entity('students')
export class Student {
  @PrimaryGeneratedColumn()
  student_id: number;

  @OneToOne(() => User, (user) => user.student_profile)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => Payment, (payment) => payment.student)
  payments: Payment[];
  
  @OneToMany(() => Rating, (rating) => rating.student)
  ratings: Rating[];

  @OneToMany(() => Session, (session) => session.student)
  sessions: Session[];
}
