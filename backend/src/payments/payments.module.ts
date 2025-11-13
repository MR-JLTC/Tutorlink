import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { Payment, BookingRequest, Tutor, User, Student, Notification } from '../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, BookingRequest, Tutor, User, Student, Notification])],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
