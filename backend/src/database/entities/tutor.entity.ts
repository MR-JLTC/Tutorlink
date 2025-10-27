import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, OneToMany, ManyToOne } from 'typeorm';
import { User } from './user.entity';
import { TutorDocument } from './tutor-document.entity';
import { TutorSubject } from './tutor-subject.entity';
import { TutorAvailability } from './tutor-availability.entity';
import { Session } from './session.entity';
import { Payment } from './payment.entity';
import { SubjectApplication } from './subject-application.entity';
// AvailabilityChangeRequest entity removed
import { BookingRequest } from './booking-request.entity';
import { University } from './university.entity';
import { Course } from './course.entity';

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
  gcash_qr_url: string;

  @Column({ nullable: true })
  gcash_number: string;

  @Column({ nullable: true })
  university_id: number;

  @Column({ nullable: true })
  course_id: number;

  @Column({ nullable: true })
  year_level: number; // Changed to number

  @ManyToOne(() => University, (university) => university.tutors)
  @JoinColumn({ name: 'university_id' })
  university: University;

  @ManyToOne(() => Course, (course) => course.tutors)
  @JoinColumn({ name: 'course_id' })
  course: Course;

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

  @OneToMany(() => SubjectApplication, (application) => application.tutor)
  subjectApplications: SubjectApplication[];

  // availabilityChangeRequests removed

  @OneToMany(() => BookingRequest, (request) => request.tutor)
  bookingRequests: BookingRequest[];
}
