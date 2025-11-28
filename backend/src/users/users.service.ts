import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { User, Admin, Tutor, Course, University, Student, Notification, BookingRequest, Session, Subject } from '../database/entities';
import { NotificationsService } from '../notifications/notifications.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from '../auth/auth.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
    @InjectRepository(Tutor)
    private tutorRepository: Repository<Tutor>,
    @InjectRepository(Course)
    private coursesRepository: Repository<Course>,
    @InjectRepository(University)
    private universitiesRepository: Repository<University>,
    @InjectRepository(Student)
    private studentRepository: Repository<Student>,
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(BookingRequest)
    private bookingRequestRepository: Repository<BookingRequest>,
    @InjectRepository(Session)
    private sessionRepository: Repository<Session>,
    @InjectRepository(Subject)
    private subjectRepository: Repository<Subject>,
    private notificationsService: NotificationsService,
  ) {}

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({ relations: ['admin_profile', 'tutor_profile', 'student_profile', 'student_profile.university', 'student_profile.course', 'tutor_profile.university', 'tutor_profile.course'] });
  }
  /**
   * Move overdue 'upcoming' bookings to sessions table for historical tracking
   * NOTE: Does NOT change booking request status - status remains 'upcoming' until tutor marks as done
   */
  async moveOverdueBookingsToSessions(): Promise<{ moved: number }> {
    const now = new Date();
    // Find all upcoming bookings where scheduled end time is in the past
    // Note: 'subject' is a string column, not a relation, so it's not included in relations
    const overdueBookings = await this.bookingRequestRepository.find({
      where: { status: 'upcoming' },
      relations: ['student', 'tutor'],
    });
    let moved = 0;
    for (const booking of overdueBookings) {
      // Calculate scheduled end time
      const [hour, minute] = booking.time.split(':').map(Number);
      const startDate = new Date(booking.date);
      startDate.setHours(hour, minute, 0, 0);
      const endDate = new Date(startDate.getTime() + booking.duration * 60 * 60 * 1000);
      if (endDate < now) {
        // Check if session already exists to avoid duplicates
        const existingSession = await this.sessionRepository.findOne({
          where: {
            student: { user: { user_id: booking.student.user_id } } as any,
            tutor: { tutor_id: booking.tutor.tutor_id } as any,
            start_time: startDate,
          } as any,
        });
        
        // Only create session if it doesn't already exist
        if (!existingSession) {
          // Find Student and Tutor entities by user reference
          const studentEntity = await this.studentRepository.findOne({ where: { user: { user_id: booking.student.user_id } } });
          const tutorEntity = await this.tutorRepository.findOne({ where: { tutor_id: booking.tutor.tutor_id } });
          // Find subject entity if booking.subject is a string
          let subjectEntity = null;
          if (typeof booking.subject === 'string') {
            subjectEntity = await this.subjectRepository.findOne({ where: { subject_name: booking.subject } });
          } else {
            subjectEntity = booking.subject;
          }
          await this.sessionRepository.save({
            student: studentEntity,
            tutor: tutorEntity,
            subject: subjectEntity,
            start_time: startDate,
            end_time: endDate,
            status: 'scheduled', // Keep as 'scheduled' until tutor marks as done
          });
        }
        
        // DO NOT change booking request status - it should remain 'upcoming' 
        // until the tutor explicitly marks it as done via the "Mark as Done" button
        // This allows the tutor to still upload proof and mark the session as completed
        moved++;
      }
    }
    return { moved };
  }

    /**
     * Cron job: runs every hour to move overdue bookings automatically
     */
    @Cron(CronExpression.EVERY_HOUR)
    async handleMoveOverdueBookingsCron() {
      const result = await this.moveOverdueBookingsToSessions();
      if (result.moved > 0) {
        this.logger.log(`Moved ${result.moved} overdue bookings to sessions.`);
      }
    }

  async findOneById(id: number): Promise<User | undefined> {
    return this.usersRepository.findOne({ where: { user_id: id }, relations: ['admin_profile', 'tutor_profile', 'student_profile', 'student_profile.university', 'student_profile.course', 'tutor_profile.university', 'tutor_profile.course'] });
  }

  async findOneByEmail(email: string): Promise<User | undefined> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async hasAdmin(): Promise<boolean> {
    const adminCount = await this.usersRepository.count({ where: { user_type: 'admin' } });
    return adminCount > 0;
  }

  async createAdmin(registerDto: RegisterDto): Promise<User> {
    if (await this.hasAdmin()) {
      throw new BadRequestException('An admin account already exists. Please log in instead.');
    }

    let university: University | undefined;
    if (registerDto.university_id) {
      university = await this.universitiesRepository.findOne({ where: { university_id: registerDto.university_id } });
      if (!university) {
        throw new BadRequestException('Invalid university ID');
      }
    }

    const newUser = this.usersRepository.create({
      name: registerDto.name,
      email: registerDto.email,
      password: registerDto.password,
      user_type: 'admin',
      status: 'active',
      profile_image_url: 'user_profile_images/userProfile_admin.png',
    });
    const savedUser: User = await this.usersRepository.save(newUser);

    // Create an admin profile for this user and link university if provided
    const adminProfile = this.adminRepository.create({ 
      user: savedUser,
      ...(university && { university: university, university_id: university.university_id }) // Link university to admin profile if exists
    });
    await this.adminRepository.save(adminProfile);
    
    // Reload user with profile
    return this.findOneById(savedUser.user_id);
  }

  async submitBookingFeedback(bookingId: number, studentUserId: number, rating: number, comment: string) {
    const booking = await this.bookingRequestRepository.findOne({ where: { id: bookingId }, relations: ['student', 'tutor', 'tutor.user'] });
    if (!booking) throw new BadRequestException('Booking not found');
    if ((booking.student as any)?.user_id !== studentUserId) throw new BadRequestException('Not allowed');

    // Ensure booking is completed (tutor marked it done) before allowing feedback
    if (booking.status !== 'completed') {
      throw new BadRequestException('Booking must be marked completed before leaving feedback');
    }

    booking.tutee_rating = Number(rating);
    booking.tutee_comment = comment || null;
    booking.tutee_feedback_at = new Date();
    await this.bookingRequestRepository.save(booking as any);

    // Notify all admins about the new feedback
    const admins = await this.adminRepository.find({ relations: ['user'] });
    const messages = admins.map((a: any) => {
      const adminUser = a.user as any;
      const msg = `${(booking.student as any).name || 'A student'} left feedback for ${booking.subject}: ${rating}/5${comment ? ' — ' + comment : ''}`;
      return this.notificationRepository.create({
        userId: adminUser.user_id.toString(),
        receiver_id: adminUser.user_id,
        userType: 'admin',
        message: msg,
        timestamp: new Date(),
        read: false,
        sessionDate: booking.date as any,
        subjectName: booking.subject,
        booking: booking as any
      });
    });

    try {
      await Promise.all(messages.map(m => this.notificationRepository.save(m as any)));
    } catch (e) {
      console.warn('submitBookingFeedback: failed to save admin notifications', e);
    }

    return { success: true };
  }

  async confirmBookingCompletion(bookingId: number, studentUserId: number) {
    const booking = await this.bookingRequestRepository.findOne({ where: { id: bookingId }, relations: ['student', 'tutor', 'tutor.user'] });
    if (!booking) throw new BadRequestException('Booking not found');
    if ((booking.student as any)?.user_id !== studentUserId) throw new BadRequestException('Not allowed');

    // Only allow confirming if tutor already marked it for confirmation
    if (booking.status !== 'awaiting_confirmation') {
      throw new BadRequestException('Booking is not awaiting confirmation');
    }

    booking.status = 'completed';
    booking.tutee_feedback_at = booking.tutee_feedback_at || null;
    // Set tutee_marked_done_at when tutee confirms the session
    (booking as any).tutee_marked_done_at = new Date();
    const saved = await this.bookingRequestRepository.save(booking as any);

    // Notify tutor that the student has confirmed completion
    try {
      const tutorUserId = (booking.tutor as any)?.user?.user_id;
      if (tutorUserId) {
        const note = this.notificationRepository.create({
          userId: tutorUserId.toString(),
          receiver_id: tutorUserId,
          userType: 'tutor',
          message: `The student has confirmed completion for ${booking.subject}.`,
          timestamp: new Date(),
          read: false,
          sessionDate: booking.date as any,
          subjectName: booking.subject,
          booking: saved
        } as any);
        await this.notificationRepository.save(note as any);
      }
    } catch (e) {
      console.warn('confirmBookingCompletion: failed to notify tutor', e);
    }

    return { success: true };
  }

  async isAdmin(userId: number): Promise<boolean> {
      const admin = await this.adminRepository.findOne({ where: { user: { user_id: userId } } });
      return !!admin;
  }

  async getAdminProfile(userId: number) {
    const user = await this.usersRepository.findOne({
      where: { user_id: userId },
      relations: ['admin_profile', 'admin_profile.university']
    });
    if (!user || !user.admin_profile) {
      throw new BadRequestException('Admin not found');
    }
    const admin = user.admin_profile as any;
    return {
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      profile_image_url: user.profile_image_url,
      created_at: (user as any).created_at,
      university_id: admin.university_id || null,
      university_name: admin.university?.name || null,
      qr_code_url: admin.qr_code_url || null,
    };
  }

  async updateAdminQr(userId: number, qrUrl: string) {
    const admin = await this.adminRepository.findOne({
      where: { user: { user_id: userId } },
      relations: ['user']
    });
    if (!admin) {
      throw new BadRequestException('Admin not found');
    }
    (admin as any).qr_code_url = qrUrl;
    await this.adminRepository.save(admin);
    return { success: true, qr_code_url: qrUrl };
  }

  async getAdminsWithQr(): Promise<Array<{ user_id: number; name: string; qr_code_url: string }>> {
    const admins = await this.adminRepository.find({ relations: ['user'] });
    return admins
      .filter((a: any) => !!a.qr_code_url)
      .map((a: any) => ({
        user_id: a.user?.user_id,
        name: a.user?.name,
        qr_code_url: a.qr_code_url,
      }));
  }

  async findTutorProfile(userId: number): Promise<Tutor | null> {
    return this.tutorRepository.findOne({ where: { user: { user_id: userId } } });
  }

  async updatePassword(userId: number, hashedPassword: string): Promise<void> {
    await this.usersRepository.update(userId, { password: hashedPassword });
  }

  async updateStatus(userId: number, status: 'active' | 'inactive'): Promise<User> {
    const user = await this.findOneById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    (user as any).status = status;
    return this.usersRepository.save(user);
  }

  async resetPassword(userId: number, newPassword: string): Promise<{ success: true }>
  {
    const user = await this.findOneById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await this.usersRepository.save(user);
    return { success: true };
  }

  async updateUser(userId: number, body: { name?: string; email?: string; status?: 'active' | 'inactive'; year_level?: number; university_id?: number; profile_image_url?: string }): Promise<User> {
    const user = await this.findOneById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    if (body.name !== undefined) user.name = body.name;
    if (body.email !== undefined) user.email = body.email as any;
    if (body.status !== undefined) (user as any).status = body.status;
    if (body.year_level !== undefined) (user as any).year_level = body.year_level as any;
    if (body.university_id !== undefined) (user as any).university_id = body.university_id as any;
    if (body.profile_image_url !== undefined) user.profile_image_url = body.profile_image_url;
    return this.usersRepository.save(user);
  }

  async deleteUser(userId: number): Promise<{ success: true }> {
    try {
      await this.usersRepository.delete({ user_id: userId });
    } catch (error) {
      // Likely foreign key constraints (admin/tutor/student profiles, sessions, payments)
      throw new BadRequestException(
        'Unable to delete this user because they have related records (e.g., profiles, sessions, or payments). Please resolve related records first or deactivate the user instead.'
      );
    }
    return { success: true };
  }

  async createStudent(body: RegisterDto): Promise<User> {
    // Password is already hashed in AuthService.register(), so use it directly
    console.log('=== CREATE STUDENT DEBUG ===');
    console.log('Password already hashed:', body.password.startsWith('$2b$'));

    // Resolve course: either provided course_id or create/find by name under university
    let resolvedCourseId: number | null = body.course_id ?? null;
    if (!resolvedCourseId && body.course_name && body.course_name.trim().length > 0) {
      const uni = await this.universitiesRepository.findOne({ where: { university_id: body.university_id } });
      if (uni) {
        const existingCourse = await this.coursesRepository.findOne({ where: { course_name: body.course_name.trim(), university: { university_id: uni.university_id } }, relations: ['university'] });
        if (existingCourse) {
          resolvedCourseId = existingCourse.course_id;
        } else {
          const newCourse = this.coursesRepository.create({ course_name: body.course_name.trim(), university: uni });
          const savedCourse: Course = await this.coursesRepository.save(newCourse);
          resolvedCourseId = savedCourse.course_id;
        }
      }
    }

    const user = this.usersRepository.create({
      name: body.name,
      email: body.email,
      password: body.password, // Use the already hashed password
      user_type: 'student', // Changed from 'tutee' to 'student' for consistency
      status: 'active', // Assuming registration only happens after email is verified
    });
    const savedUser: User = await this.usersRepository.save(user);

    // Resolve university and course for student profile
    let university: University | undefined;
    if (body.university_id) {
      university = await this.universitiesRepository.findOne({ where: { university_id: body.university_id } });
      if (!university) {
        throw new BadRequestException('Invalid university ID');
      }
    }

    let course: Course | undefined;
    if (resolvedCourseId) {
      course = await this.coursesRepository.findOne({ where: { course_id: resolvedCourseId } });
    }

    // Create student profile
    const student = this.studentRepository.create({
      user: savedUser,
      year_level: body.year_level,
      ...(university && { university: university, university_id: university.university_id }),
      ...(course && { course: course, course_id: course.course_id }),
    });
    await this.studentRepository.save(student);

    // Reload user with profile
    return (await this.usersRepository.findOne({ where: { user_id: savedUser.user_id }, relations: ['student_profile', 'student_profile.university', 'student_profile.course'] })) as User;
  }

  async createTutor(body: RegisterDto): Promise<User> {
    // Password is already hashed in AuthService.register(), so use it directly
    console.log('=== CREATE TUTOR DEBUG ===');
    console.log('Password already hashed:', body.password.startsWith('$2b$'));
    
    // Resolve course: either provided course_id or create/find by name under university
    let resolvedCourseId: number | null = body.course_id ?? null;
    if (!resolvedCourseId && body.course_name && body.course_name.trim().length > 0) {
      const uni = await this.universitiesRepository.findOne({ where: { university_id: body.university_id } });
      if (uni) {
        const existingCourse = await this.coursesRepository.findOne({ where: { course_name: body.course_name.trim(), university: { university_id: uni.university_id } }, relations: ['university'] });
        if (existingCourse) {
          resolvedCourseId = existingCourse.course_id;
        } else {
          const newCourse = this.coursesRepository.create({ course_name: body.course_name.trim(), university: uni });
          const savedCourse: Course = await this.coursesRepository.save(newCourse);
          resolvedCourseId = savedCourse.course_id;
        }
      }
    }

    const user = this.usersRepository.create({
      name: body.name,
      email: body.email,
      password: body.password, // Use the already hashed password
      user_type: 'tutor',
      status: 'active',
    });
    const savedUser: User = await this.usersRepository.save(user);

    // Resolve university and course for tutor profile
    let university: University | undefined;
    if (body.university_id) {
      university = await this.universitiesRepository.findOne({ where: { university_id: body.university_id } });
      if (!university) {
        throw new BadRequestException('Invalid university ID');
      }
    }

    let course: Course | undefined;
    if (resolvedCourseId) {
      course = await this.coursesRepository.findOne({ where: { course_id: resolvedCourseId } });
    }

    // Create tutor profile
    const tutor = this.tutorRepository.create({
      user: savedUser,
      bio: body.bio,
      year_level: body.year_level,
      gcash_number: body.gcash_number,
      session_rate_per_hour: body.SessionRatePerHour ? Number(body.SessionRatePerHour) : null,
      ...(university && { university: university, university_id: university.university_id }),
      ...(course && { course: course, course_id: course.course_id }),
    });
    await this.tutorRepository.save(tutor);

    // Reload user with profile
    return (await this.usersRepository.findOne({ where: { user_id: savedUser.user_id }, relations: ['tutor_profile', 'tutor_profile.university', 'tutor_profile.course'] })) as User;
  }

  async getNotifications(userId: number) {
    // Determine user type from user_id
    const user = await this.usersRepository.findOne({ 
      where: { user_id: userId },
      relations: ['tutor_profile', 'student_profile']
    });
    
    if (!user) {
      console.log(`getNotifications: User with user_id=${userId} not found`);
      return { success: true, data: [] };
    }

    // Prefer the explicit user_type column when available. It is the
    // authoritative source of a user's role (admin/tutor/tutee/student).
    // Map legacy/alternate values where necessary.
    let userType: 'tutor' | 'tutee' | 'admin' = (user as any).user_type as any;
    if (!userType) {
      userType = user.tutor_profile ? 'tutor' : (user.student_profile ? 'tutee' : 'admin');
    } else {
      // Normalize 'student' to 'tutee' for downstream consumers
      if ((userType as any) === 'student') userType = 'tutee';
    }
    console.log(`getNotifications: Fetching notifications for user_id=${userId}, userType=${userType}`);
    
    // For tutors, only show booking requests and admin payment notifications
    // For tutees, show all their notifications
    // Delegate fetching to NotificationsService which filters by receiver_id and userType
    let notifications = await this.notificationsService.getNotifications(userId, userType as 'tutor' | 'tutee' | 'admin');

    // For tutors: further filter to only show booking requests and admin payment notifications
    if (userType === 'tutor') {
      notifications = notifications.filter((n: any) => {
        const message = (n.message || '').toLowerCase();
        return message.includes('requested a booking') || 
               message.includes('booking request') ||
               (message.includes('payment') && message.includes('approved by admin'));
      });
    }

    // For tutees: exclude upcoming session notice in the bell
    if (userType === 'tutee') {
      notifications = notifications.filter((n: any) => !((n.message || '').toLowerCase().includes('upcoming')));
    }
    
    console.log(`getNotifications: Found ${notifications.length} notifications for user_id=${userId}, userType=${userType}`);

    // Map to frontend format
    const mapped = notifications.map((n: any) => {
      // Determine notification type based on message content
      // Priority: payment > booking_update > upcoming_session > system
      let type: 'upcoming_session' | 'booking_update' | 'payment' | 'system' = 'system';
      const messageLower = (n.message || '').toLowerCase();
      
      // Check for payment-related keywords first (highest priority)
      if (messageLower.includes('payment') || messageLower.includes('pay') || messageLower.includes('amount') || messageLower.includes('₱')) {
        type = 'payment';
      } else if (messageLower.includes('booking') || messageLower.includes('approved') || messageLower.includes('accepted') || messageLower.includes('declined')) {
        type = 'booking_update';
      } else if (n.sessionDate) {
        type = 'upcoming_session';
      }

      return {
        notification_id: n.notification_id,
        user_id: n.userId,
        booking_id: n.booking?.id || null,
        title: n.subjectName || 'Notification',
        message: n.message,
        type: type,
        is_read: n.read,
        created_at: n.timestamp,
        scheduled_for: n.sessionDate ? new Date(n.sessionDate).toISOString() : undefined,
        metadata: {
          session_date: n.sessionDate ? new Date(n.sessionDate).toISOString() : undefined,
          subject: n.subjectName,
          tutor_name: n.booking?.tutor?.user?.name || undefined,
          student_name: n.booking?.student?.name || undefined
        }
      };
    });

    return { success: true, data: mapped };
  }

  async getUnreadNotificationCount(userId: number) {
    const user = await this.usersRepository.findOne({ 
      where: { user_id: userId },
      relations: ['tutor_profile', 'student_profile']
    });
    
    if (!user) {
      return { success: true, data: { count: 0 } };
    }
    // Prefer explicit user_type when present and normalize 'student' -> 'tutee'
    let userType: 'tutor' | 'tutee' | 'admin' = (user as any).user_type as any;
    if (!userType) {
      userType = user.tutor_profile ? 'tutor' : (user.student_profile ? 'tutee' : 'admin');
    } else if ((userType as any) === 'student') {
      userType = 'tutee';
    }

    // Count unread notifications for this receiver. Don't rely solely on
    // userType matching because in some cases profile relations may be
    // inconsistent; however keeping userType narrows results in normal cases.
    const count = await this.notificationRepository.count({
      where: { receiver_id: userId, userType: userType as any, read: false }
    });

    return { success: true, data: { count } };
  }

  async hasUpcomingSessions(userId: number) {
    // Check if user has any upcoming bookings in the next 7 days using bookings, not notifications
    const user = await this.usersRepository.findOne({ 
      where: { user_id: userId },
      relations: ['tutor_profile', 'student_profile']
    });
    if (!user) return { success: true, data: { hasUpcoming: false } };
    // Use explicit user_type when available; fall back to profile presence
    let isTutor = false;
    if ((user as any).user_type) {
      isTutor = ((user as any).user_type === 'tutor');
    } else {
      isTutor = !!user.tutor_profile;
    }
  // Use start-of-day for the lower bound so bookings scheduled for today
  // (stored as date at 00:00:00) are included even if current time is later.
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysFromNow = new Date(startOfDay.getTime() + 7 * 24 * 60 * 60 * 1000);
  // Include the whole last day up to end-of-day
  const endOfSevenDays = new Date(sevenDaysFromNow);
  endOfSevenDays.setHours(23, 59, 59, 999);

  // Upcoming session criteria: scheduled within next 7 days and status 'upcoming'
  const statuses: any[] = ['upcoming'];

    let hasUpcoming = false;
    if (isTutor) {
      const tutor = await this.tutorRepository.findOne({ where: { user: { user_id: userId } }, relations: ['user'] } as any);
      if (tutor) {
        const count = await this.bookingRequestRepository.count({
          where: {
            tutor: { tutor_id: (tutor as any).tutor_id } as any,
            status: In(statuses) as any,
            date: Between(startOfDay, endOfSevenDays) as any
          } as any
        });
        hasUpcoming = count > 0;
      }
    } else {
      const count = await this.bookingRequestRepository.count({
        where: {
          student: { user_id: userId } as any,
          status: In(statuses) as any,
          date: Between(startOfDay, endOfSevenDays) as any
        } as any
      });
      hasUpcoming = count > 0;
    }

    return { success: true, data: { hasUpcoming } };
  }

  async getUpcomingSessionsList(userId: number) {
    const user = await this.usersRepository.findOne({ 
      where: { user_id: userId },
      relations: ['tutor_profile', 'student_profile']
    });
    if (!user) return { success: true, data: [] };
    let isTutor = false;
    if ((user as any).user_type) {
      isTutor = ((user as any).user_type === 'tutor');
    } else {
      isTutor = !!user.tutor_profile;
    }
    console.log(`getUpcomingSessionsList: user_id=${userId}, resolved isTutor=${isTutor}, user_type=${(user as any).user_type}`);
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thirtyDaysFromNow = new Date(startOfDay.getTime() + 30 * 24 * 60 * 60 * 1000);
  const endOfThirtyDays = new Date(thirtyDaysFromNow);
  endOfThirtyDays.setHours(23, 59, 59, 999);
  const statuses: any[] = ['upcoming'];

    let bookings: BookingRequest[] = [];
    if (isTutor) {
      const tutor = await this.tutorRepository.findOne({ where: { user: { user_id: userId } }, relations: ['user'] } as any);
      console.log(`getUpcomingSessionsList: tutor lookup result for user_id=${userId}:`, !!tutor ? `tutor_id=${(tutor as any).tutor_id}` : 'no tutor');
      if (tutor) {
        bookings = await this.bookingRequestRepository.find({
          where: {
            tutor: { tutor_id: (tutor as any).tutor_id } as any,
            status: In(statuses) as any,
            date: Between(startOfDay, endOfThirtyDays) as any
          } as any,
          relations: ['tutor', 'tutor.user', 'student'],
          order: { date: 'ASC' }
        });
        console.log(`getUpcomingSessionsList: found ${bookings.length} upcoming bookings for tutor_id=${(tutor as any).tutor_id}`);
      }
    } else {
      bookings = await this.bookingRequestRepository.find({
        where: {
          student: { user_id: userId } as any,
          status: In(statuses) as any,
          date: Between(startOfDay, endOfThirtyDays) as any
        } as any,
        relations: ['tutor', 'tutor.user', 'student'],
        order: { date: 'ASC' }
      });
      console.log(`getUpcomingSessionsList: found ${bookings.length} upcoming bookings for student user_id=${userId}`);
    }

    const data = bookings.map((b: any) => ({
      id: b.id,
      subject: b.subject,
      date: b.date,
      time: b.time,
      duration: b.duration,
      status: b.status,
      created_at: b.created_at,
      tutor_name: b.tutor?.user?.name,
      student_name: b.student?.name
    }));

    return { success: true, data };
  }

  async markNotificationAsRead(notificationId: number) {
    await this.notificationRepository.update(notificationId, { read: true });
    return { success: true };
  }

  async markAllNotificationsAsRead(userId: number) {
    const user = await this.usersRepository.findOne({ 
      where: { user_id: userId },
      relations: ['tutor_profile', 'student_profile']
    });
    
    if (!user) {
      return { success: true };
    }
    let userType: 'tutor' | 'tutee' | 'admin' = (user as any).user_type as any;
    if (!userType) {
      userType = user.tutor_profile ? 'tutor' : (user.student_profile ? 'tutee' : 'admin');
    } else if ((userType as any) === 'student') {
      userType = 'tutee';
    }

    await this.notificationRepository.update(
      { receiver_id: userId, userType: userType as any },
      { read: true }
    );
    return { success: true };
  }

  async markBookingFinished(bookingId: number): Promise<{ success: boolean }> {
    const booking = await this.bookingRequestRepository.findOne({ where: { id: bookingId } });

    if (!booking) {
      throw new BadRequestException('Booking not found');
    }

    if (booking.status !== 'upcoming') {
      throw new BadRequestException('Only upcoming bookings can be marked as finished');
    }

    booking.status = 'completed';
    booking.tutor_marked_done_at = new Date();

    await this.bookingRequestRepository.save(booking);

    return { success: true };
  }
}
