import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, Admin, Tutor, Course, University, Student, Notification, BookingRequest, Session, Subject } from '../database/entities';
import { TutorsModule } from '../tutors/tutors.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Admin, Tutor, Course, University, Student, Notification, BookingRequest, Session, Subject]), TutorsModule, NotificationsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // Export for use in AuthModule
})
export class UsersModule {}
