import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LandingController } from './landing.controller';
import { Student, Tutor, University, Course, BookingRequest } from '../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([Student, Tutor, University, Course, BookingRequest])],
  controllers: [LandingController],
})
export class LandingModule {}


