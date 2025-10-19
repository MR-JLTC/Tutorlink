import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { SubjectApplication } from './subject-application.entity';

@Entity('subject_application_documents')
export class SubjectApplicationDocument {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => SubjectApplication, application => application.documents)
  @JoinColumn({ name: 'subject_application_id' })
  subjectApplication: SubjectApplication;

  @Column()
  file_url: string;

  @Column()
  file_name: string;

  @Column()
  file_type: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
