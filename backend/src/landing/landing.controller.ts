import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student, Tutor, University, Course, BookingRequest } from '../database/entities';

@Controller('landing')
export class LandingController {
  constructor(
    @InjectRepository(Student) private readonly studentsRepo: Repository<Student>,
    @InjectRepository(Tutor) private readonly tutorsRepo: Repository<Tutor>,
    @InjectRepository(University) private readonly universitiesRepo: Repository<University>,
    @InjectRepository(Course) private readonly coursesRepo: Repository<Course>,
    @InjectRepository(BookingRequest) private readonly bookingRequestsRepo: Repository<BookingRequest>,
  ) {}

  @Get('stats')
  async stats() {
    const [students, tutors, universities, courses, sessions] = await Promise.all([
      this.studentsRepo.count(),
      this.tutorsRepo.count(),
      this.universitiesRepo.count(),
      this.coursesRepo.count(),
      this.bookingRequestsRepo.count({ where: { status: 'completed' } }),
    ]);
    return { students, tutors, universities, courses, sessions };
  }
}


