import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tutor, User, TutorDocument, TutorAvailability, TutorSubject, Subject, Course, University, SubjectApplication, SubjectApplicationDocument, BookingRequest } from '../database/entities';
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
    @InjectRepository(Subject)
    private subjectRepository: Repository<Subject>,
    @InjectRepository(SubjectApplication)
    private subjectApplicationRepository: Repository<SubjectApplication>,
    @InjectRepository(SubjectApplicationDocument)
    private subjectApplicationDocumentRepository: Repository<SubjectApplicationDocument>,
    @InjectRepository(BookingRequest)
    private bookingRequestRepository: Repository<BookingRequest>,
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

  async applyTutor(data: { email: string; password: string; university_id: number; course_id?: number; course_name?: string; name?: string; bio?: string; year_level?: string; gcash_number?: string }): Promise<{ success: true; user_id: number; tutor_id: number }> {
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
      profile_image_url: `/tutor_documents/tutorProfile_${savedUser.user_id}`,
      gcash_qr_url: `/tutor_documents/gcashQR_${savedUser.user_id}`,
      year_level: data.year_level || '',
      gcash_number: data.gcash_number || '',
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
      const placeholderUrl = `/tutor_documents/tutorProfile_${userId}`;
      await this.tutorsRepository.update({ tutor_id: tutor.tutor_id }, { profile_image_url: placeholderUrl });
      return { success: true, profile_image_url: placeholderUrl };
    }

    // Rename the temporary file to the correct userId-based name
    const userId = tutor.user.user_id;
    const ext = path.extname(file.filename);
    const newFilename = `tutorProfile_${userId}${ext}`;
    const oldPath = path.join(process.cwd(), 'tutor_documents', file.filename);
    const newPath = path.join(process.cwd(), 'tutor_documents', newFilename);
    
    try {
      // Rename the file
      fs.renameSync(oldPath, newPath);
      console.log(`Renamed profile image from ${file.filename} to ${newFilename}`);
    } catch (error) {
      console.error('Error renaming profile image file:', error);
      throw new Error('Failed to save profile image');
    }

    // Update database with new file URL
    const fileUrl = `/tutor_documents/${newFilename}`;
    await this.tutorsRepository.update({ tutor_id: tutor.tutor_id }, { profile_image_url: fileUrl });

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

  async getTutorProfile(userId: number) {
    const tutor = await this.tutorsRepository.findOne({ 
      where: { user: { user_id: userId } },
      relations: ['user', 'subjects', 'subjects.subject']
    });
    if (!tutor) throw new NotFoundException('Tutor not found');
    
    
    return {
      bio: tutor.bio,
      profile_photo: tutor.profile_image_url,
      gcash_number: tutor.gcash_number || '',
      gcash_qr: tutor.gcash_qr_url || '',
      subjects: tutor.subjects?.map(ts => ts.subject?.subject_name || '') || [],
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
    
    const applications = await this.subjectApplicationRepository.find({
      where: { tutor: { tutor_id: tutor.tutor_id } as any },
      relations: ['documents'],
      order: { created_at: 'DESC' }
    });
    return applications;
  }

  async submitSubjectApplication(userId: number, subjectName: string, files: any[]) {
    const tutor = await this.tutorsRepository.findOne({ 
      where: { user: { user_id: userId } },
      relations: ['user']
    });
    if (!tutor) throw new NotFoundException('Tutor not found');

    const application = this.subjectApplicationRepository.create({
      tutor,
      subject_name: subjectName,
      status: 'pending'
    });
    const savedApplication = await this.subjectApplicationRepository.save(application);

    // Save documents
    const documents = files.map(file => this.subjectApplicationDocumentRepository.create({
      subjectApplication: savedApplication,
      file_url: `/tutor_documents/${file.filename}`,
      file_name: file.filename,
      file_type: file.mimetype
    }));
    await this.subjectApplicationDocumentRepository.save(documents);

    return { success: true };
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
    const tutor = await this.tutorsRepository.findOne({ where: { user: { user_id: userId } } });
    if (!tutor) return;

    const tutorDocumentsPath = path.join(process.cwd(), 'tutor_documents');
    
    try {
      // Get all files in the tutor_documents directory
      const files = fs.readdirSync(tutorDocumentsPath);
      
      // Find files that match the profile image pattern for this user
      const profileImagePattern = new RegExp(`^tutorProfile_${userId}(\\..*)?$`);
      const filesToDelete = files.filter(file => {
        const matchesPattern = profileImagePattern.test(file);
        const isCurrentFile = tutor.profile_image_url && file === path.basename(tutor.profile_image_url);
        return matchesPattern && !isCurrentFile; // Don't delete the current file
      });
      
      console.log(`Found ${filesToDelete.length} old profile image files to delete for user ${userId}:`, filesToDelete);
      
      // Delete each matching file
      for (const file of filesToDelete) {
        const filePath = path.join(tutorDocumentsPath, file);
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
      console.error('Error reading tutor_documents directory:', error);
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
