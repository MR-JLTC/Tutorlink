import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Student } from './student.entity';
import { Tutor } from './tutor.entity';
import { BookingRequest } from './booking-request.entity';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn()
  payment_id: number;

  @Column()
  student_id: number;

  @Column()
  tutor_id: number;

  @Column({ nullable: true })
  booking_request_id?: number;

  @Column({ type: 'text', nullable: true })
  subject?: string;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: ['pending', 'admin_confirmed', 'confirmed', 'rejected', 'refunded'],
    default: 'pending',
  })
  status: 'pending' | 'admin_confirmed' | 'confirmed' | 'rejected' | 'refunded';

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Student, (student) => student.payments)
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @ManyToOne(() => Tutor, (tutor) => tutor.payments)
  @JoinColumn({ name: 'tutor_id' })
  tutor: Tutor;

  @ManyToOne(() => BookingRequest, (booking) => booking.payments, { nullable: true })
  @JoinColumn({ name: 'booking_request_id' })
  bookingRequest?: BookingRequest;

  @Column({
    type: 'enum',
    enum: ['none', 'open', 'under_review', 'resolved', 'rejected'],
    default: 'none',
  })
  dispute_status: 'none' | 'open' | 'under_review' | 'resolved' | 'rejected';

  @Column({ type: 'text', nullable: true })
  dispute_proof_url?: string;

  @Column({ type: 'text', nullable: true })
  admin_note?: string;

  @Column({ type: 'text', nullable: true })
  admin_payment_proof_url?: string;

  @Column({ type: 'text', nullable: true })
  rejection_reason?: string;
}
