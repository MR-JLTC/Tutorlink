import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Student } from './student.entity';
import { Tutor } from './tutor.entity';
import { BookingRequest } from './booking-request.entity';
import { Subject } from './subject.entity';
import { Payout } from './payout.entity';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn()
  payment_id: number;

  @Column({ nullable: true })
  booking_request_id?: number;

  @Column()
  student_id: number;

  @Column()
  tutor_id: number;

  @Column({ nullable: true })
  subject_id?: number;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: ['pending', 'paid', 'disputed', 'refunded', 'confirmed'],
    default: 'pending',
  })
  status: 'pending' | 'paid' | 'disputed' | 'refunded' | 'confirmed';

  @Column({
    type: 'enum',
    enum: ['none', 'open', 'under_revision', 'resolved', 'rejected'],
    default: 'none',
  })
  dispute_status: 'none' | 'open' | 'under_revision' | 'resolved' | 'rejected';

  @Column({ type: 'text', nullable: true })
  payment_proof_url?: string;

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

  @ManyToOne(() => Subject, { nullable: true })
  @JoinColumn({ name: 'subject_id' })
  subject?: Subject;

  @OneToMany(() => Payout, (payout) => payout.payment)
  payouts: Payout[];
}
