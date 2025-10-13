import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subject } from '../database/entities';

@Controller('subjects')
export class SubjectsController {
  constructor(
    @InjectRepository(Subject) private readonly subjectRepo: Repository<Subject>,
  ) {}

  // Public list of subjects for dropdown
  @Get()
  async list() {
    const subjects = await this.subjectRepo.find({ order: { subject_name: 'ASC' } as any });
    return subjects.map(s => ({ subject_id: s.subject_id, subject_name: s.subject_name }));
  }
}


