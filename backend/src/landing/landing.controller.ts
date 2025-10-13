import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, Tutor, University, Course, Session } from '../database/entities';

@Controller('landing')
export class LandingController {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Tutor) private readonly tutorsRepo: Repository<Tutor>,
    @InjectRepository(University) private readonly universitiesRepo: Repository<University>,
    @InjectRepository(Course) private readonly coursesRepo: Repository<Course>,
    @InjectRepository(Session) private readonly sessionsRepo: Repository<Session>,
  ) {}

  @Get('stats')
  async stats() {
    const [users, tutors, universities, courses, sessions] = await Promise.all([
      this.usersRepo.count(),
      this.tutorsRepo.count(),
      this.universitiesRepo.count(),
      this.coursesRepo.count(),
      this.sessionsRepo.count(),
    ]);
    return { users, tutors, universities, courses, sessions };
  }
}


