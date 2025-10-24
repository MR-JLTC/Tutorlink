import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { TutorSubject } from './tutor-subject.entity';

@Entity('tutor_subject_documents')
export class TutorSubjectDocument {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => TutorSubject, tutorSubject => tutorSubject.documents)
  @JoinColumn({ name: 'tutor_subject_id' })
  tutorSubject: TutorSubject;

  @Column()
  file_url: string;

  @Column()
  file_name: string;

  @Column()
  file_type: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
