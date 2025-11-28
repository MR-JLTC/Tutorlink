import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Payment } from './payment.entity';
import { Tutor } from './tutor.entity';

@Entity('payouts')
export class Payout {
  @PrimaryGeneratedColumn()
  payout_id: number;

  @Column()
  payment_id: number;

  @Column()
  tutor_id: number;

  @Column('decimal', { precision: 10, scale: 2 })
  amount_released: number;

  @Column({
    type: 'enum',
    enum: ['pending', 'released', 'failed'],
    default: 'pending',
  })
  status: 'pending' | 'released' | 'failed';

  @Column({ type: 'text', nullable: true })
  release_proof_url?: string;

  @Column({ type: 'text', nullable: true })
  rejection_reason?: string;

  @Column({ type: 'text', nullable: true })
  admin_notes?: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Payment, (payment) => payment.payouts)
  @JoinColumn({ name: 'payment_id' })
  payment: Payment;

  @ManyToOne(() => Tutor)
  @JoinColumn({ name: 'tutor_id' })
  tutor: Tutor;
}

