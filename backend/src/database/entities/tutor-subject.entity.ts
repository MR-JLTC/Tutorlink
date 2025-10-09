import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Tutor } from './tutor.entity';
import { Subject } from './subject.entity';

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
}
