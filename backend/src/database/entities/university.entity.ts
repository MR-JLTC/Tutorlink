import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { User } from './user.entity';
import { Course } from './course.entity';

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

  @Column({
    type: 'enum',
    enum: ['active', 'inactive'],
    default: 'active',
  })
  status: 'active' | 'inactive';

  @OneToMany(() => User, (user) => user.university)
  users: User[];

  @OneToMany(() => Course, (course) => course.university)
  courses: Course[];
}
