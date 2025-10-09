import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Tutor } from './tutor.entity';

@Entity('tutor_documents')
export class TutorDocument {
  @PrimaryGeneratedColumn()
  document_id: number;

  @ManyToOne(() => Tutor, (tutor) => tutor.documents)
  @JoinColumn({ name: 'tutor_id' })
  tutor: Tutor;

  @Column()
  file_url: string;

  @Column()
  file_name: string;

  @Column()
  file_type: string;
}
