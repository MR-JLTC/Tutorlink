import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tutor, User, TutorDocument, TutorAvailability, TutorSubject, TutorSubjectDocument, Subject, Course, University, SubjectApplication, SubjectApplicationDocument, BookingRequest, Notification, Payment, Student, Payout } from '../database/entities';
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
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Payout)
    private payoutRepository: Repository<Payout>,
    @InjectRepository(Student)
    private studentRepository: Repository<Student>,
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

  async updateStatus(id: number, status: 'approved' | 'rejected', adminNotes?: string): Promise<Tutor> {
    const tutor = await this.tutorsRepository.findOne({ 
      where: { tutor_id: id },
      relations: ['user']
    });
    if (!tutor) {
      throw new NotFoundException(`Tutor with ID ${id} not found`);
    }

    tutor.status = status;
    
    // CRITICAL: For rejected status, ALWAYS save admin notes to tutors.admin_notes database column
    // This MUST happen - the admin rejection reason MUST be stored in the database
    let adminNotesToSave: string | null = null;
    
    if (status === 'rejected') {
      // For rejected status, we MUST save admin notes if provided
      if (adminNotes !== undefined && adminNotes !== null && adminNotes.trim().length > 0) {
        // Trim whitespace - this will be saved to tutors.admin_notes column
        const trimmedNotes = adminNotes.trim();
        adminNotesToSave = trimmedNotes; // Save the trimmed notes (always non-empty at this point)
        // Explicitly set on tutor entity - this maps to tutors.admin_notes database column
        tutor.admin_notes = adminNotesToSave;
        console.log(`[TutorService] REJECTION - Admin notes received: "${adminNotes}"`);
        console.log(`[TutorService] REJECTION - Trimmed admin notes to save: "${adminNotesToSave}"`);
        console.log(`[TutorService] REJECTION - Setting tutor.admin_notes property = "${adminNotesToSave}"`);
        console.log(`[TutorService] REJECTION - This MUST be saved to tutors.admin_notes column in database`);
      } else {
        console.error(`[TutorService] ERROR: Rejecting tutor ${id} but adminNotes is missing or empty!`);
        console.error(`[TutorService] Received adminNotes:`, adminNotes);
        console.error(`[TutorService] This should not happen - modal should require rejection reason.`);
        // Still save status as rejected, but log error
      }
    } else if (adminNotes !== undefined && adminNotes !== null) {
      // For approved status, save if provided (typically not used)
      const trimmedNotes = adminNotes.trim();
      adminNotesToSave = trimmedNotes.length > 0 ? trimmedNotes : null;
      tutor.admin_notes = adminNotesToSave;
      console.log(`[TutorService] Admin notes provided for ${status}: "${adminNotesToSave || 'null'}"`);
    }
    
    // CRITICAL: Save tutor entity to database FIRST - this MUST persist tutor.admin_notes to tutors.admin_notes column
    console.log(`[TutorService] BEFORE SAVE - tutor.admin_notes = "${tutor.admin_notes || 'null'}"`);
    let savedTutor = await this.tutorsRepository.save(tutor);
    console.log(`[TutorService] AFTER SAVE - savedTutor.admin_notes = "${savedTutor.admin_notes || 'null'}"`);
    
    // CRITICAL: For rejected status, ALWAYS explicitly update the admin_notes column using update() method
    // This is a double-check to ensure the column is definitely updated in the database
    if (status === 'rejected') {
      if (adminNotesToSave !== null) {
        // Explicitly update the admin_notes column in the tutors table
        const updateResult = await this.tutorsRepository.update(
          { tutor_id: id },
          { admin_notes: adminNotesToSave }
        );
        console.log(`[TutorService] Explicitly updated tutors.admin_notes column using update() method`);
        console.log(`[TutorService] Update result affected rows:`, updateResult.affected);
        console.log(`[TutorService] Value saved: "${adminNotesToSave}"`);
        
        // Reload tutor from database to verify admin_notes were saved
        const reloadedTutor = await this.tutorsRepository.findOne({
          where: { tutor_id: id },
          relations: ['user']
        });
        
        if (reloadedTutor) {
          console.log(`[TutorService] VERIFICATION - Reloaded tutor ${id} from database after explicit update:`);
          console.log(`[TutorService]   - Status: ${reloadedTutor.status}`);
          console.log(`[TutorService]   - Admin Notes from tutors.admin_notes column:`, reloadedTutor.admin_notes ? `"${reloadedTutor.admin_notes}"` : 'NULL');
          
          if (!reloadedTutor.admin_notes || reloadedTutor.admin_notes !== adminNotesToSave) {
            console.error(`[TutorService] ERROR: Admin notes NOT saved correctly!`);
            console.error(`[TutorService] Expected: "${adminNotesToSave}"`);
            console.error(`[TutorService] Actual from DB: "${reloadedTutor.admin_notes || 'NULL'}"`);
          } else {
            console.log(`[TutorService] SUCCESS: Admin notes verified in database!`);
          }
          
          // Use the reloaded tutor for consistency
          savedTutor = reloadedTutor;
        }
      } else {
        console.error(`[TutorService] ERROR: Cannot update admin_notes - adminNotesToSave is null for rejected status!`);
      }
    }
    
    // Final verification - log what was saved to database
    console.log(`[TutorService] FINAL VERIFICATION - Tutor ${id} in database:`);
    console.log(`[TutorService]   - Status: '${savedTutor.status}'`);
    console.log(`[TutorService]   - Admin Notes (tutors.admin_notes column):`, 
      savedTutor.admin_notes 
        ? `"${savedTutor.admin_notes.substring(0, 100)}${savedTutor.admin_notes.length > 100 ? '...' : ''}"` 
        : 'NULL'
    );
    
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
      // Send rejection email to tutor with the admin notes from database
      // Use savedTutor.admin_notes which was just saved to the database admin_notes column
      const notesForEmail = savedTutor.admin_notes && savedTutor.admin_notes.trim().length > 0 
        ? savedTutor.admin_notes.trim() 
        : undefined;
      
      console.log(`[TutorService] Sending rejection email to ${(tutor.user as any)?.email}`);
      console.log(`[TutorService] Admin notes from database (admin_notes column):`, notesForEmail ? `"${notesForEmail.substring(0, 50)}${notesForEmail.length > 50 ? '...' : ''}"` : 'none');
      
      try {
        await this.emailService.sendTutorApplicationRejectionEmail({
          name: (tutor.user as any)?.name || 'Tutor',
          email: (tutor.user as any)?.email || '',
          adminNotes: notesForEmail, // Use notes from database admin_notes column
        });
        console.log(`[TutorService] Rejection email sent successfully to ${(tutor.user as any)?.email}`);
      } catch (error) {
        console.error('[TutorService] Failed to send tutor application rejection email:', error);
        // Don't throw error to avoid breaking the rejection process
      }
    }

    return savedTutor;
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

  async updateTutor(tutorId: number, data: { full_name?: string; university_id?: number; course_id?: number; course_name?: string; bio?: string; year_level?: number; gcash_number?: string; session_rate_per_hour?: number }): Promise<{ success: true }> {
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
    if (data.session_rate_per_hour !== undefined) {
      tutor.session_rate_per_hour = data.session_rate_per_hour;
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

  async getDocuments(tutorId: number) {
    const tutor = await this.tutorsRepository.findOne({ where: { tutor_id: tutorId } });
    if (!tutor) throw new NotFoundException('Tutor not found');
    const documents = await this.documentsRepository.find({
      where: { tutor: { tutor_id: tutorId } },
      order: { document_id: 'DESC' }
    });
    return documents.map(doc => ({
      id: doc.document_id,
      document_id: doc.document_id,
      file_url: doc.file_url,
      file_name: doc.file_name,
      file_type: doc.file_type
    }));
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
  // Load tutor with user relation so we can reference tutor.user.user_id when creating notifications
  const tutor = await this.tutorsRepository.findOne({ where: { tutor_id: tutorId }, relations: ['user'] });
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

    console.log(`createBookingRequest: About to save booking with tutor_id=${tutor.tutor_id}, tutor entity:`, {
      tutor_id: tutor.tutor_id,
      has_tutor: !!(entity as any).tutor,
      tutor_object: (entity as any).tutor ? { tutor_id: ((entity as any).tutor as any).tutor_id } : 'missing'
    });

    const saved = await this.bookingRequestRepository.save(entity as any);
    
    // Verify the saved booking has the correct tutor_id
    const verifyBooking = await this.bookingRequestRepository.findOne({
      where: { id: (saved as any).id },
      relations: ['tutor', 'student']
    });
    
    console.log(`createBookingRequest: saved booking id=${(saved as any).id} tutor_id=${tutor.tutor_id} tutor_user_id=${(tutor.user as any)?.user_id} student_user_id=${(student as any)?.user_id}`);
    console.log(`createBookingRequest: booking details:`, {
      id: (saved as any).id,
      subject: (saved as any).subject,
      date: (saved as any).date,
      time: (saved as any).time,
      status: (saved as any).status,
      tutor_id: tutor.tutor_id,
      student_id: (student as any)?.user_id,
      verified_tutor_id: (verifyBooking as any)?.tutor?.tutor_id || (verifyBooking as any)?.tutor_id || 'NOT FOUND'
    });
    
    // Get student user name for notification
    const studentUserName = (student as any)?.name || 'A student';
    
    // Create notification for tutor only (do NOT notify the student to avoid duplicates and empty receiver_id)
    const tutorNotification = this.notificationRepository.create({
      userId: (tutor.user as any)?.user_id?.toString(),
      receiver_id: (tutor.user as any)?.user_id,
      userType: 'tutor',
      message: `${studentUserName} has requested a booking for ${data.subject}`,
      timestamp: new Date(),
      read: false,
      sessionDate: data.date,
      subjectName: data.subject,
      booking: saved
    });

    try {
      console.log(`createBookingRequest: Saving notification for tutor user_id=${(tutor.user as any)?.user_id}`);
      const savedNotif = await this.notificationRepository.save(tutorNotification as any);
      console.log(`createBookingRequest: Notification saved id=${(savedNotif as any)?.notification_id}`);
    } catch (err) {
      console.error('createBookingRequest: Failed to save tutor notification', err);
      // Don't throw - booking succeeded; but log for debugging and continue
    }

    return { success: true, bookingId: (saved as any).id };
  }

  async getStudentBookingRequests(studentUserId: number) {
    const student = await this.usersRepository.findOne({ where: { user_id: studentUserId } });
    if (!student) throw new NotFoundException('Student not found');

    // Always return the student's booking requests; frontend filters by status
    const requests = await this.bookingRequestRepository.find({
      where: { student: { user_id: studentUserId } as any },
      relations: ['tutor', 'tutor.user', 'payments'],
      order: { created_at: 'DESC' }
    });
    // Debug: log statuses returned so we can trace why UI shows Leave Feedback first
    try {
      console.log(`getStudentBookingRequests: returning ${requests.length} bookings for student_user_id=${studentUserId}`);
      requests.forEach(r => console.log(`  booking id=${(r as any).id} status=${(r as any).status} tutee_rating=${(r as any).tutee_rating}`));
    } catch (e) {
      // ignore logging errors
    }
    return requests;
  }

  async getTutorStatus(idParam: number) {
    console.log(`[getTutorStatus] 🔍 Starting status check for ID: ${idParam}`);
    
    // Try to find tutor by user_id first with EXACT raw database query
    const rawQuery = await this.tutorsRepository.query(
      `SELECT t.*, u.user_id, u.name 
       FROM tutors t 
       JOIN users u ON t.user_id = u.user_id 
       WHERE u.user_id = ?`,
      [idParam]
    );
    console.log('[getTutorStatus] 📝 Raw DB Query Result:', rawQuery);

    let tutor;
    if (rawQuery && rawQuery.length > 0) {
      // Use raw query result
      tutor = rawQuery[0];
      console.log('[getTutorStatus] ✅ Found tutor by user_id in raw query:', {
        tutor_id: tutor.tutor_id,
        user_id: tutor.user_id,
        raw_status: tutor.status
      });
    } else {
      // Fallback to repository query
      console.log(`[getTutorStatus] 🔍 Raw query found nothing, trying repository query...`);
      tutor = await this.tutorsRepository.findOne({ 
        where: { user: { user_id: idParam } },
        relations: ['user']
      });

      if (!tutor) {
        // Last resort: try by tutor_id
        console.log(`[getTutorStatus] 🔍 Not found by user_id, trying tutor_id: ${idParam}`);
        tutor = await this.tutorsRepository.findOne({
          where: { tutor_id: idParam },
          relations: ['user']
        });
      }
    }
    
    if (!tutor) {
      console.error(`[getTutorStatus] ❌ Tutor not found for either user_id or tutor_id: ${idParam}`);
      throw new NotFoundException('Tutor not found');
    }

    // Log raw tutor data
    console.log('[getTutorStatus] 📊 Raw tutor data:', {
      tutor_id: tutor.tutor_id,
      user_id: tutor.user_id || (tutor.user && tutor.user.user_id),
      raw_status: tutor.status,
      status_type: typeof tutor.status
    });
    
    // Debug log raw data from database
    console.log(`[getTutorStatus] 📊 Raw tutor data from DB:`, {
      tutor_id: tutor.tutor_id,
      user_id: tutor.user_id || (tutor.user && tutor.user.user_id),
      raw_status: tutor.status,
      status_type: typeof tutor.status,
      admin_notes: tutor.admin_notes || 'none'
    });
    
    // Normalize status to lowercase for consistency
    const normalizedStatus = String(tutor.status || '').toLowerCase();
    const isApproved = normalizedStatus === 'approved';
    
    console.log(`[getTutorStatus] 🔄 Status normalization:`, {
      original_status: tutor.status,
      normalized_status: normalizedStatus,
      is_approved: isApproved
    });
    
    const response = {
      is_verified: isApproved,
      status: normalizedStatus, // Send normalized status
      admin_notes: tutor.admin_notes || null
    };
    
    console.log('[getTutorStatus] ✅ Returning response:', response);
    
    return response;
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

  async updateOnlineStatus(userId: number, status: 'online' | 'offline'): Promise<void> {
    try {
      const tutor = await this.tutorsRepository.findOne({
        where: { user: { user_id: userId } },
        relations: ['user']
      });
      
      if (!tutor) {
        console.warn(`Tutor not found for user_id: ${userId}`);
        return; // Don't throw error, just log warning
      }
      
      tutor.activity_status = status;
      await this.tutorsRepository.save(tutor);
      console.log(`Tutor ${tutor.tutor_id} (user_id: ${userId}) online status updated to: ${status}`);
    } catch (error) {
      console.error(`Failed to update online status for user_id ${userId}:`, error);
      throw error;
    }
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
      session_rate_per_hour: tutor.session_rate_per_hour || null,
      course_id: tutor.course_id || null, // Include course_id for filtering subjects
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

  async submitSubjectApplication(tutorId: number, subjectName: string, files: any[], isReapplication: boolean = false) {
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
        
        // For reapplications, if no new files but existing documents exist, that's okay
        // The existing documents will remain and the status will be changed to pending
        if (isReapplication && (!files || files.length === 0)) {
          const existingDocs = existingTutorSubject.documents || [];
          if (existingDocs.length > 0) {
            console.log(`Reapplying rejected subject "${trimmedName}" with ${existingDocs.length} existing documents (no new files)`);
            // Status already changed to pending above, existing documents remain
            return { success: true, message: 'Subject reapplication submitted successfully' };
          }
        }
      }
    } else {
      // Create new tutor subject with pending status
      // For new applications, files are required
      if (!files || files.length === 0) {
        throw new Error('At least one file is required for new subject application');
      }
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

    console.log(`getBookingRequests: Looking for bookings with tutor_id=${tutor.tutor_id}`);
    
    // First, let's check if there are any bookings at all for this tutor using raw query
    const rawCount = await this.bookingRequestRepository
      .createQueryBuilder('br')
      .where('br.tutor_id = :tutorId', { tutorId: tutor.tutor_id })
      .getCount();
    console.log(`getBookingRequests: Raw count of bookings with tutor_id=${tutor.tutor_id}: ${rawCount}`);
    
    // Use QueryBuilder to query by the tutor_id foreign key directly
    // This is more reliable than using nested object queries
    // Note: student is already a User entity, not a Student entity, so no need to join student.user
    const requests = await this.bookingRequestRepository
      .createQueryBuilder('br')
      .leftJoinAndSelect('br.student', 'student')
      .leftJoinAndSelect('br.tutor', 'tutor')
      .leftJoinAndSelect('tutor.user', 'tutorUser')
      .where('br.tutor_id = :tutorId', { tutorId: tutor.tutor_id })
      .orderBy('br.created_at', 'DESC')
      .getMany();
    
    console.log(`getBookingRequests: found ${requests.length} requests for tutor_id=${tutor.tutor_id}`);
    console.log(`getBookingRequests: booking IDs:`, requests.map((r: any) => ({ 
      id: r.id, 
      subject: r.subject, 
      status: r.status, 
      date: r.date,
      tutor_id_in_booking: (r.tutor as any)?.tutor_id || (r as any).tutor_id || 'missing',
      student_id: (r.student as any)?.user_id || 'missing'
    })));
    
    // Also try alternative query to see if we get different results
    const altRequests = await this.bookingRequestRepository.find({
      where: { tutor: tutor } as any,
      relations: ['student', 'tutor'],
      order: { created_at: 'DESC' }
    });
    console.log(`getBookingRequests: Alternative query found ${altRequests.length} requests`);
    
    return requests;
  }

  async updateBookingRequestStatus(bookingId: number, status: 'accepted' | 'declined') {
    const request = await this.bookingRequestRepository.findOne({ 
      where: { id: bookingId },
      relations: ['tutor', 'tutor.user', 'student']
    });
    if (!request) throw new NotFoundException('Booking request not found');

    const student = await this.usersRepository.findOne({
      where: { user_id: request.student.user_id }
    });
    if (!student) throw new NotFoundException('Student not found');

    // Get tutor with full details including hourly rate
    const tutor = await this.tutorsRepository.findOne({
      where: { tutor_id: (request.tutor as any).tutor_id },
      relations: ['user']
    });
    if (!tutor) throw new NotFoundException('Tutor not found');

    const acceptanceTime = new Date();
    request.status = status;
    if (status === 'accepted') {
      request.status = 'awaiting_payment';
    }
    const savedRequest = await this.bookingRequestRepository.save(request);

    // Calculate amount based on tutor's hourly rate and booking duration
    const hourlyRate = Number(tutor.session_rate_per_hour) || 0;
    const duration = Number(request.duration) || 0;
    const totalAmount = hourlyRate * duration;

    // Format booking date
    const bookingDate = new Date(request.date);
    const formattedDate = bookingDate.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Format acceptance date and time
    const formattedAcceptanceDate = acceptanceTime.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedAcceptanceTime = acceptanceTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const tutorName = (tutor.user as any)?.name || 'Tutor';

    // Create notification for student with detailed message
    const notificationMessage = status === 'accepted' 
      ? `${tutorName} has approved your booking on ${formattedDate} for ${duration} hour${duration !== 1 ? 's' : ''}. Please pay the corresponding amount of ₱${totalAmount.toFixed(2)}. Accepted on ${formattedAcceptanceDate} at ${formattedAcceptanceTime}.`
      : `Your booking request for ${request.subject} was declined.`;
    
    // Ensure sessionDate is a Date object
    const sessionDate = request.date instanceof Date ? request.date : new Date(request.date);
    
    const studentNotification = this.notificationRepository.create({
      userId: student.user_id.toString(),
      receiver_id: student.user_id,
      userType: 'tutee',
      message: notificationMessage,
      timestamp: acceptanceTime,
      read: false,
      sessionDate: sessionDate,
      subjectName: request.subject,
      booking: savedRequest
    });
    
    const savedNotification = await this.notificationRepository.save(studentNotification);
    console.log(`updateBookingRequestStatus: Created notification for student user_id=${student.user_id} about booking approval`);
    console.log(`updateBookingRequestStatus: Notification ID=${savedNotification.notification_id}, userId=${savedNotification.userId}, userType=${savedNotification.userType}`);
    console.log(`updateBookingRequestStatus: Message=${notificationMessage.substring(0, 100)}...`);

    // Also create a notification for the tutor about the accepted booking (separate, tutor-scoped)
    if (status === 'accepted') {
      const tutorNotification = this.notificationRepository.create({
        userId: (tutor.user as any)?.user_id?.toString(),
        receiver_id: (tutor.user as any)?.user_id,
        userType: 'tutor',
        message: `You approved a booking with ${(student as any).name || 'a student'} for ${request.subject} on ${formattedDate}.`,
        timestamp: acceptanceTime,
        read: false,
        sessionDate: sessionDate,
        subjectName: request.subject,
        booking: savedRequest
      });
      await this.notificationRepository.save(tutorNotification);
      console.log(`updateBookingRequestStatus: Created notification for tutor user_id=${(tutor.user as any)?.user_id} about approval`);
    }

    return { success: true };
  }

  async updatePaymentStatus(bookingId: number, status: 'approved' | 'rejected') {
    const request = await this.bookingRequestRepository.findOne({
      where: { id: bookingId },
      relations: ['tutor', 'tutor.user', 'student', 'student.user']
    });
    if (!request) throw new NotFoundException('Booking request not found');

    if (status === 'approved') {
      // Tutor confirms after admin approval -> mark as upcoming
      request.status = 'upcoming';
    } else {
      request.status = 'payment_rejected';
    }
    const savedRequest = await this.bookingRequestRepository.save(request);

    // Notifications: do NOT notify for upcoming sessions (per requirement).
    // Only notify when tutor rejects after admin approval.
    if (status !== 'approved') {
      const notifications = [
        // Notify student about rejection
        this.notificationRepository.create({
          userId: request.student.user_id.toString(),
          receiver_id: request.student.user_id,
          userType: 'tutee',
          message: `Your payment for the ${request.subject} session was rejected by the tutor. Please try again.`,
          timestamp: new Date(),
          read: false,
          sessionDate: request.date,
          subjectName: request.subject,
          booking: savedRequest
        }),
        // Notify tutor about rejection (confirmation of action)
        this.notificationRepository.create({
          userId: (request.tutor.user as any).user_id.toString(),
          receiver_id: (request.tutor.user as any).user_id,
          userType: 'tutor',
          message: `You rejected the payment for ${request.subject} from ${request.student.name}`,
          timestamp: new Date(),
          read: false,
          sessionDate: request.date,
          subjectName: request.subject,
          booking: savedRequest
        })
      ];
      await Promise.all(notifications.map(n => this.notificationRepository.save(n)));
    }

    return { success: true };
  }

  async markBookingAsCompleted(bookingId: number, status: BookingRequest['status'], file: any) {
    const request = await this.bookingRequestRepository.findOne({
      where: { id: bookingId },
      relations: ['tutor', 'tutor.user', 'student']
    });
    if (!request) throw new NotFoundException('Booking request not found');

    // Only allow marking as completed if the booking is not already completed or cancelled
    if (request.status === 'completed' || request.status === 'cancelled') {
      return { success: false, message: 'Booking already completed or cancelled' };
    }

    if (file) {
      // Assuming the column is named 'session_proof_url' on the BookingRequest entity
      const proofUrl = `/tutor_documents/${file.filename}`;
      (request as any).session_proof_url = proofUrl;
    }

    // Use the status from the request, which should be 'awaiting_confirmation'
    request.status = status;
    // Set tutor_marked_done_at when tutor marks the booking as done
    (request as any).tutor_marked_done_at = new Date();
    const saved = await this.bookingRequestRepository.save(request);

    // Create notification for student confirming session completion
    try {
      const notification = this.notificationRepository.create({
        userId: request.student.user_id.toString(),
        receiver_id: request.student.user_id,
        userType: 'tutee',
        message: `Your session for ${request.subject} on ${new Date(request.date).toLocaleDateString()} has been marked as completed by the tutor and is awaiting your confirmation.`,
        timestamp: new Date(),
        read: false,
        sessionDate: request.date,
        subjectName: request.subject,
        booking: saved
      });
      await this.notificationRepository.save(notification);
    } catch (e) {
      console.warn('Failed to create completion notification:', e);
    }

    return { success: true };
  }

  async uploadPaymentProof(bookingId: number, file: any) {
    const request = await this.bookingRequestRepository.findOne({
      where: { id: bookingId },
      relations: ['tutor', 'tutor.user', 'student']
    });
    if (!request) {
      throw new NotFoundException('Booking request not found');
    }
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Save file URL and set status back to awaiting_payment for tutor review
    const fileUrl = `/tutor_documents/${file.filename}`;
    request.payment_proof = fileUrl;
    // Keep status consistent with tutor dashboard logic
    if (request.status === 'pending' || request.status === 'declined' || request.status === 'cancelled') {
      // Do not allow payment on non-accepted requests
      throw new BadRequestException('Cannot upload payment proof for this booking status');
    }
    // If previously rejected or still awaiting, set to awaiting_payment for review
    request.status = 'awaiting_payment';
    const saved = await this.bookingRequestRepository.save(request);

    // Also update the payment record if it exists
    const existingPayment = await this.paymentRepository.findOne({
      where: { booking_request_id: bookingId } as any
    });
    if (existingPayment) {
      existingPayment.payment_proof_url = fileUrl;
      await this.paymentRepository.save(existingPayment as any);
    }

    // Notify tutor that student uploaded a payment proof
    const notification = this.notificationRepository.create({
      userId: (request.tutor as any)?.user?.user_id?.toString(),
      receiver_id: (request.tutor as any)?.user?.user_id,
      userType: 'tutor',
      message: `Payment proof uploaded by ${request.student?.name || 'student'} for ${request.subject}`,
      timestamp: new Date(),
      read: false,
      sessionDate: request.date as any,
      subjectName: request.subject,
      booking: saved
    });
    await this.notificationRepository.save(notification);

    return { success: true, payment_proof: fileUrl };
  }

  async getTutorSessions(userId: number) {
    // This would need to be implemented based on your session entity
    // For now, return empty array
    return [];
  }

  async getTutorPayments(userId: number) {
    // Accept either tutor_id or user.user_id
    let tutor = await this.tutorsRepository.findOne({ where: { tutor_id: userId as any } });
    if (!tutor) {
      tutor = await this.tutorsRepository.findOne({ 
        where: { user: { user_id: userId } },
        relations: ['user']
      });
    }
    if (!tutor) {
      console.warn(`getTutorPayments: Tutor not found for id/user_id=${userId}`);
      throw new NotFoundException('Tutor not found');
    }

    // Fetch all payments for this tutor with student and user relations
    const payments = await this.paymentRepository.find({
      where: { tutor_id: tutor.tutor_id } as any,
      relations: ['student', 'student.user', 'tutor', 'tutor.user'],
      order: { created_at: 'DESC' }
    });

    // Map to frontend-friendly format
    return payments.map((p: any) => ({
      id: p.payment_id,
      payment_id: p.payment_id,
      subject_id: p.subject_id || null,
      subject_name: p.subject?.subject_name || null,
      amount: Number(p.amount),
      status: p.status, // 'pending', 'paid', 'disputed', 'refunded', 'confirmed'
      created_at: p.created_at,
      student_name: p.student?.user?.name || 'Unknown Student',
      student_id: p.student_id,
      tutor_id: p.tutor_id,
      dispute_status: p.dispute_status,
    }));
  }

  async getTutorPayouts(userId: number) {
    // Accept either tutor_id or user.user_id
    let tutor = await this.tutorsRepository.findOne({ where: { tutor_id: userId as any } });
    if (!tutor) {
      tutor = await this.tutorsRepository.findOne({ 
        where: { user: { user_id: userId } },
        relations: ['user']
      });
    }
    if (!tutor) {
      console.warn(`getTutorPayouts: Tutor not found for id/user_id=${userId}`);
      throw new NotFoundException('Tutor not found');
    }

    // Fetch all payouts for this tutor
    const payouts = await this.payoutRepository.find({
      where: { tutor_id: tutor.tutor_id } as any,
      relations: ['payment', 'tutor'],
      order: { created_at: 'DESC' }
    });

    return payouts.map((p: any) => ({
      payout_id: p.payout_id,
      payment_id: p.payment_id,
      tutor_id: p.tutor_id,
      amount_released: Number(p.amount_released),
      status: p.status, // 'pending', 'released', 'failed'
      release_proof_url: p.release_proof_url,
      rejection_reason: p.rejection_reason,
      admin_notes: p.admin_notes,
      created_at: p.created_at,
    }));
  }

  async getTutorEarningsStats(userId: number) {
    // Accept either tutor_id or user.user_id
    let tutor = await this.tutorsRepository.findOne({ where: { tutor_id: userId as any } });
    if (!tutor) {
      tutor = await this.tutorsRepository.findOne({ 
        where: { user: { user_id: userId } },
        relations: ['user']
      });
    }
    if (!tutor) {
      console.warn(`getTutorEarningsStats: Tutor not found for id/user_id=${userId}`);
      throw new NotFoundException('Tutor not found');
    }

    // Fetch all payments for this tutor
    const payments = await this.paymentRepository.find({
      where: { tutor_id: tutor.tutor_id } as any
    });

    // Calculate stats from payments
    const confirmedPayments = payments.filter((p: any) => p.status === 'confirmed' || p.status === 'paid');
    const pendingPayments = payments.filter((p: any) => p.status === 'pending');

    const total_earnings = confirmedPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    const pending_earnings = pendingPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

    // Get completed bookings (confirmed status)
    const completedBookings = await this.bookingRequestRepository.find({
      where: { tutor: { tutor_id: tutor.tutor_id } as any, status: 'confirmed' } as any
    });

    // Calculate total hours from completed bookings
    const total_hours = completedBookings.reduce((sum: number, b: any) => sum + Number(b.duration || 0), 0);

    // Get average rating (this would need to be implemented based on rating entity)
    // For now, return 0
    const average_rating = 0;

    return {
      total_earnings,
      pending_earnings,
      completed_sessions: completedBookings.length,
      average_rating,
      total_hours
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
