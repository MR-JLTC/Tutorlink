import { Entity, PrimaryGeneratedColumn, OneToOne, JoinColumn, ManyToOne, Column } from 'typeorm';
import { User } from './user.entity';
import { University } from './university.entity';

@Entity('admins')
export class Admin {
  @PrimaryGeneratedColumn()
  admin_id: number;

  @Column({ nullable: true })
  university_id: number;

  @OneToOne(() => User, (user) => user.admin_profile)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => University, (university) => university.admins)
  @JoinColumn({ name: 'university_id' })
  university: University;

  @Column({ type: 'text', nullable: true })
  qr_code_url?: string;
}
