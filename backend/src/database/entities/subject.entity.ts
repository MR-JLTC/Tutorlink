import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Course } from './course.entity';
import { TutorSubject } from './tutor-subject.entity';

@Entity('subjects')
export class Subject {
  @PrimaryGeneratedColumn()
  subject_id: number;

  @Column()
  subject_name: string;

  @ManyToOne(() => Course, (course) => course.subjects)
  @JoinColumn({ name: 'course_id' })
  course: Course;

  @OneToMany(() => TutorSubject, (tutorSubject) => tutorSubject.subject)
  tutors: TutorSubject[];
}
