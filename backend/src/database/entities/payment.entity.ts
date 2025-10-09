import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Student } from './student.entity';
import { Tutor } from './tutor.entity';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn()
  payment_id: number;

  @Column()
  student_id: number;

  @Column()
  tutor_id: number;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: ['pending', 'confirmed', 'rejected', 'refunded'],
    default: 'pending',
  })
  status: 'pending' | 'confirmed' | 'rejected' | 'refunded';

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Student, (student) => student.payments)
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @ManyToOne(() => Tutor, (tutor) => tutor.payments)
  @JoinColumn({ name: 'tutor_id' })
  tutor: Tutor;

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
}
