import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Tutor } from './tutor.entity';
import { User } from './user.entity';

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
    enum: ['pending', 'accepted', 'declined', 'awaiting_payment', 'confirmed', 'completed', 'cancelled'],
    default: 'pending',
  })
  status: 'pending' | 'accepted' | 'declined' | 'awaiting_payment' | 'confirmed' | 'completed' | 'cancelled';

  @Column({ type: 'text', nullable: true })
  payment_proof: string;

  @Column({ type: 'text', nullable: true })
  student_notes: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
