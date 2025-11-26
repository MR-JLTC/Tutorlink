import { Injectable, BadRequestException } from '@nestjs/common';
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

  async createCourse(courseName: string, universityId: number, acronym?: string): Promise<Course> {
    const university = await this.universitiesRepository.findOne({ where: { university_id: universityId } });
    if (!university) throw new BadRequestException('University not found');
    
    // Check if course with same name already exists for this university
    const existingCourse = await this.coursesRepository.findOne({
      where: { 
        course_name: courseName,
        university: { university_id: universityId }
      },
      relations: ['university']
    });
    
    if (existingCourse) {
      throw new BadRequestException(`Course "${courseName}" already exists for this university.`);
    }
    
    // Check if course name matches an existing course's acronym (case-insensitive)
    const courseWithMatchingAcronym = await this.coursesRepository
      .createQueryBuilder('course')
      .where('LOWER(course.acronym) = LOWER(:courseName)', { courseName })
      .andWhere('course.university_id = :universityId', { universityId })
      .getOne();
    
    if (courseWithMatchingAcronym) {
      throw new BadRequestException(`Course name "${courseName}" conflicts with an existing course acronym "${courseWithMatchingAcronym.acronym}" for this university.`);
    }
    
    const course = this.coursesRepository.create({ course_name: courseName, acronym: acronym || null, university });
    try {
      return await this.coursesRepository.save(course);
    } catch (error: any) {
      // Handle unique constraint violation
      if (error.code === '23505' || error.message?.includes('UNIQUE constraint')) {
        throw new BadRequestException(`Course "${courseName}" already exists for this university.`);
      }
      throw error;
    }
  }

  async updateCourse(courseId: number, body: { course_name?: string; university_id?: number; acronym?: string }): Promise<Course> {
    const course = await this.coursesRepository.findOne({ where: { course_id: courseId }, relations: ['university'] });
    if (!course) throw new BadRequestException('Course not found');
    
    const newCourseName = body.course_name || course.course_name;
    const newUniversityId = body.university_id || course.university.university_id;
    
    // Check if another course with the same name exists for the target university
    if (body.course_name || body.university_id) {
      const existingCourse = await this.coursesRepository.findOne({
        where: { 
          course_name: newCourseName,
          university: { university_id: newUniversityId }
        },
        relations: ['university']
      });
      
      // Only throw error if it's a different course (not the one being updated)
      if (existingCourse && existingCourse.course_id !== courseId) {
        throw new BadRequestException(`Course "${newCourseName}" already exists for this university.`);
      }
    }
    
    // Check if course name matches an existing course's acronym (case-insensitive)
    // Only check if course name is being updated
    if (body.course_name) {
      const courseWithMatchingAcronym = await this.coursesRepository
        .createQueryBuilder('course')
        .where('LOWER(course.acronym) = LOWER(:courseName)', { courseName: newCourseName })
        .andWhere('course.university_id = :universityId', { universityId: newUniversityId })
        .andWhere('course.course_id != :courseId', { courseId })
        .getOne();
      
      if (courseWithMatchingAcronym) {
        throw new BadRequestException(`Course name "${newCourseName}" conflicts with an existing course acronym "${courseWithMatchingAcronym.acronym}" for this university.`);
      }
    }
    
    if (body.course_name) course.course_name = body.course_name;
    if (body.acronym !== undefined) course.acronym = body.acronym || null;
    if (body.university_id) {
      const uni = await this.universitiesRepository.findOne({ where: { university_id: body.university_id } });
      if (!uni) throw new BadRequestException('University not found');
      course.university = uni;
    }
    
    try {
      return await this.coursesRepository.save(course);
    } catch (error: any) {
      // Handle unique constraint violation
      if (error.code === '23505' || error.message?.includes('UNIQUE constraint')) {
        throw new BadRequestException(`Course "${newCourseName}" already exists for this university.`);
      }
      throw error;
    }
  }

  async addSubjectToCourse(courseId: number, subjectName: string): Promise<Subject> {
    const course = await this.coursesRepository.findOne({ where: { course_id: courseId } });
    if (!course) throw new Error('Course not found');
    const subject = this.subjectsRepository.create({ subject_name: subjectName, course });
    return this.subjectsRepository.save(subject);
  }

  async updateSubject(courseId: number, subjectId: number, body: { subject_name?: string }): Promise<Subject> {
    const subject = await this.subjectsRepository.findOne({ where: { subject_id: subjectId }, relations: ['course'] });
    if (!subject || subject.course.course_id !== courseId) throw new Error('Subject not found for course');
    if (body.subject_name !== undefined) subject.subject_name = body.subject_name;
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
