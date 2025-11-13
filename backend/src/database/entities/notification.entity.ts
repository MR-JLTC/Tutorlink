import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';
import { Session } from './session.entity';
import { BookingRequest } from './booking-request.entity';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  notification_id: number;

  @Column()
  userId: string;

  // New: numeric receiver id for easier and reliable filtering (references users.user_id)
  @Column({ nullable: true })
  receiver_id?: number;

  @Column()
  userType: 'tutor' | 'tutee' | 'admin';

  @ManyToOne(() => Session, { nullable: true })
  @JoinColumn({ name: 'session_id' })
  session: Session;

  @ManyToOne(() => BookingRequest, { nullable: true })
  @JoinColumn({ name: 'booking_id' })
  booking: BookingRequest;

  @Column()
  message: string;

  @CreateDateColumn()
  timestamp: Date;

  @Column({ default: false })
  read: boolean;

  @Column()
  sessionDate: Date;

  @Column()
  subjectName: string;
}