import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reschedule } from '../database/entities/reschedule.entity';
import { ReschedulesService } from './reschedules.service';
import { ReschedulesController } from './reschedules.controller';
import { BookingRequest } from '../database/entities/booking-request.entity';
import { User } from '../database/entities/user.entity';
import { Notification } from '../database/entities/notification.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Reschedule, BookingRequest, User, Notification])],
  providers: [ReschedulesService],
  controllers: [ReschedulesController],
  exports: [ReschedulesService]
})
export class ReschedulesModule {}
