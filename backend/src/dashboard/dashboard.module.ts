import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { User, Tutor, Payment, Payout } from '../database/entities';
import { Session } from '../database/entities/session.entity';
import { Subject } from '../database/entities/subject.entity';
import { Student } from '../database/entities/student.entity';
import { University } from '../database/entities/university.entity';
import { Course } from '../database/entities/course.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Tutor, Payment, Payout, Session, Subject, Student, University, Course])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
