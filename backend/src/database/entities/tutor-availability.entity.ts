import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Tutor } from './tutor.entity';

@Entity('tutor_availabilities')
export class TutorAvailability {
  @PrimaryGeneratedColumn()
  availability_id: number;

  @ManyToOne(() => Tutor, (tutor) => tutor.availabilities)
  @JoinColumn({ name: 'tutor_id' })
  tutor: Tutor;

  @Column()
  day_of_week: string; // e.g., 'Monday', 'Tuesday'

  @Column('time')
  start_time: string;

  @Column('time')
  end_time: string;
}
