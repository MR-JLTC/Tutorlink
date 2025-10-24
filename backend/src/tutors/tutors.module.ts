import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TutorsService } from './tutors.service';
import { TutorsController } from './tutors.controller';
import { Tutor, User, TutorDocument, TutorAvailability, TutorSubject, TutorSubjectDocument, Subject, Course, University, SubjectApplication, SubjectApplicationDocument, BookingRequest } from '../database/entities';
import { EmailService } from '../email/email.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tutor, User, TutorDocument, TutorAvailability, TutorSubject, TutorSubjectDocument, Subject, Course, University, SubjectApplication, SubjectApplicationDocument, BookingRequest])],
  controllers: [TutorsController],
  providers: [TutorsService, EmailService],
})
export class TutorsModule {}
