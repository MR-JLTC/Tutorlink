import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tutor, User, TutorDocument, TutorAvailability, TutorSubject, Subject, Course, University } from '../database/entities';
import type { Express } from 'express';
import * as bcrypt from 'bcrypt';

@Injectable()
export class TutorsService {
  constructor(
    @InjectRepository(Tutor)
    private tutorsRepository: Repository<Tutor>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Course)
    private coursesRepository: Repository<Course>,
    @InjectRepository(University)
    private universitiesRepository: Repository<University>,
    @InjectRepository(TutorDocument)
    private documentsRepository: Repository<TutorDocument>,
    @InjectRepository(TutorAvailability)
    private availabilityRepository: Repository<TutorAvailability>,
    @InjectRepository(TutorSubject)
    private tutorSubjectRepository: Repository<TutorSubject>,
    @InjectRepository(Subject)
    private subjectRepository: Repository<Subject>,
  ) {}

  findPendingApplications(): Promise<Tutor[]> {
    return this.tutorsRepository.find({
      where: { status: 'pending' },
      relations: [
        'user',
        'user.university',
        'user.course',
        'documents',
        'subjects',
        'subjects.subject',
        'availabilities'
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

  async applyTutor(data: { email: string; password: string; university_id: number; course_id?: number; course_name?: string; name?: string; bio?: string }): Promise<{ success: true; user_id: number; tutor_id: number }> {
    const existing = await this.usersRepository.findOne({ where: { email: data.email } });
    if (existing) {
      throw new Error('Email already registered');
    }

    const hashed = await bcrypt.hash(data.password, 10);

    // If no course_id but course_name provided, find or create the course under the university
    let resolvedCourseId: number | null = data.course_id ?? null;
    if (!resolvedCourseId && data.course_name && data.course_name.trim().length > 0) {
      const uni = await this.universitiesRepository.findOne({ where: { university_id: data.university_id as any } });
      if (uni) {
        const existingCourse = await this.coursesRepository.findOne({ where: { course_name: data.course_name.trim(), university: { university_id: uni.university_id } as any }, relations: ['university'] });
        if (existingCourse) {
          resolvedCourseId = existingCourse.course_id;
        } else {
          const newCourse = this.coursesRepository.create({ course_name: data.course_name.trim(), university: uni } as any);
          const savedCourse: Course = await this.coursesRepository.save(newCourse as any);
          resolvedCourseId = savedCourse.course_id;
        }
      }
    }
    const user = this.usersRepository.create({
      name: data.name && data.name.trim().length > 0 ? data.name : data.email.split('@')[0],
      email: data.email,
      password: hashed,
      is_verified: false,
      status: 'active' as any,
      university_id: data.university_id as any,
      course_id: (resolvedCourseId ?? null) as any,
    });
    const savedUser = await this.usersRepository.save(user);

    const tutor = this.tutorsRepository.create({
      user: savedUser,
      bio: (data.bio || '').trim(),
      status: 'pending',
    } as any);
    const savedTutor = await this.tutorsRepository.save(tutor);

    return { success: true, user_id: savedUser.user_id, tutor_id: (savedTutor as any).tutor_id };
  }

  async saveDocuments(tutorId: number, files: any[]) {
    const tutor = await this.tutorsRepository.findOne({ where: { tutor_id: tutorId } });
    if (!tutor) throw new Error('Tutor not found');
    const toSave = files.map((f) => this.documentsRepository.create({
      tutor,
      file_url: `/tutor_documents/${f.filename}`,
      file_name: f.filename,
      file_type: f.mimetype,
    }));
    await this.documentsRepository.save(toSave);
    return { success: true };
  }

  async saveProfileImage(tutorId: number, file: any) {
    const tutor = await this.tutorsRepository.findOne({ where: { tutor_id: tutorId } });
    if (!tutor) throw new Error('Tutor not found');
    const fileUrl = `/tutor_documents/${file.filename}`;
    (tutor as any).profile_image_url = fileUrl;
    await this.tutorsRepository.save(tutor as any);
    return { success: true, profile_image_url: fileUrl };
  }

  async saveAvailability(tutorId: number, slots: { day_of_week: string; start_time: string; end_time: string }[]) {
    const tutor = await this.tutorsRepository.findOne({ where: { tutor_id: tutorId } });
    if (!tutor) throw new Error('Tutor not found');
    // Clear existing
    await this.availabilityRepository.delete({ tutor: { tutor_id: tutorId } as any });
    const entities = slots.map(s => this.availabilityRepository.create({ tutor, day_of_week: s.day_of_week, start_time: s.start_time, end_time: s.end_time }));
    await this.availabilityRepository.save(entities);
    return { success: true };
  }

  async saveSubjects(tutorId: number, subjectNames: string[]) {
    const tutor = await this.tutorsRepository.findOne({ where: { tutor_id: tutorId }, relations: ['user'] });
    if (!tutor) throw new Error('Tutor not found');
    const userCourseId: number | undefined = (tutor.user as any)?.course_id;

    let courseEntity: Course | undefined;
    if (userCourseId) {
      courseEntity = await this.coursesRepository.findOne({ where: { course_id: userCourseId as any } });
    }

    const toCreate: Array<Partial<TutorSubject>> = [];
    for (const rawName of subjectNames) {
      const name = (rawName || '').trim();
      if (!name) continue;
      let subject: Subject | null = null;
      if (courseEntity) {
        // Look up subject by name within the same course only
        subject = await this.subjectRepository.findOne({ where: { subject_name: name, course: { course_id: courseEntity.course_id } as any }, relations: ['course'] });
        if (!subject) {
          // If a subject with the same name exists without a course, attach it to this course; otherwise create new
          const existingNoCourse = await this.subjectRepository.findOne({ where: { subject_name: name }, relations: ['course'] });
          if (existingNoCourse && !(existingNoCourse as any).course) {
            (existingNoCourse as any).course = courseEntity;
            subject = await this.subjectRepository.save(existingNoCourse as any);
          } else {
            const created = this.subjectRepository.create({ subject_name: name, course: courseEntity } as any);
            subject = (await this.subjectRepository.save(created as any)) as Subject;
          }
        }
      } else {
        // No course available; fall back to global by-name subject
        subject = await this.subjectRepository.findOne({ where: { subject_name: name } });
        if (!subject) {
          const created = this.subjectRepository.create({ subject_name: name } as any);
          subject = (await this.subjectRepository.save(created as any)) as Subject;
        }
      }

      const link = this.tutorSubjectRepository.create({ tutor, subject } as any);
      toCreate.push(link as Partial<TutorSubject>);
    }

    await this.tutorSubjectRepository.delete({ tutor: { tutor_id: tutorId } as any });
    await this.tutorSubjectRepository.save(toCreate as any);
    return { success: true };
  }
}
