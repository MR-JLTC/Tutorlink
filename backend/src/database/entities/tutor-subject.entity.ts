import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Column, OneToMany } from 'typeorm';
import { Tutor } from './tutor.entity';
import { Subject } from './subject.entity';
import { TutorSubjectDocument } from './tutor-subject-document.entity';

@Entity('tutor_subjects')
export class TutorSubject {
  @PrimaryGeneratedColumn()
  tutor_subject_id: number;

  @ManyToOne(() => Tutor, (tutor) => tutor.subjects)
  @JoinColumn({ name: 'tutor_id' })
  tutor: Tutor;

  @ManyToOne(() => Subject, (subject) => subject.tutors)
  @JoinColumn({ name: 'subject_id' })
  subject: Subject;

  @Column({
    type: 'enum',
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  })
  status: 'pending' | 'approved' | 'rejected';

  @Column({ type: 'text', nullable: true })
  admin_notes: string;

  @OneToMany(() => TutorSubjectDocument, doc => doc.tutorSubject)
  documents: TutorSubjectDocument[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
