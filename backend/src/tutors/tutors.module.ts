import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TutorsService } from './tutors.service';
import { TutorsController } from './tutors.controller';
import { Tutor, User } from '../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([Tutor, User])],
  controllers: [TutorsController],
  providers: [TutorsService],
})
export class TutorsModule {}
