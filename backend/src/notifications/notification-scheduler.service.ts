import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { Session } from '../database/entities/session.entity';
import { NotificationsService } from './notifications.service';
import { Cron, CronExpression } from '@nestjs/schedule';

interface NotificationSchedule {
  days?: number;
  hours?: number;
  minutes?: number;
}

@Injectable()
export class NotificationSchedulerService implements OnModuleInit {
  private readonly schedules: NotificationSchedule[] = [
    { days: 3 },    // 3 days before
    { days: 2 },    // 2 days before
    { days: 1 },    // 1 day before
    { hours: 12 },  // 12 hours before
    { hours: 6 },   // 6 hours before
    { hours: 1 },   // 1 hour before
    { minutes: 30 } // 30 minutes before
  ];

  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    private readonly notificationsService: NotificationsService
  ) {}

  async onModuleInit() {
    // Initial check when service starts
    await this.checkUpcomingSessions();
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkUpcomingSessions() {
    const now = new Date();
    
    // Get all upcoming scheduled sessions
    const sessions = await this.sessionRepository.find({
      where: {
        status: 'scheduled',
        start_time: MoreThanOrEqual(now)
      },
      relations: ['tutor', 'student', 'subject']
    });

    for (const session of sessions) {
      const sessionStartTime = new Date(session.start_time);
      
      // Check each schedule point
      for (const schedule of this.schedules) {
        const notificationTime = this.calculateNotificationTime(sessionStartTime, schedule);
        
        // If it's time to send notification (within the last 5 minutes)
        if (this.shouldSendNotification(now, notificationTime)) {
          // Send notification to tutor (set explicit numeric receiverId)
          await this.notificationsService.createNotification({
            userId: session.tutor.user.user_id.toString(),
            userType: 'tutor',
            sessionId: session.session_id,
            message: this.generateNotificationMessage(schedule, session.subject.subject_name),
            sessionDate: session.start_time,
            subjectName: session.subject.subject_name,
            receiverId: session.tutor.user.user_id
          });

          // Send notification to tutee (set explicit numeric receiverId)
          await this.notificationsService.createNotification({
            userId: session.student.user.user_id.toString(),
            userType: 'tutee',
            sessionId: session.session_id,
            message: this.generateNotificationMessage(schedule, session.subject.subject_name),
            sessionDate: session.start_time,
            subjectName: session.subject.subject_name,
            receiverId: session.student.user.user_id
          });
        }
      }
    }
  }

  private calculateNotificationTime(sessionTime: Date, schedule: NotificationSchedule): Date {
    const notificationTime = new Date(sessionTime);
    
    if (schedule.days) {
      notificationTime.setDate(notificationTime.getDate() - schedule.days);
    }
    if (schedule.hours) {
      notificationTime.setHours(notificationTime.getHours() - schedule.hours);
    }
    if (schedule.minutes) {
      notificationTime.setMinutes(notificationTime.getMinutes() - schedule.minutes);
    }
    
    return notificationTime;
  }

  private shouldSendNotification(now: Date, notificationTime: Date): boolean {
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    return notificationTime >= fiveMinutesAgo && notificationTime <= now;
  }

  private generateNotificationMessage(schedule: NotificationSchedule, subjectName: string): string {
    if (schedule.days) {
      return `Upcoming ${subjectName} session in ${schedule.days} day${schedule.days > 1 ? 's' : ''}`;
    }
    if (schedule.hours) {
      return `Upcoming ${subjectName} session in ${schedule.hours} hour${schedule.hours > 1 ? 's' : ''}`;
    }
    if (schedule.minutes) {
      return `Upcoming ${subjectName} session in ${schedule.minutes} minutes`;
    }
    return `Upcoming ${subjectName} session`;
  }
}