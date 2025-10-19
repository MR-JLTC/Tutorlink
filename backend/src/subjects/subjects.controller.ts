import { Controller, Get, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subject } from '../database/entities';

@Controller('subjects')
export class SubjectsController {
  constructor(
    @InjectRepository(Subject) private readonly subjectRepo: Repository<Subject>,
  ) {}

  // Public list of subjects for dropdown, filterable by university and course
  @Get()
  async list(
    @Query('university_id') universityId?: string,
    @Query('course_id') courseId?: string,
  ) {
    const qb = this.subjectRepo.createQueryBuilder('subject')
      .leftJoin('subject.course', 'course')
      .orderBy('subject.subject_name', 'ASC');

    const params: Record<string, any> = {};
    if (courseId) {
      qb.andWhere('course.course_id = :courseId');
      params.courseId = Number(courseId);
    }
    if (universityId) {
      // Filter via FK column present on courses table
      qb.andWhere('course.university_id = :universityId');
      params.universityId = Number(universityId);
    }
    if (Object.keys(params).length > 0) {
      qb.setParameters(params);
    }

    const subjects = await qb.getMany();
    return subjects.map(s => ({ subject_id: s.subject_id, subject_name: s.subject_name }));
  }
}


