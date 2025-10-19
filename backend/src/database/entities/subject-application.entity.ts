import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Tutor } from './tutor.entity';
import { SubjectApplicationDocument } from './subject-application-document.entity';

@Entity('subject_applications')
export class SubjectApplication {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Tutor, tutor => tutor.subjectApplications)
  @JoinColumn({ name: 'tutor_id' })
  tutor: Tutor;

  @Column()
  subject_name: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  })
  status: 'pending' | 'approved' | 'rejected';

  @Column({ type: 'text', nullable: true })
  admin_notes: string;

  @OneToMany(() => SubjectApplicationDocument, doc => doc.subjectApplication)
  documents: SubjectApplicationDocument[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
