import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reschedule } from '../database/entities/reschedule.entity';
import { BookingRequest } from '../database/entities/booking-request.entity';
import { User } from '../database/entities/user.entity';
import { Notification } from '../database/entities/notification.entity';
import { CreateRescheduleDto } from './dto/create-reschedule.dto';

@Injectable()
export class ReschedulesService {
  constructor(
    @InjectRepository(Reschedule) private rescheduleRepo: Repository<Reschedule>,
    @InjectRepository(BookingRequest) private bookingRepo: Repository<BookingRequest>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Notification) private notificationRepo: Repository<Notification>,
  ) {}

  async propose(userId: number, dto: CreateRescheduleDto) {
    const booking = await this.bookingRepo.findOne({ where: { id: dto.booking_id }, relations: ['student', 'tutor', 'tutor.user'] });
    if (!booking) throw new NotFoundException('Booking not found');

    // Ensure proposer is part of the booking
    const isStudent = booking.student?.user_id === userId;
    const isTutor = (booking.tutor?.user as any)?.user_id === userId || (booking.tutor && booking.tutor.user && (booking.tutor.user as any).user_id === userId);
    if (!isStudent && !isTutor) throw new ForbiddenException('You are not a participant of this booking');

    const receiverUserId = isStudent ? (booking.tutor?.user as any)?.user_id : booking.student?.user_id;
    if (!receiverUserId) throw new BadRequestException('Could not determine receiver user id');

    const proposer = await this.userRepo.findOne({ where: { user_id: userId } });

    // Record original booking values so we can revert if needed
    const originalDate = booking.date;
    const originalTime = booking.time;
    const originalDuration = booking.duration;

    // Immediately apply the proposed date/time/duration to the booking
    booking.date = new Date(dto.proposedDate);
    booking.time = dto.proposedTime;
    if (dto.proposedDuration) booking.duration = dto.proposedDuration;
    await this.bookingRepo.save(booking as any);

    const res = this.rescheduleRepo.create({
      booking: booking as any,
      proposer_user_id: userId,
      proposer: proposer || undefined,
      proposedDate: new Date(dto.proposedDate),
      proposedTime: dto.proposedTime,
      proposedDuration: dto.proposedDuration,
      reason: dto.reason,
      receiver_user_id: receiverUserId,
      status: 'pending',
      originalDate: originalDate,
      originalTime: originalTime,
      originalDuration: originalDuration,
    });

    const saved = await this.rescheduleRepo.save(res);

    // create notification for receiver (inform them there's a proposed change already applied)
    const receiver = await this.userRepo.findOne({ where: { user_id: receiverUserId } });
    const subjectName = booking.subject || 'Session';
    const proposerName = proposer?.name || 'Someone';
    const message = `${proposerName} proposed rescheduling ${subjectName} to ${dto.proposedDate} ${dto.proposedTime}${dto.reason ? ` — ${dto.reason}` : ''}`;

    const userType = isStudent ? 'tutor' : 'tutee';

    await this.notificationRepo.save(this.notificationRepo.create({
      userId: receiverUserId.toString(),
      receiver_id: receiverUserId,
      userType: userType as any,
      booking: booking as any,
      message,
      sessionDate: booking.date,
      subjectName,
      read: false,
    } as any));

    // Debug log: show reschedule and notification info so we can trace delivery
    try {
      console.log('Reschedule proposal saved:', { rescheduleId: saved.reschedule_id, bookingId: dto.booking_id, proposer: userId, receiver: receiverUserId });
      console.log('Reschedule notification created for receiver:', { receiver_id: receiverUserId, userType, message });
    } catch (err) {
      console.error('Failed to log reschedule debug info', err);
    }

    return { success: true, data: saved };
  }

  async listByBooking(bookingId: number) {
    return this.rescheduleRepo.find({ where: { booking: { id: bookingId } }, relations: ['proposer', 'booking'] });
  }

  async findById(id: number) {
    return this.rescheduleRepo.findOne({ where: { reschedule_id: id }, relations: ['proposer', 'booking', 'booking.student', 'booking.tutor', 'booking.tutor.user'] });
  }

  async accept(userId: number, rescheduleId: number) {
    const res = await this.findById(rescheduleId);
    if (!res) throw new NotFoundException('Reschedule proposal not found');
    if (res.status !== 'pending') throw new BadRequestException('Reschedule is not pending');

    // Only receiver may accept
    if (res.receiver_user_id !== userId) throw new ForbiddenException('Only the receiver can accept this proposal');


    // Booking was already updated at proposal time. Accept simply confirms the proposal.
    res.status = 'accepted';
    await this.rescheduleRepo.save(res as any);

    // Notify proposer that receiver accepted
    const proposerUser = await this.userRepo.findOne({ where: { user_id: res.proposer_user_id } });
    const receiverUser = await this.userRepo.findOne({ where: { user_id: userId } });
    const booking = await this.bookingRepo.findOne({ where: { id: res.booking.id } });
    const subjectName = booking?.subject || 'Session';
    const message = `${receiverUser?.name || 'User'} accepted the reschedule to ${res.proposedDate.toISOString().split('T')[0]} ${res.proposedTime}`;

    await this.notificationRepo.save(this.notificationRepo.create({
      userId: res.proposer_user_id.toString(),
      receiver_id: res.proposer_user_id,
      userType: 'tutee' as any,
      booking: booking as any,
      message,
      sessionDate: booking?.date,
      subjectName,
      read: false,
    } as any));

    return { success: true, data: res };
  }

  async reject(userId: number, rescheduleId: number) {
    const res = await this.findById(rescheduleId);
    if (!res) throw new NotFoundException('Reschedule proposal not found');
    if (res.status !== 'pending') throw new BadRequestException('Reschedule is not pending');

    // Only receiver may reject
    if (res.receiver_user_id !== userId) throw new ForbiddenException('Only the receiver can reject this proposal');

    // Revert booking to original values if available
    const booking = await this.bookingRepo.findOne({ where: { id: res.booking.id } });
    if (booking && (res.originalDate || res.originalTime || res.originalDuration)) {
      if (res.originalDate) booking.date = res.originalDate;
      if (res.originalTime) booking.time = res.originalTime;
      if (res.originalDuration) booking.duration = res.originalDuration;
      await this.bookingRepo.save(booking as any);
    }

    res.status = 'rejected';
    await this.rescheduleRepo.save(res as any);

    // Notify proposer that the proposal was rejected and booking reverted
    const proposerUser = await this.userRepo.findOne({ where: { user_id: res.proposer_user_id } });
    const receiverUser = await this.userRepo.findOne({ where: { user_id: userId } });
    const subjectName = booking?.subject || 'Session';
    const message = `${receiverUser?.name || 'User'} rejected the reschedule proposal`;

    await this.notificationRepo.save(this.notificationRepo.create({
      userId: res.proposer_user_id.toString(),
      receiver_id: res.proposer_user_id,
      userType: 'tutee' as any,
      booking: booking as any,
      message,
      sessionDate: booking?.date,
      subjectName,
      read: false,
    } as any));

    return { success: true };
  }

  async cancel(userId: number, rescheduleId: number) {
    const res = await this.findById(rescheduleId);
    if (!res) throw new NotFoundException('Reschedule proposal not found');
    if (res.status !== 'pending') throw new BadRequestException('Only pending proposals can be cancelled');

    if (res.proposer_user_id !== userId) throw new ForbiddenException('Only the proposer can cancel this proposal');

    res.status = 'cancelled';
    await this.rescheduleRepo.save(res as any);

    // Notify receiver
    const receiverUser = await this.userRepo.findOne({ where: { user_id: res.receiver_user_id } });
    const booking = await this.bookingRepo.findOne({ where: { id: res.booking.id } });
    const message = `${res.proposer?.name || 'User'} cancelled the reschedule proposal`;

    await this.notificationRepo.save(this.notificationRepo.create({
      userId: res.receiver_user_id?.toString() || '',
      receiver_id: res.receiver_user_id,
      userType: 'tutor' as any,
      booking: booking as any,
      message,
      sessionDate: booking?.date,
      subjectName: booking?.subject || 'Session',
      read: false,
    } as any));

    return { success: true };
  }
}
