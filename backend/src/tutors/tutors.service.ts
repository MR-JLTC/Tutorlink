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

  async saveSubjects(tutorId: number, subjectNames: string[], providedCourseId?: number) {
    const tutor = await this.tutorsRepository.findOne({ where: { tutor_id: tutorId }, relations: ['user'] });
    if (!tutor) throw new Error('Tutor not found');
    const tutorCourseId: number | undefined = tutor.course_id;

    // Validate that provided course_id matches tutor's course_id if both exist
    if (providedCourseId && tutorCourseId && providedCourseId !== tutorCourseId) {
      throw new Error(`Course ID mismatch: Provided course_id (${providedCourseId}) does not match tutor's course_id (${tutorCourseId}).`);
    }

    // Use provided course_id if available and validated, otherwise use tutor's course_id
    const effectiveCourseId = providedCourseId || tutorCourseId;

    let courseEntity: Course | undefined;
    if (effectiveCourseId) {
      courseEntity = await this.coursesRepository.findOne({ where: { course_id: effectiveCourseId as any } });
      if (!courseEntity) {
        throw new Error(`Course with ID ${effectiveCourseId} not found.`);
      }
    }

    const toCreate: Array<Partial<TutorSubject>> = [];
    for (const rawName of subjectNames) {
      const name = (rawName || '').trim();
      if (!name) continue;
      let subject: Subject | null = null;
      if (courseEntity) {
        // Look up subject by name within the same course only
        subject = await this.subjectRepository.findOne({ 
          where: { 
            subject_name: name, 
            course: { course_id: courseEntity.course_id } as any 
          }, 
          relations: ['course'] 
        });
        
        if (!subject) {
          // Check if a subject with this name exists in a different course or without a course
          const existingWithDifferentCourse = await this.subjectRepository.findOne({ 
            where: { subject_name: name }, 
            relations: ['course'] 
          });
          
          if (existingWithDifferentCourse) {
            const existingCourseId = (existingWithDifferentCourse as any).course?.course_id;
            // If it exists in a different course, create a NEW subject for this course
            // Subjects with the same name can exist in different courses (e.g., "Ethical Hacking" in CS and IT)
            if (existingCourseId && existingCourseId !== courseEntity.course_id) {
              console.log(`Subject "${name}" exists in course_id ${existingCourseId}, creating new subject for course_id ${courseEntity.course_id}`);
              // Create new subject for this course - same name but different course_id
              const created = this.subjectRepository.create({ 
                subject_name: name, 
                course: courseEntity 
              });
              subject = await this.subjectRepository.save(created);
              // Reload with relations to ensure course relationship is properly set
              subject = await this.subjectRepository.findOne({ 
                where: { subject_id: subject.subject_id }, 
                relations: ['course'] 
              }) || subject;
              console.log(`Created new subject "${name}" with course_id ${subject?.course?.course_id || courseEntity.course_id}, subject_id: ${subject.subject_id} (duplicate name allowed for different course)`);
            } else if (!existingCourseId) {
              // If it exists without a course, attach it to this course
              existingWithDifferentCourse.course = courseEntity;
              subject = await this.subjectRepository.save(existingWithDifferentCourse);
              // Reload with relations to ensure course relationship is properly set
              subject = await this.subjectRepository.findOne({ 
                where: { subject_id: subject.subject_id }, 
                relations: ['course'] 
              }) || subject;
              console.log(`Updated existing subject "${name}" to have course_id ${subject?.course?.course_id || courseEntity.course_id}, subject_id: ${subject.subject_id}`);
            }
          } else {
            // No existing subject found, create new subject for this course
            const created = this.subjectRepository.create({ 
              subject_name: name, 
              course: courseEntity 
            });
            subject = await this.subjectRepository.save(created);
            // Reload with relations to ensure course relationship is properly set
            subject = await this.subjectRepository.findOne({ 
              where: { subject_id: subject.subject_id }, 
              relations: ['course'] 
            }) || subject;
            console.log(`Created new subject "${name}" with course_id ${subject?.course?.course_id || courseEntity.course_id}, subject_id: ${subject.subject_id}`);
          }
        }
      } else {
        // No course available; fall back to global by-name subject
        subject = await this.subjectRepository.findOne({ where: { subject_name: name } });
        if (!subject) {
          const created = this.subjectRepository.create({ subject_name: name });
          subject = await this.subjectRepository.save(created);
          console.log(`Created new subject "${name}" without course, subject_id: ${subject.subject_id}`);
        } else {
          // Reload with relations for consistency
          subject = await this.subjectRepository.findOne({ 
            where: { subject_id: subject.subject_id }, 
            relations: ['course'] 
          }) || subject;
          console.log(`Found existing subject "${name}" without course, subject_id: ${subject.subject_id}`);
        }
      }

      // Final validation: Ensure subject belongs to the correct course
      if (effectiveCourseId && subject) {
        const subjectCourseId = (subject as any).course?.course_id;
        // If subject has a course, it must match the tutor's course
        if (subjectCourseId && subjectCourseId !== effectiveCourseId) {
          throw new Error(`Subject "${name}" belongs to course ID ${subjectCourseId}, but tutor is registered with course ID ${effectiveCourseId}. Cannot associate subject from different course.`);
        }
      }

      const link = this.tutorSubjectRepository.create({ 
        tutor, 
        subject, 
        status: 'pending' 
      });
      toCreate.push(link);
      console.log(`Created TutorSubject link for tutor_id ${tutorId}, subject_id ${subject.subject_id}, subject_name "${name}"`);
    }

    // Delete existing tutor subjects for this tutor
    const deleteResult = await this.tutorSubjectRepository.delete({ tutor: { tutor_id: tutorId } as any });
    console.log(`Deleted ${deleteResult.affected || 0} existing TutorSubject entries for tutor_id ${tutorId}`);
    
    // Save new tutor subjects
    const savedTutorSubjects = await this.tutorSubjectRepository.save(toCreate);
    console.log(`Saved ${savedTutorSubjects.length} TutorSubject entries for tutor_id ${tutorId}`);
    savedTutorSubjects.forEach((ts, idx) => {
      console.log(`  TutorSubject[${idx}]: tutor_subject_id=${ts.tutor_subject_id}, subject_id=${(ts.subject as any)?.subject_id || 'N/A'}, subject_name="${subjectNames[idx]}"`);
    });
    
    return { 
      success: true, 
      subjects_saved: savedTutorSubjects.length,
      tutor_subject_ids: savedTutorSubjects.map(ts => ts.tutor_subject_id)
    };
  }

  // New methods for tutor dashboard functionality

  async createBookingRequest(tutorId: number, studentUserId: number, data: { subject: string; date: string; time: string; duration: number; student_notes?: string }) {
    const tutor = await this.tutorsRepository.findOne({ where: { tutor_id: tutorId } });
    if (!tutor) throw new NotFoundException('Tutor not found');

    const student = await this.usersRepository.findOne({ where: { user_id: studentUserId } });
    if (!student) throw new NotFoundException('Student not found');

    // Basic validation
    if (!data.subject || !data.date || !data.time || !data.duration) {
      throw new BadRequestException('Missing required booking fields');
    }

    // Parse requested start and end times (in minutes since midnight)
    const parseTimeToMinutes = (t: string) => {
      // Accept formats like HH:MM or HH:MM:SS
      const parts = t.split(':').map(p => parseInt(p, 10));
      if (isNaN(parts[0])) return NaN;
      const minutes = (parts[0] || 0) * 60 + (parts[1] || 0);
      return minutes;
    };

    const requestedStart = parseTimeToMinutes(data.time);
    const requestedEnd = requestedStart + Math.round(Number(data.duration) * 60);
    if (isNaN(requestedStart) || requestedStart < 0) throw new BadRequestException('Invalid time format');

    // Check tutor availability for the requested day
    const requestedDate = new Date(data.date);
    if (isNaN(requestedDate.getTime())) throw new BadRequestException('Invalid date');
    const dowMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = dowMap[requestedDate.getDay()];

    const availabilities = await this.availabilityRepository.find({ where: { tutor: { tutor_id: tutor.tutor_id } as any } });
    const availForDay = availabilities.filter(a => (a.day_of_week || '').toLowerCase() === dayOfWeek.toLowerCase());
    if (!availForDay || availForDay.length === 0) {
      throw new BadRequestException('Tutor has no availability on the requested day');
    }

    // Ensure requested slot fits within at least one availability slot
    const fitsInAvailability = availForDay.some(a => {
      const aStart = parseTimeToMinutes(a.start_time as any);
      const aEnd = parseTimeToMinutes(a.end_time as any);
      if (isNaN(aStart) || isNaN(aEnd)) return false;
      return requestedStart >= aStart && requestedEnd <= aEnd;
    });
    if (!fitsInAvailability) {
      throw new BadRequestException('Requested time is outside tutor availability');
    }

    // Check for booking conflicts on the same date for this tutor
    const existing = await this.bookingRequestRepository.find({ where: { tutor: { tutor_id: tutor.tutor_id } as any, date: requestedDate } });
    const blockingStatuses = ['pending', 'accepted', 'awaiting_payment', 'confirmed'];
    const hasConflict = existing.some((e: any) => {
      if (!blockingStatuses.includes(e.status)) return false;
      const eStart = parseTimeToMinutes(e.time as any);
      const eEnd = eStart + Math.round(Number(e.duration) * 60);
      // overlap if start < otherEnd && otherStart < end
      return requestedStart < eEnd && eStart < requestedEnd;
    });
    if (hasConflict) {
      throw new BadRequestException('Requested time conflicts with an existing booking');
    }

    const entity = this.bookingRequestRepository.create({
      tutor,
      student,
      subject: data.subject,
      date: requestedDate,
      time: data.time,
      duration: Number(data.duration),
      student_notes: data.student_notes || null,
      status: 'pending',
    } as any);

    const saved = await this.bookingRequestRepository.save(entity as any);
    console.log(`createBookingRequest: saved booking id=${(saved as any).id} tutor_id=${tutor.tutor_id} tutor_user_id=${(tutor.user as any)?.user_id} student_user_id=${(student as any)?.user_id}`);
    return { success: true, bookingId: (saved as any).id };
  }

  async getStudentBookingRequests(studentUserId: number) {
    const student = await this.usersRepository.findOne({ where: { user_id: studentUserId } });
    if (!student) throw new NotFoundException('Student not found');

    const requests = await this.bookingRequestRepository.find({ where: { student: { user_id: studentUserId } as any }, relations: ['tutor', 'tutor.user'], order: { created_at: 'DESC' } });
    return requests;
  }

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
    // Accept either tutor_id or user.user_id
    let tutor = await this.tutorsRepository.findOne({ 
      where: { tutor_id: userId as any },
      relations: ['user', 'subjects', 'subjects.subject']
    });
    if (!tutor) {
      tutor = await this.tutorsRepository.findOne({ 
        where: { user: { user_id: userId } },
        relations: ['user', 'subjects', 'subjects.subject']
      });
    }
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
    // Accept either tutor_id or user.user_id
    let tutor = await this.tutorsRepository.findOne({ 
      where: { tutor_id: userId as any },
      relations: ['user']
    });
    if (!tutor) {
      tutor = await this.tutorsRepository.findOne({ 
        where: { user: { user_id: userId } },
        relations: ['user']
      });
    }
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
        relations: ['user', 'course']
      });
      if (!tutor) throw new NotFoundException('Tutor not found');
      console.log('Tutor found:', tutor.tutor_id);
      
      const tutorCourseId: number | undefined = tutor.course_id;
      let courseEntity: Course | undefined;
      
      if (tutorCourseId) {
        courseEntity = await this.coursesRepository.findOne({ where: { course_id: tutorCourseId } });
        if (!courseEntity) {
          throw new Error(`Tutor's course with ID ${tutorCourseId} not found.`);
        }
        console.log('Tutor course found:', courseEntity.course_id, courseEntity.course_name);
      } else {
        console.log('Tutor has no course_id assigned');
      }

      // Find or create the subject, ensuring it belongs to the tutor's course
      const trimmedName = (subjectName || '').trim();
      if (!trimmedName) {
        throw new Error('Subject name cannot be empty');
      }
      
      let subject: Subject | null = null;
      
      if (courseEntity) {
        // Look up subject by name within the same course only
        subject = await this.subjectRepository.findOne({ 
          where: { 
            subject_name: trimmedName, 
            course: { course_id: courseEntity.course_id } as any 
          }, 
          relations: ['course'] 
        });
        
        if (!subject) {
          // Check if a subject with this name exists in a different course or without a course
          const existingWithDifferentCourse = await this.subjectRepository.findOne({ 
            where: { subject_name: trimmedName }, 
            relations: ['course'] 
          });
          
          if (existingWithDifferentCourse) {
            const existingCourseId = (existingWithDifferentCourse as any).course?.course_id;
            // If it exists in a different course, create a NEW subject for this course
            // Subjects with the same name can exist in different courses (e.g., "Ethical Hacking" in CS and IT)
            if (existingCourseId && existingCourseId !== courseEntity.course_id) {
              console.log(`Subject "${trimmedName}" exists in course_id ${existingCourseId}, creating new subject for course_id ${courseEntity.course_id}`);
              // Create new subject for this course - same name but different course_id
              const created = this.subjectRepository.create({ 
                subject_name: trimmedName, 
                course: courseEntity 
              });
              subject = await this.subjectRepository.save(created);
              // Reload with relations to ensure course relationship is properly set
              subject = await this.subjectRepository.findOne({ 
                where: { subject_id: subject.subject_id }, 
                relations: ['course'] 
              }) || subject;
              console.log(`Created new subject "${trimmedName}" with course_id ${subject?.course?.course_id || courseEntity.course_id}, subject_id: ${subject.subject_id} (duplicate name allowed for different course)`);
            } else if (!existingCourseId) {
              // If it exists without a course, attach it to this course
              existingWithDifferentCourse.course = courseEntity;
              subject = await this.subjectRepository.save(existingWithDifferentCourse);
              // Reload with relations to ensure course relationship is properly set
              subject = await this.subjectRepository.findOne({ 
                where: { subject_id: subject.subject_id }, 
                relations: ['course'] 
              }) || subject;
              console.log(`Updated existing subject "${trimmedName}" to have course_id ${subject?.course?.course_id || courseEntity.course_id}, subject_id: ${subject.subject_id}`);
            }
          } else {
            // No existing subject found, create new subject for this course
            const created = this.subjectRepository.create({ 
              subject_name: trimmedName, 
              course: courseEntity 
            });
            subject = await this.subjectRepository.save(created);
            // Reload with relations to ensure course relationship is properly set
            subject = await this.subjectRepository.findOne({ 
              where: { subject_id: subject.subject_id }, 
              relations: ['course'] 
            }) || subject;
            console.log(`Created new subject "${trimmedName}" with course_id ${subject?.course?.course_id || courseEntity.course_id}, subject_id: ${subject.subject_id}`);
          }
        } else {
          console.log('Subject found in course:', subject.subject_id);
        }
      } else {
        // No course available; fall back to global by-name subject
        subject = await this.subjectRepository.findOne({ 
          where: { subject_name: trimmedName },
          relations: ['course']
        });
        if (!subject) {
          const created = this.subjectRepository.create({ subject_name: trimmedName });
          subject = await this.subjectRepository.save(created);
          console.log(`Created new subject "${trimmedName}" without course, subject_id: ${subject.subject_id}`);
        } else {
          // Reload with relations for consistency
          subject = await this.subjectRepository.findOne({ 
            where: { subject_id: subject.subject_id }, 
            relations: ['course'] 
          }) || subject;
          console.log(`Found existing subject "${trimmedName}" without course, subject_id: ${subject.subject_id}`);
        }
      }

      // Final validation: Ensure subject belongs to the correct course
      if (tutorCourseId && subject) {
        const subjectCourseId = (subject as any).course?.course_id;
        // If subject has a course, it must match the tutor's course
        if (subjectCourseId && subjectCourseId !== tutorCourseId) {
          throw new Error(`Subject "${trimmedName}" belongs to course ID ${subjectCourseId}, but tutor is registered with course ID ${tutorCourseId}. Cannot associate subject from different course.`);
        }
      }

    // Check if tutor already has this subject (approved or pending)
    const existingTutorSubject = await this.tutorSubjectRepository.findOne({
      where: { 
        tutor: { tutor_id: tutor.tutor_id },
        subject: { subject_id: subject.subject_id }
      },
      relations: ['documents']
    });

    let savedTutorSubject;
    
    if (existingTutorSubject) {
      if (existingTutorSubject.status === 'approved') {
        throw new Error('You have already been approved for this subject expertise');
      } else if (existingTutorSubject.status === 'pending') {
        // If there are files to upload, allow attaching documents to existing pending application
        // This handles the case where saveSubjects was called first, then submitSubjectApplication is called
        if (files && files.length > 0) {
          console.log('Found existing pending TutorSubject, attaching documents to it');
          savedTutorSubject = existingTutorSubject;
        } else {
          // If no files, throw error as before (prevents duplicate applications without documents)
          throw new Error('You have already applied for this subject expertise and it is pending review');
        }
      } else if (existingTutorSubject.status === 'rejected') {
        // If status is 'rejected', allow reapplication
        existingTutorSubject.status = 'pending';
        existingTutorSubject.admin_notes = null; // Clear previous admin notes
        savedTutorSubject = await this.tutorSubjectRepository.save(existingTutorSubject);
      }
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
        console.log('Subject name:', trimmedName, 'Files count:', files.length);
        
        // Clear existing documents for this tutor subject if any (to avoid duplicates during registration)
        // This ensures clean document association when attaching to existing pending TutorSubject
        const existingDocs = await this.tutorSubjectDocumentRepository.find({
          where: { tutorSubject: { tutor_subject_id: savedTutorSubject.tutor_subject_id } as any }
        });
        if (existingDocs.length > 0) {
          console.log(`Clearing ${existingDocs.length} existing documents for tutor subject ${savedTutorSubject.tutor_subject_id}`);
          await this.tutorSubjectDocumentRepository.remove(existingDocs);
        }
        
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
        const savedDocuments = await this.tutorSubjectDocumentRepository.save(documents);
        console.log(`Successfully saved ${savedDocuments.length} document(s) for tutor subject:`, savedTutorSubject.tutor_subject_id);
        
        // Verify documents were saved
        if (!savedDocuments || savedDocuments.length === 0) {
          throw new Error('Failed to save documents - no documents were saved');
        }
      } catch (error) {
        console.error('Error saving documents:', error);
        // Throw error so frontend knows documents weren't saved
        throw new Error(`Failed to save documents for subject "${trimmedName}": ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      console.log('No files provided for tutor subject:', savedTutorSubject.tutor_subject_id);
    }

    return { success: true, tutorSubjectId: savedTutorSubject.tutor_subject_id };
  } catch (error) {
    console.error('Error in submitSubjectApplication:', error);
    throw error;
  }
}

  // Availability change request feature removed

  async getBookingRequests(userId: number) {
    // Accept either tutor_id or user.user_id
    let tutor = await this.tutorsRepository.findOne({ where: { tutor_id: userId as any } });
    if (!tutor) {
      tutor = await this.tutorsRepository.findOne({ 
        where: { user: { user_id: userId } },
        relations: ['user']
      });
    }
    if (!tutor) {
      console.warn(`getBookingRequests: Tutor not found for id/user_id=${userId}`);
      throw new NotFoundException('Tutor not found');
    }

    const requests = await this.bookingRequestRepository.find({
      where: { tutor: { tutor_id: tutor.tutor_id } as any },
      relations: ['student'],
      order: { created_at: 'DESC' }
    });
    console.log(`getBookingRequests: found ${requests.length} requests for tutor_id=${tutor.tutor_id}`);
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
