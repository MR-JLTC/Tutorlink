import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Tutor } from './tutor.entity';
import { User } from './user.entity';
import { Payment } from './payment.entity';

@Entity('booking_requests')
export class BookingRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Tutor, tutor => tutor.bookingRequests)
  @JoinColumn({ name: 'tutor_id' })
  tutor: Tutor;

  @ManyToOne(() => User, user => user.bookingRequests)
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column()
  subject: string;

  @Column({ type: 'date' })
  date: Date;

  @Column()
  time: string;

  @Column({ type: 'decimal', precision: 3, scale: 1 })
  duration: number;

  @Column({
    type: 'enum',
    enum: [
      'pending',
      'accepted',
      'declined',
      'awaiting_payment',
      'payment_pending',
      'payment_rejected',
      'payment_approved',
      'awaiting_confirmation',
      'upcoming',
      'completed',
      'cancelled'
    ],
    default: 'pending',
  })
  status:
    | 'pending'
    | 'accepted'
    | 'declined'
    | 'awaiting_payment'
    | 'payment_pending'
    | 'payment_rejected'
    | 'payment_approved'
    | 'awaiting_confirmation'
    | 'upcoming'
    | 'completed'
    | 'cancelled';

  @Column({ type: 'text', nullable: true })
  payment_proof: string;

    @Column({ type: 'timestamp', nullable: true })
    tutor_marked_done_at?: Date;

    @Column({ type: 'timestamp', nullable: true })
    tutee_marked_done_at?: Date;

  @Column({ type: 'text', nullable: true })
  student_notes: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @Column({ type: 'decimal', precision: 2, scale: 1, nullable: true })
  tutee_rating?: number;

  @Column({ type: 'text', nullable: true })
  tutee_comment?: string;

  @Column({ type: 'timestamp', nullable: true })
  tutee_feedback_at?: Date;

  @OneToMany(() => Payment, (payment) => payment.bookingRequest)
  payments?: Payment[];
}
