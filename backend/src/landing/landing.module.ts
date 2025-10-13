import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LandingController } from './landing.controller';
import { User, Tutor, University, Course, Session } from '../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([User, Tutor, University, Course, Session])],
  controllers: [LandingController],
})
export class LandingModule {}


