import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Student } from './student.entity';
import { Tutor } from './tutor.entity';
import { Session } from './session.entity';

@Entity('ratings')
export class Rating {
  @PrimaryGeneratedColumn()
  rating_id: number;

  @ManyToOne(() => Student, (student) => student.ratings)
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @ManyToOne(() => Tutor)
  @JoinColumn({ name: 'tutor_id' })
  tutor: Tutor;
  
  @ManyToOne(() => Session, (session) => session.ratings)
  @JoinColumn({ name: 'session_id' })
  session: Session;

  @Column()
  rating: number; // e.g., 1 to 5

  @Column('text', { nullable: true })
  comment: string;

  @CreateDateColumn()
  created_at: Date;
}
