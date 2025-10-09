import { Entity, PrimaryGeneratedColumn, OneToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('admins')
export class Admin {
  @PrimaryGeneratedColumn()
  admin_id: number;

  @OneToOne(() => User, (user) => user.admin_profile)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
