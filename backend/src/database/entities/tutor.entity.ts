import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from './user.entity';
import { TutorDocument } from './tutor-document.entity';
import { TutorSubject } from './tutor-subject.entity';
import { TutorAvailability } from './tutor-availability.entity';
import { Session } from './session.entity';
import { Payment } from './payment.entity';

@Entity('tutors')
export class Tutor {
  @PrimaryGeneratedColumn()
  tutor_id: number;

  @OneToOne(() => User, user => user.tutor_profile)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column('text')
  bio: string;

  @Column({ nullable: true })
  profile_image_url: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  })
  status: 'pending' | 'approved' | 'rejected';

  @OneToMany(() => TutorDocument, (doc) => doc.tutor)
  documents: TutorDocument[];

  @OneToMany(() => TutorSubject, (tutorSubject) => tutorSubject.tutor)
  subjects: TutorSubject[];
  
  @OneToMany(() => TutorAvailability, (availability) => availability.tutor)
  availabilities: TutorAvailability[];

  @OneToMany(() => Session, (session) => session.tutor)
  sessions: Session[];

  @OneToMany(() => Payment, (payment) => payment.tutor)
  payments: Payment[];
}
