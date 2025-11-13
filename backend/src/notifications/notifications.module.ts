import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationSchedulerService } from './notification-scheduler.service';
import { Session } from '../database/entities/session.entity';
import { Notification } from '../database/entities/notification.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Session, Notification]),
    ScheduleModule.forRoot()
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationSchedulerService],
  exports: [NotificationsService],
})
export class NotificationsModule {}