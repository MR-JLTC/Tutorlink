import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { User, Tutor, Payment } from '../database/entities';
import { Session } from '../database/entities/session.entity';
import { Subject } from '../database/entities/subject.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Tutor, Payment, Session, Subject])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
