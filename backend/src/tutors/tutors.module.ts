import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TutorsService } from './tutors.service';
import { TutorsController } from './tutors.controller';
import { Tutor, User, TutorDocument, TutorAvailability, TutorSubject, Subject, Course, University, SubjectApplication, SubjectApplicationDocument, AvailabilityChangeRequest, BookingRequest } from '../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([Tutor, User, TutorDocument, TutorAvailability, TutorSubject, Subject, Course, University, SubjectApplication, SubjectApplicationDocument, AvailabilityChangeRequest, BookingRequest])],
  controllers: [TutorsController],
  providers: [TutorsService],
})
export class TutorsModule {}
