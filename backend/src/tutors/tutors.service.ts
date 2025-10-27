import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tutor, User, TutorDocument, TutorAvailability, TutorSubject, TutorSubjectDocument, Subject, Course, University, SubjectApplication, SubjectApplicationDocument, BookingRequest } from '../database/entities';
import { EmailService } from '../email/email.service';
import type { Express } from 'express';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

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
    @InjectRepository(TutorSubjectDocument)
    private tutorSubjectDocumentRepository: Repository<TutorSubjectDocument>,
    @InjectRepository(Subject)
    private subjectRepository: Repository<Subject>,
    @InjectRepository(SubjectApplication)
    private subjectApplicationRepository: Repository<SubjectApplication>,
    @InjectRepository(SubjectApplicationDocument)
    private subjectApplicationDocumentRepository: Repository<SubjectApplicationDocument>,
    @InjectRepository(BookingRequest)
    private bookingRequestRepository: Repository<BookingRequest>,
    private emailService: EmailService,
  ) {}

  findPendingApplications(): Promise<Tutor[]> {
    return this.tutorsRepository.find({
      where: { status: 'pending' },
      relations: [
        'user',
        'university',
        'course',
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
        // user.is_verified = true; // Removed as is_verified is no longer on User entity
        await this.usersRepository.save(user);
      }
      
      // Send approval email to tutor
      try {
        await this.emailService.sendTutorApplicationApprovalEmail({
          name: user?.name || 'Tutor',
          email: user?.email || '',
        });
      } catch (error) {
        console.error('Failed to send tutor application approval email:', error);
        // Don't throw error to avoid breaking the approval process
      }
    } else if (status === 'rejected') {
      // Send rejection email to tutor
      try {
        await this.emailService.sendTutorApplicationRejectionEmail({
          name: (tutor.user as any)?.name || 'Tutor',
          email: (tutor.user as any)?.email || '',
        });
      } catch (error) {
        console.error('Failed to send tutor application rejection email:', error);
        // Don't throw error to avoid breaking the rejection process
      }
    }

    return this.tutorsRepository.save(tutor);
  }

  async getTutorByEmail(email: string): Promise<{ tutor_id: number; user_id: number; user_type: string }> {
    const user = await this.usersRepository.findOne({ 
      where: { email },
      relations: ['tutor_profile', 'student_profile', 'admin_profile']
    });
    
    if (!user) {
      throw new Error('User not found with this email');
    }
    
    // Determine user type
    let userType = 'unknown';
    let tutorId = null;
    
    if (user.tutor_profile) {
      userType = 'tutor';
      tutorId = (user.tutor_profile as any).tutor_id;
    } else if (user.student_profile) {
      userType = 'student';
    } else if (user.admin_profile) {
      userType = 'admin';
    }
    
    return { 
      tutor_id: tutorId, 
      user_id: user.user_id,
      user_type: userType
    };
  }

  async updateExistingUserToTutor(userId: number, data: { full_name?: string; university_id?: number; course_id?: number; course_name?: string; bio?: string; year_level?: number; gcash_number?: string }): Promise<{ success: true; tutor_id: number }> {
    const user = await this.usersRepository.findOne({ 
      where: { user_id: userId },
      relations: ['tutor_profile', 'tutor_profile.university', 'tutor_profile.course']
    });
    
    if (!user) {
      throw new Error('User not found');
    }

    // Update user information
    if (data.full_name) {
      user.name = data.full_name;
    }
    await this.usersRepository.save(user);

    // Create or update tutor profile
    let tutor = user.tutor_profile;
    if (!tutor) {
      tutor = this.tutorsRepository.create({ user: user });
    }

    if (data.university_id) {
      const university = await this.universitiesRepository.findOne({ where: { university_id: data.university_id } });
      if (!university) throw new BadRequestException('Invalid university ID');
      tutor.university = university;
      tutor.university_id = university.university_id;
    }

    let resolvedCourseId: number | null = data.course_id ?? null;
    if (!resolvedCourseId && data.course_name && data.course_name.trim().length > 0) {
      const uni = tutor.university || await this.universitiesRepository.findOne({ where: { university_id: tutor.university_id } });
      if (uni) {
        const existingCourse = await this.coursesRepository.findOne({ 
          where: { course_name: data.course_name.trim(), university: { university_id: uni.university_id } }, 
          relations: ['university'] 
        });
        if (existingCourse) {
          resolvedCourseId = existingCourse.course_id;
        } else {
          const newCourse = this.coursesRepository.create({ 
            course_name: data.course_name.trim(), 
            university: uni 
          });
          const savedCourse = await this.coursesRepository.save(newCourse);
          resolvedCourseId = savedCourse.course_id;
        }
      }
    }
    if (resolvedCourseId) {
      const course = await this.coursesRepository.findOne({ where: { course_id: resolvedCourseId } });
      tutor.course = course;
      tutor.course_id = course.course_id;
    }

    if (data.bio !== undefined) {
      tutor.bio = data.bio;
    }
    if (data.year_level !== undefined) {
      tutor.year_level = Number(data.year_level); // Convert to number
    }
    if (data.gcash_number !== undefined) {
      tutor.gcash_number = data.gcash_number;
    }
    tutor.status = 'pending'; // Reset status to pending for re-application

    const savedTutor = await this.tutorsRepository.save(tutor);

    return { success: true, tutor_id: savedTutor.tutor_id };
  }

  async updateTutor(tutorId: number, data: { full_name?: string; university_id?: number; course_id?: number; course_name?: string; bio?: string; year_level?: number; gcash_number?: string }): Promise<{ success: true }> {
    const tutor = await this.tutorsRepository.findOne({ 
      where: { tutor_id: tutorId },
      relations: ['user', 'university', 'course']
    });
    
    if (!tutor) {
      throw new Error('Tutor not found');
    }

    // Update user information
    if (data.full_name) {
      tutor.user.name = data.full_name;
      await this.usersRepository.save(tutor.user);
    }

    if (data.university_id) {
      const university = await this.universitiesRepository.findOne({ where: { university_id: data.university_id } });
      if (!university) throw new BadRequestException('Invalid university ID');
      tutor.university = university;
      tutor.university_id = university.university_id;
    }

    let resolvedCourseId: number | null = data.course_id ?? null;
    if (!resolvedCourseId && data.course_name && data.course_name.trim().length > 0) {
      const uni = tutor.university || await this.universitiesRepository.findOne({ where: { university_id: tutor.university_id } });
      if (uni) {
        const existingCourse = await this.coursesRepository.findOne({ 
          where: { course_name: data.course_name.trim(), university: { university_id: uni.university_id } }, 
          relations: ['university'] 
        });
        if (existingCourse) {
          resolvedCourseId = existingCourse.course_id;
        } else {
          const newCourse = this.coursesRepository.create({ 
            course_name: data.course_name.trim(), 
            university: uni 
          });
          const savedCourse = await this.coursesRepository.save(newCourse);
          resolvedCourseId = savedCourse.course_id;
        }
      }
    }
    if (resolvedCourseId) {
      const course = await this.coursesRepository.findOne({ where: { course_id: resolvedCourseId } });
      tutor.course = course;
      tutor.course_id = course.course_id;
    }

    // Update tutor information
    if (data.bio !== undefined) {
      tutor.bio = data.bio;
    }
    if (data.year_level !== undefined) {
      tutor.year_level = Number(data.year_level); // Convert to number
    }
    if (data.gcash_number !== undefined) {
      tutor.gcash_number = data.gcash_number;
    }

    await this.tutorsRepository.save(tutor);

    return { success: true };
  }

  async applyTutor(data: { email: string; password: string; university_id: number; course_id?: number; course_name?: string; name?: string; bio?: string; year_level?: string; gcash_number?: string }): Promise<{ success: true; user_id: number; tutor_id: number }> {
    const existing = await this.usersRepository.findOne({ where: { email: data.email } });
    if (existing) {
      throw new Error('Email already registered');
    }

    const hashed = await bcrypt.hash(data.password, 10);

    // Declare variables once at the top of the function scope
    let resolvedCourseId: number | null = data.course_id ?? null;
    let universityEntity: University | undefined;
    let courseEntity: Course | undefined;

    if (data.university_id) {
      universityEntity = await this.universitiesRepository.findOne({ where: { university_id: data.university_id } });
      if (!universityEntity) {
        throw new BadRequestException('Invalid university ID');
      }
    }
    
    if (!resolvedCourseId && data.course_name && data.course_name.trim().length > 0 && universityEntity) {
        const existingCourse = await this.coursesRepository.findOne({ where: { course_name: data.course_name.trim(), university: { university_id: universityEntity.university_id } }, relations: ['university'] });
        if (existingCourse) {
          resolvedCourseId = existingCourse.course_id;
        } else {
          const newCourse = this.coursesRepository.create({ course_name: data.course_name.trim(), university: universityEntity });
          const savedCourse: Course = await this.coursesRepository.save(newCourse);
          resolvedCourseId = savedCourse.course_id;
        }
    }

    if (resolvedCourseId) {
      courseEntity = await this.coursesRepository.findOne({ where: { course_id: resolvedCourseId } });
    }

    const user = this.usersRepository.create({
      name: data.name && data.name.trim().length > 0 ? data.name : data.email.split('@')[0],
      email: data.email,
      password: hashed,
      user_type: 'tutor',
      status: 'active',
    });
    const savedUser: User = await this.usersRepository.save(user);

    const tutor = this.tutorsRepository.create({
      user: savedUser,
      bio: (data.bio || '').trim(),
      status: 'pending',
      gcash_qr_url: `/tutor_documents/gcashQR_${savedUser.user_id}`,
      year_level: Number(data.year_level) || undefined,
      gcash_number: data.gcash_number || '',
      ...(universityEntity && { university: universityEntity, university_id: universityEntity.university_id }),
      ...(courseEntity && { course: courseEntity, course_id: courseEntity.course_id }),
    });
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
    // First try to find tutor by tutor_id, if not found, try by user_id
    let tutor = await this.tutorsRepository.findOne({ where: { tutor_id: tutorId }, relations: ['user'] });
    if (!tutor) {
      // If not found by tutor_id, try by user_id (for dashboard updates)
      tutor = await this.tutorsRepository.findOne({ where: { user: { user_id: tutorId } }, relations: ['user'] });
    }
    if (!tutor) throw new Error('Tutor not found');

    // If no file uploaded, create placeholder
    if (!file) {
      const userId = tutor.user.user_id;
      const placeholderUrl = `/user_profile_images/userProfile_${userId}`;
      await this.usersRepository.update({ user_id: userId }, { profile_image_url: placeholderUrl });
      return { success: true, profile_image_url: placeholderUrl };
    }

    // Rename the temporary file to the correct userId-based name
    const userId = tutor.user.user_id;
    const ext = path.extname(file.filename);
    const newFilename = `userProfile_${userId}${ext}`;
    const oldPath = path.join(process.cwd(), 'tutor_documents', file.filename); // Assuming temp upload goes to tutor_documents
    const newPath = path.join(process.cwd(), 'user_profile_images', newFilename);
    
    // Ensure the target directory exists
    const targetDir = path.join(process.cwd(), 'user_profile_images');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    try {
      // Rename the file
      fs.renameSync(oldPath, newPath);
      console.log(`Renamed profile image from ${file.filename} to ${newFilename}`);
    } catch (error) {
      console.error('Error renaming profile image file:', error);
      throw new Error('Failed to save profile image');
    }

    // Update database with new file URL on the User entity
    const fileUrl = `/user_profile_images/${newFilename}`;
    await this.usersRepository.update({ user_id: userId }, { profile_image_url: fileUrl });

    // Delete old profile image files AFTER new file is saved
    await this.deleteOldProfileImages(userId);

    return { success: true, profile_image_url: fileUrl };
  }

  async saveGcashQR(tutorId: number, file: any) {
    // First try to find tutor by tutor_id, if not found, try by user_id
    let tutor = await this.tutorsRepository.findOne({ where: { tutor_id: tutorId }, relations: ['user'] });
    if (!tutor) {
      // If not found by tutor_id, try by user_id (for dashboard updates)
      tutor = await this.tutorsRepository.findOne({ where: { user: { user_id: tutorId } }, relations: ['user'] });
    }
    if (!tutor) throw new Error('Tutor not found');

    // If no file uploaded, create placeholder
    if (!file) {
      const userId = tutor.user.user_id;
      const placeholderUrl = `/tutor_documents/gcashQR_${userId}`;
      await this.tutorsRepository.update({ tutor_id: tutor.tutor_id }, { gcash_qr_url: placeholderUrl });
      return { success: true, gcash_qr_url: placeholderUrl };
    }

    // Rename the temporary file to the correct userId-based name
    const userId = tutor.user.user_id;
    const ext = path.extname(file.filename);
    const newFilename = `gcashQR_${userId}${ext}`;
    const oldPath = path.join(process.cwd(), 'tutor_documents', file.filename);
    const newPath = path.join(process.cwd(), 'tutor_documents', newFilename);
    
    try {
      // Rename the file
      fs.renameSync(oldPath, newPath);
      console.log(`Renamed GCash QR from ${file.filename} to ${newFilename}`);
    } catch (error) {
      console.error('Error renaming GCash QR file:', error);
      throw new Error('Failed to save GCash QR');
    }

    // Update database with new file URL
    const fileUrl = `/tutor_documents/${newFilename}`;
    await this.tutorsRepository.update({ tutor_id: tutor.tutor_id }, { gcash_qr_url: fileUrl });

    // Delete old GCash QR files AFTER new file is saved
    await this.deleteOldGcashQRFiles(userId);

    return { success: true, gcash_qr_url: fileUrl };
  }

  async saveAvailability(tutorIdOrUserId: number, slots: { day_of_week: string; start_time: string; end_time: string }[]) {
    // Accept either tutor_id or user_id for flexibility (dashboard passes user_id)
    let tutor = await this.tutorsRepository.findOne({ where: { tutor_id: tutorIdOrUserId }, relations: ['user'] });
    if (!tutor) {
      tutor = await this.tutorsRepository.findOne({ where: { user: { user_id: tutorIdOrUserId } }, relations: ['user'] });
    }
    if (!tutor) throw new Error('Tutor not found');

    // Clear existing for this tutor
    await this.availabilityRepository.delete({ tutor: { tutor_id: tutor.tutor_id } as any });
    const entities = slots.map(s => this.availabilityRepository.create({ tutor, day_of_week: s.day_of_week, start_time: s.start_time, end_time: s.end_time }));
    await this.availabilityRepository.save(entities);
    return { success: true };
  }

  async saveSubjects(tutorId: number, subjectNames: string[]) {
    const tutor = await this.tutorsRepository.findOne({ where: { tutor_id: tutorId }, relations: ['user'] });
    if (!tutor) throw new Error('Tutor not found');
    const userCourseId: number | undefined = tutor.course_id;

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

      const link = this.tutorSubjectRepository.create({ 
        tutor, 
        subject, 
        status: 'pending' 
      } as any);
      toCreate.push(link as Partial<TutorSubject>);
    }

    await this.tutorSubjectRepository.delete({ tutor: { tutor_id: tutorId } as any });
    await this.tutorSubjectRepository.save(toCreate as any);
    return { success: true };
  }

  // New methods for tutor dashboard functionality

  async getTutorStatus(userId: number) {
    const tutor = await this.tutorsRepository.findOne({ 
      where: { user: { user_id: userId } },
      relations: ['user']
    });
    if (!tutor) throw new NotFoundException('Tutor not found');
    
    return {
      is_verified: tutor.status === 'approved',
      status: tutor.status
    };
  }

  async getTutorId(userId: number): Promise<number> {
    console.log('Looking for tutor with user_id:', userId);
    
    const user = await this.usersRepository.findOne({
      where: { user_id: userId },
      relations: ['tutor_profile']
    });
    
    if (!user || !user.tutor_profile) {
      throw new NotFoundException('Tutor not found');
    }
    
    console.log('Found tutor profile for user:', user.tutor_profile.tutor_id);
    return user.tutor_profile.tutor_id;
  }

  async getTutorProfile(userId: number) {
    const tutor = await this.tutorsRepository.findOne({ 
      where: { user: { user_id: userId } },
      relations: ['user', 'subjects', 'subjects.subject']
    });
    if (!tutor) throw new NotFoundException('Tutor not found');
    
    // Filter only approved subjects
    const approvedSubjects = tutor.subjects?.filter(ts => ts.status === 'approved') || [];
    
    return {
      bio: tutor.bio,
      profile_photo: tutor.user.profile_image_url,
      gcash_number: tutor.gcash_number || '',
      gcash_qr: tutor.gcash_qr_url || '',
      subjects: approvedSubjects.map(ts => ts.subject?.subject_name || ''),
      rating: 0, // Calculate from ratings table
      total_reviews: 0 // Calculate from ratings table
    };
  }

  async updateTutorProfile(userId: number, data: { bio?: string; gcash_number?: string }) {
    const tutor = await this.tutorsRepository.findOne({ 
      where: { user: { user_id: userId } },
      relations: ['user']
    });
    if (!tutor) throw new NotFoundException('Tutor not found');
    
    if (data.bio !== undefined) tutor.bio = data.bio;
    if (data.gcash_number !== undefined) tutor.gcash_number = data.gcash_number;
    
    await this.tutorsRepository.save(tutor);
    return { success: true };
  }

  async getTutorAvailability(userId: number) {
    const tutor = await this.tutorsRepository.findOne({ 
      where: { user: { user_id: userId } },
      relations: ['user']
    });
    if (!tutor) throw new NotFoundException('Tutor not found');
    
    const availabilities = await this.availabilityRepository.find({
      where: { tutor: { tutor_id: tutor.tutor_id } as any }
    });
    return availabilities;
  }

  async getSubjectApplications(userId: number) {
    const tutor = await this.tutorsRepository.findOne({ 
      where: { user: { user_id: userId } },
      relations: ['user']
    });
    if (!tutor) throw new NotFoundException('Tutor not found');
    
    return this.getTutorSubjectApplications(tutor.tutor_id);
  }

  async getTutorSubjectApplications(tutorId: number) {
    const applications = await this.tutorSubjectRepository.find({
      where: { tutor: { tutor_id: tutorId } },
      relations: ['subject', 'documents'],
      order: { created_at: 'DESC' }
    });
    
    console.log(`Found ${applications.length} subject applications for tutor ${tutorId}`);
    applications.forEach(app => {
      console.log(`Application ${app.tutor_subject_id}: ${app.subject.subject_name} - ${app.status} - Notes: ${app.admin_notes || 'None'}`);
    });
    
    // Transform to match the expected format
    return applications.map(app => ({
      id: app.tutor_subject_id,
      subject_name: app.subject.subject_name,
      status: app.status,
      admin_notes: app.admin_notes,
      created_at: app.created_at,
      updated_at: app.updated_at,
      documents: app.documents || []
    }));
  }

  // Admin methods for tutor subject management
  async getAllPendingTutorSubjects() {
    const tutorSubjects = await this.tutorSubjectRepository.find({
      where: { status: 'pending' },
      relations: ['tutor', 'tutor.user', 'subject', 'documents'],
      order: { created_at: 'DESC' }
    });
    return tutorSubjects;
  }

  async updateTutorSubjectStatus(tutorSubjectId: number, status: 'approved' | 'rejected', adminNotes?: string) {
    console.log('Updating tutor subject status:', { tutorSubjectId, status, adminNotes });
    
    const tutorSubject = await this.tutorSubjectRepository.findOne({
      where: { tutor_subject_id: tutorSubjectId },
      relations: ['tutor', 'tutor.user', 'subject']
    });
    
    if (!tutorSubject) {
      throw new NotFoundException('Tutor subject not found');
    }

    tutorSubject.status = status;
    if (adminNotes) {
      tutorSubject.admin_notes = adminNotes;
      console.log('Admin notes saved:', adminNotes);
    } else {
      console.log('No admin notes provided');
    }
    
    const updatedTutorSubject = await this.tutorSubjectRepository.save(tutorSubject);
    
    // Send email to tutor based on status
    if (status === 'approved') {
      try {
        await this.emailService.sendSubjectApprovalEmail({
          name: (tutorSubject.tutor as any)?.user?.name || 'Tutor',
          email: (tutorSubject.tutor as any)?.user?.email || '',
          subjectName: (tutorSubject.subject as any)?.subject_name || 'Subject',
        });
      } catch (error) {
        console.error('Failed to send subject approval email:', error);
        // Don't throw error to avoid breaking the approval process
      }
    } else if (status === 'rejected') {
      try {
        await this.emailService.sendSubjectRejectionEmail({
          name: (tutorSubject.tutor as any)?.user?.name || 'Tutor',
          email: (tutorSubject.tutor as any)?.user?.email || '',
          subjectName: (tutorSubject.subject as any)?.subject_name || 'Subject',
          adminNotes: adminNotes,
        });
      } catch (error) {
        console.error('Failed to send subject rejection email:', error);
        // Don't throw error to avoid breaking the rejection process
      }
    }
    
    return updatedTutorSubject;
  }

  async submitSubjectApplication(tutorId: number, subjectName: string, files: any[]) {
    try {
      console.log('Starting subject application submission:', { tutorId, subjectName, filesCount: files?.length || 0 });
      
      const tutor = await this.tutorsRepository.findOne({ 
        where: { tutor_id: tutorId },
        relations: ['user']
      });
      if (!tutor) throw new NotFoundException('Tutor not found');
      console.log('Tutor found:', tutor.tutor_id);

      // Find or create the subject
      let subject = await this.subjectRepository.findOne({ 
        where: { subject_name: subjectName } 
      });
      
      if (!subject) {
        console.log('Creating new subject:', subjectName);
        subject = this.subjectRepository.create({
          subject_name: subjectName
        });
        subject = await this.subjectRepository.save(subject);
        console.log('Subject created:', subject.subject_id);
      } else {
        console.log('Subject found:', subject.subject_id);
      }

    // Check if tutor already has this subject (approved or pending)
    const existingTutorSubject = await this.tutorSubjectRepository.findOne({
      where: { 
        tutor: { tutor_id: tutor.tutor_id },
        subject: { subject_id: subject.subject_id }
      }
    });

    if (existingTutorSubject) {
      if (existingTutorSubject.status === 'approved') {
        throw new Error('You have already been approved for this subject expertise');
      } else if (existingTutorSubject.status === 'pending') {
        throw new Error('You have already applied for this subject expertise and it is pending review');
      }
      // If status is 'rejected', we allow reapplication
    }

    // If there's a rejected application, update it to pending instead of creating new one
    let savedTutorSubject;
    if (existingTutorSubject && existingTutorSubject.status === 'rejected') {
      existingTutorSubject.status = 'pending';
      existingTutorSubject.admin_notes = null; // Clear previous admin notes
      savedTutorSubject = await this.tutorSubjectRepository.save(existingTutorSubject);
    } else {
      // Create new tutor subject with pending status
      const tutorSubject = this.tutorSubjectRepository.create({
        tutor,
        subject,
        status: 'pending'
      });
      savedTutorSubject = await this.tutorSubjectRepository.save(tutorSubject);
    }

    // Save documents linked to the tutor subject
    if (files && files.length > 0) {
      try {
        console.log('Creating documents for tutor subject:', savedTutorSubject.tutor_subject_id);
        const documents = files.map(file => {
          console.log('Processing file:', file.filename, file.mimetype);
          return this.tutorSubjectDocumentRepository.create({
            tutorSubject: savedTutorSubject,
            file_url: `/tutor_documents/${file.filename}`,
            file_name: file.filename,
            file_type: file.mimetype
          });
        });
        console.log('Saving documents:', documents.length);
        await this.tutorSubjectDocumentRepository.save(documents);
        console.log('Documents saved successfully');
      } catch (error) {
        console.error('Error saving documents:', error);
        // Don't throw error - just log it and continue
        // The tutor subject application should still be created even if documents fail
        console.log('Continuing without documents due to error');
      }
    }

    return { success: true, tutorSubjectId: savedTutorSubject.tutor_subject_id };
  } catch (error) {
    console.error('Error in submitSubjectApplication:', error);
    throw error;
  }
}

  // Availability change request feature removed

  async getBookingRequests(userId: number) {
    const tutor = await this.tutorsRepository.findOne({ 
      where: { user: { user_id: userId } },
      relations: ['user']
    });
    if (!tutor) throw new NotFoundException('Tutor not found');
    
    const requests = await this.bookingRequestRepository.find({
      where: { tutor: { tutor_id: tutor.tutor_id } as any },
      relations: ['student'],
      order: { created_at: 'DESC' }
    });
    return requests;
  }

  async updateBookingRequestStatus(bookingId: number, status: 'accepted' | 'declined') {
    const request = await this.bookingRequestRepository.findOne({ where: { id: bookingId } });
    if (!request) throw new NotFoundException('Booking request not found');

    request.status = status;
    if (status === 'accepted') {
      request.status = 'awaiting_payment';
    }
    await this.bookingRequestRepository.save(request);

    return { success: true };
  }

  async updatePaymentStatus(bookingId: number, status: 'approved' | 'rejected') {
    const request = await this.bookingRequestRepository.findOne({ where: { id: bookingId } });
    if (!request) throw new NotFoundException('Booking request not found');

    if (status === 'approved') {
      request.status = 'confirmed';
    } else {
      request.status = 'pending'; // Reset to pending for admin review
    }
    await this.bookingRequestRepository.save(request);

    return { success: true };
  }

  async getTutorSessions(userId: number) {
    // This would need to be implemented based on your session entity
    // For now, return empty array
    return [];
  }

  async getTutorPayments(userId: number) {
    // This would need to be implemented based on your payment entity
    // For now, return empty array
    return [];
  }

  async getTutorEarningsStats(userId: number) {
    // This would need to be implemented based on your session and payment entities
    // For now, return default values
    return {
      total_earnings: 0,
      pending_earnings: 0,
      completed_sessions: 0,
      average_rating: 0,
      total_hours: 0
    };
  }

  // Helper method to delete old profile image files
  private async deleteOldProfileImages(userId: number) {
    const user = await this.usersRepository.findOne({ where: { user_id: userId } });
    if (!user) return;

    const userProfileImagesPath = path.join(process.cwd(), 'user_profile_images');
    
    try {
      // Get all files in the user_profile_images directory
      const files = fs.readdirSync(userProfileImagesPath);
      
      // Find files that match the profile image pattern for this user
      const profileImagePattern = new RegExp(`^userProfile_${userId}(\\..*)?$`);
      const filesToDelete = files.filter(file => {
        const matchesPattern = profileImagePattern.test(file);
        const isCurrentFile = user.profile_image_url && file === path.basename(user.profile_image_url);
        return matchesPattern && !isCurrentFile; // Don't delete the current file
      });
      
      console.log(`Found ${filesToDelete.length} old profile image files to delete for user ${userId}:`, filesToDelete);
      
      // Delete each matching file
      for (const file of filesToDelete) {
        const filePath = path.join(userProfileImagesPath, file);
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Successfully deleted old profile image: ${file}`);
          }
        } catch (error) {
          console.error(`Error deleting file ${file}:`, error);
        }
      }
    } catch (error) {
      console.error('Error reading user_profile_images directory:', error);
    }
  }

  // Helper method to delete old GCash QR files
  private async deleteOldGcashQRFiles(userId: number) {
    const tutor = await this.tutorsRepository.findOne({ where: { user: { user_id: userId } } });
    if (!tutor) return;

    const tutorDocumentsPath = path.join(process.cwd(), 'tutor_documents');
    
    try {
      // Get all files in the tutor_documents directory
      const files = fs.readdirSync(tutorDocumentsPath);
      
      // Find files that match the GCash QR pattern for this user
      const gcashQRPattern = new RegExp(`^gcashQR_${userId}(\\..*)?$`);
      const filesToDelete = files.filter(file => {
        const matchesPattern = gcashQRPattern.test(file);
        const isCurrentFile = tutor.gcash_qr_url && file === path.basename(tutor.gcash_qr_url);
        return matchesPattern && !isCurrentFile; // Don't delete the current file
      });
      
      console.log(`Found ${filesToDelete.length} old GCash QR files to delete for user ${userId}:`, filesToDelete);
      
      // Delete each matching file
      for (const file of filesToDelete) {
        const filePath = path.join(tutorDocumentsPath, file);
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Successfully deleted old GCash QR: ${file}`);
          }
        } catch (error) {
          console.error(`Error deleting file ${file}:`, error);
        }
      }
    } catch (error) {
      console.error('Error reading tutor_documents directory:', error);
    }
  }
}
