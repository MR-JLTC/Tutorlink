import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Course, Subject } from '../database/entities';
import { University } from '../database/entities/university.entity';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course)
    private coursesRepository: Repository<Course>,
    @InjectRepository(Subject)
    private subjectsRepository: Repository<Subject>,
    @InjectRepository(University)
    private universitiesRepository: Repository<University>,
  ) {}

  findAllWithDetails(): Promise<Course[]> {
    return this.coursesRepository.find({ relations: ['university'] });
  }

  findSubjectsForCourse(courseId: number): Promise<Subject[]> {
    return this.subjectsRepository.find({
      where: { course: { course_id: courseId } },
    });
  }

  async createCourse(courseName: string, universityId: number): Promise<Course> {
    const university = await this.universitiesRepository.findOne({ where: { university_id: universityId } });
    if (!university) throw new Error('University not found');
    const course = this.coursesRepository.create({ course_name: courseName, university });
    return this.coursesRepository.save(course);
  }

  async updateCourse(courseId: number, body: { course_name?: string; university_id?: number }): Promise<Course> {
    const course = await this.coursesRepository.findOne({ where: { course_id: courseId }, relations: ['university'] });
    if (!course) throw new Error('Course not found');
    if (body.course_name) course.course_name = body.course_name;
    if (body.university_id) {
      const uni = await this.universitiesRepository.findOne({ where: { university_id: body.university_id } });
      if (!uni) throw new Error('University not found');
      course.university = uni;
    }
    return this.coursesRepository.save(course);
  }

  async addSubjectToCourse(courseId: number, subjectName: string, semester?: string): Promise<Subject> {
    const course = await this.coursesRepository.findOne({ where: { course_id: courseId } });
    if (!course) throw new Error('Course not found');
    const subject = this.subjectsRepository.create({ subject_name: subjectName, semester, course });
    return this.subjectsRepository.save(subject);
  }

  async updateSubject(courseId: number, subjectId: number, body: { subject_name?: string; semester?: string }): Promise<Subject> {
    const subject = await this.subjectsRepository.findOne({ where: { subject_id: subjectId }, relations: ['course'] });
    if (!subject || subject.course.course_id !== courseId) throw new Error('Subject not found for course');
    if (body.subject_name !== undefined) subject.subject_name = body.subject_name;
    if (body.semester !== undefined) (subject as any).semester = body.semester;
    return this.subjectsRepository.save(subject);
  }

  async deleteCourse(courseId: number): Promise<{ success: true }> {
    await this.coursesRepository.delete({ course_id: courseId });
    return { success: true };
  }

  async deleteSubject(courseId: number, subjectId: number): Promise<{ success: true }> {
    const subject = await this.subjectsRepository.findOne({ where: { subject_id: subjectId }, relations: ['course'] });
    if (!subject || subject.course.course_id !== courseId) throw new Error('Subject not found for course');
    await this.subjectsRepository.delete({ subject_id: subjectId });
    return { success: true };
  }
}
