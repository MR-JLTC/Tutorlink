import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from '../database/entities';
import { BookingRequest, Tutor, User, Student, Notification } from '../database/entities';
import { UpdatePaymentDisputeDto } from './payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private paymentsRepository: Repository<Payment>,
    @InjectRepository(BookingRequest)
    private bookingRepository: Repository<BookingRequest>,
    @InjectRepository(Tutor)
    private tutorsRepository: Repository<Tutor>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Student)
    private studentsRepository: Repository<Student>,
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
  ) {}

  findAll(): Promise<Payment[]> {
    return this.paymentsRepository.find({
      relations: ['student', 'student.user', 'tutor', 'tutor.user', 'bookingRequest'],
      order: {
        created_at: 'DESC',
      },
    });
  }

  // Get completed bookings waiting for admin payment
  async getCompletedBookingsWaitingForPayment() {
    try {
      // Find bookings that are completed and both tutor and tutee have confirmed
      const completedBookings = await this.bookingRepository.find({
        where: {
          status: 'completed' as any,
        },
        relations: ['tutor', 'tutor.user', 'student'], // student is already a User entity
      });

      // Filter to only those where both tutor and tutee have marked done
      const bothConfirmed = completedBookings.filter((booking: any) => {
        return booking.tutor_marked_done_at && booking.tutee_marked_done_at;
      });

      // Check which ones don't have an admin_confirmed payment yet
      const waitingForPayment = [];
      for (const booking of bothConfirmed) {
        try {
          // Skip if booking doesn't have required relations
          if (!booking.tutor || !booking.student) {
            console.warn(`Skipping booking ${booking.id}: missing tutor or student relation`);
            continue;
          }

          const existingPayment = await this.paymentsRepository.findOne({
            where: {
              booking_request_id: booking.id,
              status: 'admin_confirmed' as any,
            } as any,
          });

          if (!existingPayment) {
            // Get tutor_id safely
            const tutorId = (booking.tutor as any)?.tutor_id;
            if (!tutorId) {
              console.warn(`Skipping booking ${booking.id}: missing tutor_id`);
              continue;
            }

            // Calculate amount: session_rate * duration
            const tutor = await this.tutorsRepository.findOne({
              where: { tutor_id: tutorId },
              relations: ['user'],
            });

            if (!tutor) {
              console.warn(`Skipping booking ${booking.id}: tutor not found`);
              continue;
            }

            const sessionRate = Number((tutor as any)?.session_rate_per_hour || 0);
            const duration = Number(booking.duration || 0);
            const amount = sessionRate * duration;

            const tutorUser = (tutor as any)?.user;
            // booking.student is a User entity, not a Student entity
            const studentUser = booking.student as any;

            waitingForPayment.push({
              booking_id: booking.id,
              tutor: {
                tutor_id: tutorId,
                name: tutorUser?.name || 'Unknown',
                gcash_number: (tutor as any)?.gcash_number || null,
                gcash_qr_url: (tutor as any)?.gcash_qr_url || null,
                session_rate_per_hour: sessionRate,
              },
              student: {
                user_id: studentUser?.user_id || null,
                name: studentUser?.name || 'Unknown',
              },
              subject: booking.subject || null,
              date: booking.date || null,
              time: booking.time || null,
              duration: duration,
              session_proof_url: booking.session_proof_url || null,
              tutee_rating: booking.tutee_rating || null,
              tutee_comment: booking.tutee_comment || null,
              amount: amount,
              calculated_amount: amount * 0.87, // After 13% deduction
            });
          }
        } catch (error) {
          console.error(`Error processing booking ${booking.id}:`, error);
          // Continue with next booking instead of failing entire request
          continue;
        }
      }

      return waitingForPayment;
    } catch (error) {
      console.error('Error in getCompletedBookingsWaitingForPayment:', error);
      throw error;
    }
  }

  // Process admin payment for a completed booking
  async processAdminPayment(bookingId: number) {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
      relations: ['tutor', 'tutor.user', 'student'],
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status !== 'completed') {
      throw new BadRequestException('Booking is not completed');
    }

    if (!(booking as any).tutor_marked_done_at || !(booking as any).tutee_marked_done_at) {
      throw new BadRequestException('Both tutor and tutee must have confirmed the session');
    }

    // Check if payment already exists
    let payment = await this.paymentsRepository.findOne({
      where: {
        booking_request_id: bookingId,
      } as any,
    });

    // Calculate amount
    const tutor = await this.tutorsRepository.findOne({
      where: { tutor_id: (booking.tutor as any).tutor_id },
    });
    const sessionRate = (tutor as any)?.session_rate_per_hour || 0;
    const amount = Number(sessionRate) * Number(booking.duration || 0);

    // Get or create student entity
    const studentUser = await this.usersRepository.findOne({
      where: { user_id: (booking.student as any).user_id },
    });
    if (!studentUser) throw new NotFoundException('Student user not found');

    let student = await this.studentsRepository.findOne({
      where: { user: { user_id: studentUser.user_id } },
      relations: ['user'],
    } as any);

    if (!student) {
      const newStudent = this.studentsRepository.create({ user: studentUser } as any);
      const savedStudent = await this.studentsRepository.save(newStudent);
      student = Array.isArray(savedStudent) ? savedStudent[0] : savedStudent;
    }

    if (payment) {
      // Update existing payment
      (payment as any).status = 'admin_confirmed';
      (payment as any).amount = amount;
      await this.paymentsRepository.save(payment as any);
    } else {
      // Create new payment
      const newPayment = this.paymentsRepository.create({
        student_id: student.student_id,
        tutor_id: (booking.tutor as any).tutor_id,
        booking_request_id: bookingId,
        amount: amount,
        status: 'admin_confirmed',
        dispute_status: 'none',
        subject: booking.subject,
        sender: 'admin',
        admin_note: 'Payment processed by admin for completed session',
      } as any);
      payment = await this.paymentsRepository.save(newPayment as any);
    }

    return { success: true, payment };
  }

  async updateDispute(id: number, dto: UpdatePaymentDisputeDto): Promise<Payment> {
    const payment = await this.paymentsRepository.findOne({ where: { payment_id: id } });
    if (!payment) {
      throw new Error('Payment not found');
    }
    (payment as any).dispute_status = dto.dispute_status;
    (payment as any).admin_note = dto.admin_note ?? null;
    return this.paymentsRepository.save(payment);
  }

  async submitProof(bookingId: number, adminId: number, amount: number, file: any) {
    if (!file) throw new BadRequestException('No file uploaded');
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
      relations: ['tutor', 'student']
    } as any);
    if (!booking) throw new NotFoundException('Booking not found');
    const tutor = await this.tutorsRepository.findOne({ where: { tutor_id: (booking as any).tutor?.tutor_id }, relations: ['user'] });
    const studentUser = await this.usersRepository.findOne({ where: { user_id: (booking as any).student?.user_id } });
    if (!tutor || !studentUser) throw new BadRequestException('Invalid booking parties');

    // Find or create the Student record for this user
    // Payment entity requires student_id (from students table), not user_id
    let student = await this.studentsRepository.findOne({
      where: { user: { user_id: studentUser.user_id } },
      relations: ['user']
    } as any);
    
    if (!student) {
      // Create a Student record if it doesn't exist
      // The Student entity has a OneToOne relationship with User via user_id
      const newStudent = this.studentsRepository.create({
        user: studentUser
      } as any);
      const savedStudent = await this.studentsRepository.save(newStudent);
      student = Array.isArray(savedStudent) ? savedStudent[0] : savedStudent;
      console.log(`submitProof: Created new Student record with student_id=${(student as any).student_id} for user_id=${studentUser.user_id}`);
    }

    const fileUrl = `/tutor_documents/${file.filename}`;
    
    // Check if a payment already exists for this booking with sender='tutee'
    const existingPayment = await this.paymentsRepository.findOne({
      where: {
        booking_request_id: bookingId,
        sender: 'tutee',
      } as any,
    });

    let saved;
    let savedId;

    if (existingPayment) {
      // Update existing payment if it exists
      existingPayment.amount = Number(amount);
      existingPayment.dispute_proof_url = fileUrl;
      existingPayment.subject = (booking as any).subject || null;
      existingPayment.admin_note = `admin_id:${adminId}`;
      existingPayment.status = 'pending';
      saved = await this.paymentsRepository.save(existingPayment as any);
      savedId = (saved as any).payment_id;
      console.log(`submitProof: Updated existing payment with payment_id=${savedId}`);
    } else {
      // Create new payment record if it doesn't exist
      const payment = this.paymentsRepository.create({
        student_id: student.student_id,
        tutor_id: tutor.tutor_id as any,
        booking_request_id: bookingId,
        amount: Number(amount),
        status: 'pending',
        dispute_status: 'none',
        dispute_proof_url: fileUrl,
        subject: (booking as any).subject || null,
        admin_note: `admin_id:${adminId}`,
        sender: 'tutee',
      } as any);
      saved = await this.paymentsRepository.save(payment as any);
      savedId = (saved as any).payment_id;
      console.log(`submitProof: Created payment with payment_id=${savedId}, student_id=${student.student_id}, tutor_id=${tutor.tutor_id}`);
    }
    console.log(`submitProof: Created payment with payment_id=${savedId}, student_id=${student.student_id}, tutor_id=${tutor.tutor_id}`);

    // Update the related booking to reflect payment submission
    (booking as any).payment_proof = fileUrl;
    (booking as any).status = 'payment_pending';
    await this.bookingRepository.save(booking as any);
    console.log(`submitProof: Updated booking_id=${(booking as any).id} to status=payment_pending`);

    // Notify admins that a new payment proof was submitted
    try {
      const admins = await this.usersRepository.find({ where: { user_type: 'admin' } as any });
      // Prefer the booking's student name (should be the tutee) to avoid accidental mix-ups
      const studentName = (booking as any)?.student?.name || studentUser?.name || 'Student';

      const notifications = admins.map((admin: any) =>
        this.notificationRepository.create({
          userId: String(admin.user_id),
          receiver_id: admin.user_id,
          userType: 'admin',
          message: `New payment proof submitted by ${studentName} for ${booking.subject}.`,
          timestamp: new Date(),
          read: false,
          sessionDate: new Date(),
          subjectName: 'Payment Submission'
        })
      );
      if (notifications.length) {
        await this.notificationRepository.save(notifications as any);
        console.log(`submitProof: Notified ${notifications.length} admin(s) of new payment proof`);
      }
      // Additionally, create a summary notification for admins about pending/unreviewed payments
      try {
        const pendingCount = await this.paymentsRepository.count({ where: { status: 'pending' } as any });
        for (const admin of admins) {
          const existing = await this.notificationRepository.findOne({ where: { receiver_id: admin.user_id, subjectName: 'Unreviewed Payments', read: false } as any });
          if (!existing) {
            const summary = this.notificationRepository.create({
              userId: String(admin.user_id),
              receiver_id: admin.user_id,
              userType: 'admin',
              message: `There are currently ${pendingCount} unreviewed payment proof(s) awaiting review.`,
              timestamp: new Date(),
              read: false,
              sessionDate: new Date(),
              subjectName: 'Unreviewed Payments'
            } as any);
            await this.notificationRepository.save(summary as any);
            console.log(`submitProof: Created unreviewed payments summary notification for admin user_id=${admin.user_id}`);
          }
        }
      } catch (e) {
        console.warn('submitProof: Failed to create unreviewed payments summary notifications', e);
      }
    } catch (e) {
      console.warn('submitProof: Failed to notify admins of payment submission', e);
    }

    return { success: true, payment_id: savedId, booking_id: (booking as any).id };
  }

  async verifyPayment(id: number, status: 'confirmed' | 'rejected', adminProofFile?: any, rejectionReason?: string) {
    const payment = await this.paymentsRepository.findOne({ 
      where: { payment_id: id },
      relations: ['tutor', 'tutor.user', 'student', 'student.user', 'bookingRequest']
    });
    if (!payment) throw new NotFoundException('Payment not found');
    // Admin verification now becomes a two-step flow:
    // - Admin approval sets payment.status = 'admin_confirmed' and may attach an admin proof URL.
    // - The tutor must then view that admin proof and call the tutor-confirm endpoint to finalize (status -> 'confirmed' and booking -> 'upcoming').
    if (status === 'confirmed') {
      (payment as any).status = 'confirmed';
    } else {
      (payment as any).status = 'rejected';
    }

    // If admin proof is provided, save it
    if (adminProofFile && status === 'confirmed') {
      const fileUrl = `/tutor_documents/${adminProofFile.filename}`;
      (payment as any).admin_payment_proof_url = fileUrl;
      console.log(`verifyPayment: Admin proof uploaded: ${fileUrl}`);
    }

    // If rejection reason is provided, save it
    if (status === 'rejected' && rejectionReason) {
      (payment as any).rejection_reason = rejectionReason;
      console.log(`verifyPayment: Rejection reason saved: ${rejectionReason}`);
    }

    await this.paymentsRepository.save(payment);

    // If there are no more pending payments, mark any 'Unreviewed Payments' summary notifications as read
    try {
      const pendingNow = await this.paymentsRepository.count({ where: { status: 'pending' } as any });
      if (pendingNow === 0) {
        await this.notificationRepository.update({ subjectName: 'Unreviewed Payments' } as any, { read: true } as any);
        console.log('verifyPayment: No pending payments remain - marked Unreviewed Payments notifications as read');
      }
    } catch (e) {
      console.warn('verifyPayment: Failed to update Unreviewed Payments summary notifications', e);
    }
    // Update the booking to 'upcoming' immediately after admin confirmation
    // Only update the specific booking request associated with this payment
    if (status === 'confirmed') {
      try {
        const bookingRequestId = (payment as any)?.booking_request_id;
        if (bookingRequestId) {
          const booking = await this.bookingRepository.findOne({
            where: { id: bookingRequestId } as any,
            relations: ['tutor', 'student']
          });
          if (booking) {
            (booking as any).status = 'upcoming';
            await this.bookingRepository.save(booking as any);
            console.log(`verifyPayment: Updated booking_id=${bookingRequestId} to status=upcoming`);
          } else {
            console.warn(`verifyPayment: No booking found with id=${bookingRequestId} associated with payment_id=${id}`);
          }
        } else {
          console.warn(`verifyPayment: Payment ${id} has no booking_request_id, cannot update booking status`);
        }
      } catch (err) {
        console.error('verifyPayment: Failed to update related booking status', err);
      }
    }

    // Get payment details for notifications
    const amount = (payment as any).amount;
    const studentUserId = ((payment as any).student?.user as any)?.user_id;
    const tutorUserId = ((payment as any).tutor?.user as any)?.user_id;
    const studentName = ((payment as any).student?.user as any)?.name || 'Student';
    const tutorName = ((payment as any).tutor?.user as any)?.name || 'Tutor';
    const subject = (payment as any).subject || 'session';

    // Notify the tutee (student) about the payment decision
    if (studentUserId) {
      try {
        let tuteeMessage = '';
        let tuteeSubjectName = '';

        if (status === 'confirmed') {
          tuteeMessage = `Your payment of ₱${Number(amount).toFixed(2)} for ${subject} with ${tutorName} has been approved by the admin. Your session is now confirmed and upcoming.`;
          tuteeSubjectName = 'Payment Approved by Admin';
        } else if (status === 'rejected') {
          const reasonText = rejectionReason ? ` Reason: ${rejectionReason}` : '';
          tuteeMessage = `Your payment of ₱${Number(amount).toFixed(2)} for ${subject} with ${tutorName} has been rejected by the admin.${reasonText} Please check your payment proof and resubmit if needed.`;
          tuteeSubjectName = 'Payment Rejected';
        }

        if (tuteeMessage) {
          // Try to find associated booking for session date
          let sessionDate = new Date();
          try {
            const booking = await this.bookingRepository.findOne({
              where: {
                student: { user_id: studentUserId } as any,
                tutor: { tutor_id: (payment as any).tutor_id } as any,
                status: 'payment_pending' as any
              } as any,
              order: { created_at: 'DESC' }
            });
            if (booking && (booking as any).date) {
              sessionDate = new Date((booking as any).date);
            }
          } catch (e) {
            console.warn('verifyPayment: Could not find booking for session date, using current date');
          }

          const tuteeNotification = this.notificationRepository.create({
            userId: studentUserId.toString(),
            receiver_id: studentUserId,
            userType: 'tutee',
            message: tuteeMessage,
            timestamp: new Date(),
            read: false,
            sessionDate: sessionDate,
            subjectName: tuteeSubjectName
          });
          await this.notificationRepository.save(tuteeNotification);
          console.log(`verifyPayment: Sent notification to tutee user_id=${studentUserId} for payment ${status}`);
        }
      } catch (e) {
        console.error('verifyPayment: Failed to create notification for tutee', e);
      }
    }

    return { success: true };
  }

  async confirmByTutor(id: number, tutorUserId: number) {
    const payment = await this.paymentsRepository.findOne({ 
      where: { payment_id: id },
      relations: ['tutor', 'tutor.user', 'student', 'student.user']
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const linkedTutorUserId = (payment as any)?.tutor?.user?.user_id;
    if (!linkedTutorUserId || linkedTutorUserId !== tutorUserId) {
      throw new ForbiddenException('You are not authorized to confirm this payment');
    }

    // Finalize the payment and update booking to upcoming
    (payment as any).status = 'confirmed';
    await this.paymentsRepository.save(payment as any);

    // Update the most relevant booking for this student-tutor pair
    try {
      const studentUserId = (payment as any)?.student?.user?.user_id;
      const tutorId = (payment as any)?.tutor_id;
      if (studentUserId && tutorId) {
        const booking = await this.bookingRepository.findOne({
          where: {
            student: { user_id: studentUserId } as any,
            tutor: { tutor_id: tutorId } as any,
            status: 'payment_pending' as any
          } as any,
          order: { created_at: 'DESC' },
          relations: ['tutor', 'student']
        });

        // Fallback to awaiting_payment
        let targetBooking = booking;
        if (!targetBooking) {
          targetBooking = await this.bookingRepository.findOne({
            where: {
              student: { user_id: studentUserId } as any,
              tutor: { tutor_id: tutorId } as any,
              status: 'awaiting_payment' as any
            } as any,
            order: { created_at: 'DESC' },
            relations: ['tutor', 'student']
          });
        }

        if (targetBooking) {
          (targetBooking as any).status = 'upcoming';
          await this.bookingRepository.save(targetBooking as any);
          console.log(`confirmByTutor: Updated booking_id=${(targetBooking as any).id} to status=upcoming`);
        } else {
          console.warn(`confirmByTutor: No matching booking found to update for tutor_id=${tutorId}, student_user_id=${studentUserId}`);
        }
      }
    } catch (err) {
      console.error('confirmByTutor: Failed to update related booking status', err);
    }

    // Notify the student that the payment has been confirmed by tutor
    try {
      const studentUserId = ((payment as any).student?.user as any)?.user_id;
      if (studentUserId) {
        const notification = this.notificationRepository.create({
          userId: String(studentUserId),
          receiver_id: studentUserId,
          userType: 'tutee',
          message: `Your payment of $${Number((payment as any).amount).toFixed(2)} has been confirmed by the tutor.`,
          timestamp: new Date(),
          read: false,
          sessionDate: new Date(),
          subjectName: 'Payment Confirmed'
        });
        await this.notificationRepository.save(notification as any);
      }
    } catch (e) {
      console.warn('confirmByTutor: Failed to notify student', e);
    }

    return { success: true };
  }

  // Tutor requests payment for a completed/overdue session
  async requestPayment(bookingId: number, tutorId: number, amount: number, subject?: string) {
    try {
      // Find the booking
      const booking = await this.bookingRepository.findOne({
        where: { id: bookingId },
        relations: ['student', 'tutor']
      } as any);
      if (!booking) throw new NotFoundException('Booking not found');

      // Find the tutor
      const tutor = await this.tutorsRepository.findOne({ where: { tutor_id: tutorId }, relations: ['user'] });
      if (!tutor) throw new NotFoundException('Tutor not found');

      // Find the student user and student entity
      const studentUser = await this.usersRepository.findOne({ where: { user_id: (booking as any).student?.user_id } });
      if (!studentUser) throw new NotFoundException('Student user not found');
      let student = await this.studentsRepository.findOne({ where: { user: { user_id: studentUser.user_id } }, relations: ['user'] } as any);
      if (!student) {
        const newStudent = this.studentsRepository.create({ user: studentUser } as any);
        const savedStudent = await this.studentsRepository.save(newStudent);
        student = Array.isArray(savedStudent) ? savedStudent[0] : savedStudent;
      }

      // Check if a payment already exists for this booking with the same sender
      const bookingSubject = subject || (booking as any).subject || null;
      const existingPayment = await this.paymentsRepository.findOne({
        where: {
          booking_request_id: bookingId,
          sender: 'admin',
        } as any,
      });

      let saved;
      let savedId;

      if (existingPayment) {
        // Update existing payment if it exists
        existingPayment.amount = Number(amount);
        existingPayment.subject = bookingSubject;
        existingPayment.admin_note = `Requested by tutor_id:${tutorId}`;
        saved = await this.paymentsRepository.save(existingPayment as any);
        savedId = (saved as any).payment_id;
      } else {
        // Create new payment record if it doesn't exist
        const payment = this.paymentsRepository.create({
          student_id: student.student_id,
          tutor_id: tutor.tutor_id,
          booking_request_id: bookingId,
          amount: Number(amount),
          status: 'pending',
          dispute_status: 'none',
          subject: bookingSubject,
          admin_note: `Requested by tutor_id:${tutorId}`,
          sender: 'admin',
        } as any);
        saved = await this.paymentsRepository.save(payment as any);
        savedId = (saved as any).payment_id;
      }

      // Update booking status to payment_pending
      (booking as any).status = 'payment_pending';
      await this.bookingRepository.save(booking as any);

      // Notify admins
      try {
        const admins = await this.usersRepository.find({ where: { user_type: 'admin' } as any });
        const tutorName = tutor.user?.name || 'Tutor';
        const notifications = admins.map((admin: any) =>
          this.notificationRepository.create({
            userId: String(admin.user_id),
            receiver_id: admin.user_id,
            userType: 'admin',
            message: `Payment request submitted by ${tutorName} for session ${subject || (booking as any).subject || ''}.`,
            timestamp: new Date(),
            read: false,
            sessionDate: new Date(),
            subjectName: 'Payment Request'
          })
        );
        if (notifications.length) {
          await this.notificationRepository.save(notifications as any);
        }
      } catch (e) {
        console.warn('requestPayment: Failed to notify admins', e);
      }

      return { success: true, payment_id: savedId, booking_id: (booking as any).id };
    } catch (error) {
      console.error('requestPayment: Error occurred', error);
      throw error;
    }
  }
}
