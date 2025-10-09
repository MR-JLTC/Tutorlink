import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tutor, User } from '../database/entities';

@Injectable()
export class TutorsService {
  constructor(
    @InjectRepository(Tutor)
    private tutorsRepository: Repository<Tutor>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  findPendingApplications(): Promise<Tutor[]> {
    return this.tutorsRepository.find({
      where: { status: 'pending' },
      relations: [
        'user',
        'user.university',
        'user.course',
        'documents',
      ],
    });
  }

  async updateStatus(id: number, status: 'approved' | 'rejected'): Promise<Tutor> {
    const tutor = await this.tutorsRepository.findOne({ 
      where: { tutor_id: id },
      relations: ['user']
    });
    if (!tutor) {
      throw new NotFoundException(`Tutor with ID ${id} not found`);
    }

    tutor.status = status;
    
    if (status === 'approved') {
      const user = tutor.user;
      if (user) {
        user.is_verified = true;
        await this.usersRepository.save(user);
      }
    }

    return this.tutorsRepository.save(tutor);
  }
}
