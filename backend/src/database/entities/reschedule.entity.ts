import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BookingRequest } from './booking-request.entity';
import { User } from './user.entity';

@Entity('reschedules')
export class Reschedule {
  @PrimaryGeneratedColumn()
  reschedule_id: number;

  @ManyToOne(() => BookingRequest, { nullable: false })
  @JoinColumn({ name: 'booking_id' })
  booking: BookingRequest;

  @Column()
  proposer_user_id: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'proposer_user_id' })
  proposer?: User;

  @Column({ type: 'date' })
  proposedDate: Date;

  @Column()
  proposedTime: string;

  @Column({ type: 'decimal', precision: 3, scale: 1, nullable: true })
  proposedDuration?: number;

  // Store original booking values so we can revert if the receiver rejects
  @Column({ type: 'date', nullable: true })
  originalDate?: Date;

  @Column({ nullable: true })
  originalTime?: string;

  @Column({ type: 'decimal', precision: 3, scale: 1, nullable: true })
  originalDuration?: number;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ type: 'enum', enum: ['pending', 'accepted', 'rejected', 'cancelled'], default: 'pending' })
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';

  @Column({ nullable: true })
  receiver_user_id?: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
