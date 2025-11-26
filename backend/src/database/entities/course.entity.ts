import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { University } from './university.entity';
import { Subject } from './subject.entity';
import { User } from './user.entity';
import { Student } from './student.entity';
import { Tutor } from './tutor.entity';

@Entity('courses')
@Index(['course_name', 'university_id'], { unique: true })
export class Course {
  @PrimaryGeneratedColumn()
  course_id: number;

  @Column()
  course_name: string;

  @Column({ nullable: true })
  acronym: string;

  @Column({ nullable: true })
  university_id: number;

  @ManyToOne(() => University, (university) => university.courses)
  @JoinColumn({ name: 'university_id' })
  university: University;

  @OneToMany(() => Subject, (subject) => subject.course)
  subjects: Subject[];

  @OneToMany(() => Student, (student) => student.course)
  students: Student[];

  @OneToMany(() => Tutor, (tutor) => tutor.course)
  tutors: Tutor[];
}
