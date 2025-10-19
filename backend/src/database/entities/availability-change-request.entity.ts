import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Tutor } from './tutor.entity';

@Entity('availability_change_requests')
export class AvailabilityChangeRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Tutor, tutor => tutor.availabilityChangeRequests)
  @JoinColumn({ name: 'tutor_id' })
  tutor: Tutor;

  @Column()
  day_of_week: string;

  @Column()
  start_time: string;

  @Column()
  end_time: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  })
  status: 'pending' | 'approved' | 'rejected';

  @Column({ type: 'text', nullable: true })
  admin_notes: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
