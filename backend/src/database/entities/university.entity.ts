import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { User } from './user.entity';
import { Course } from './course.entity';
import { Admin } from './admin.entity';
import { Student } from './student.entity';
import { Tutor } from './tutor.entity';

@Entity('universities')
export class University {
  @PrimaryGeneratedColumn()
  university_id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  acronym: string;

  @Column()
  email_domain: string;

  @Column({ nullable: true })
  logo_url: string;

  @Column({
    type: 'enum',
    enum: ['active', 'inactive'],
    default: 'active',
  })
  status: 'active' | 'inactive';

  @OneToMany(() => Admin, (admin) => admin.university)
  admins: Admin[];

  @OneToMany(() => Student, (student) => student.university)
  students: Student[];

  @OneToMany(() => Tutor, (tutor) => tutor.university)
  tutors: Tutor[];

  @OneToMany(() => Course, (course) => course.university)
  courses: Course[];
}
