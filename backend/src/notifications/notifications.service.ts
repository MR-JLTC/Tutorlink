import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Notification } from '../database/entities/notification.entity';

interface CreateNotificationDto {
  userId: string;
  userType: 'tutor' | 'tutee';
  sessionId: number;
  message: string;
  sessionDate: Date;
  subjectName: string;
  receiverId?: number;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  // 🔔 Get upcoming session notifications
  async getUpcomingSessionNotifications(userId: string | number, userType: 'tutor' | 'tutee') {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysFromNow = new Date(startOfDay);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const receiver = typeof userId === 'string' ? Number(userId) : userId;
    return await this.notificationRepository.find({
      where: {
        receiver_id: receiver,
        userType: userType,
        sessionDate: Between(startOfDay, thirtyDaysFromNow),
      },
      order: {
        sessionDate: 'ASC',
      },
    });
  }

  // General notifications fetch for a given receiver and role
  async getNotifications(userId: number, role: 'tutor' | 'tutee' | 'admin') {
    // Include booking relations for tutor/tutee to allow richer frontend display
    const relations = role === 'admin' ? [] : ['booking', 'booking.tutor', 'booking.tutor.user', 'booking.student'];
    return await this.notificationRepository.find({
      where: { receiver_id: userId, userType: role },
      relations,
      order: { timestamp: 'DESC' },
      take: 50
    });
  }

  // ✅ Mark a single notification as read
  async markNotificationAsRead(notificationId: number) {
    return await this.notificationRepository.update(notificationId, { read: true });
  }

  // ✅ Mark all notifications for a user as read
  async markAllAsRead(userId: string | number) {
    const receiver = typeof userId === 'string' ? Number(userId) : userId;
    return await this.notificationRepository.update({ receiver_id: receiver }, { read: true });
  }

  // ✅ Delete a specific notification
  async deleteNotification(notificationId: number) {
    return await this.notificationRepository.delete(notificationId);
  }

  // ✅ Create a new notification
  async createNotification(data: CreateNotificationDto) {
    return await this.notificationRepository.save({
      userId: data.userId,
      userType: data.userType,
      session: { session_id: data.sessionId },
      message: data.message,
      timestamp: new Date(),
      read: false,
      sessionDate: data.sessionDate,
      subjectName: data.subjectName,
      receiver_id: data.receiverId ?? (data.userId ? Number(data.userId) : undefined),
    });
  }
}
