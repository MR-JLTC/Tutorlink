import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';
import { Course, Subject } from '../database/entities';
import { University } from '../database/entities/university.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Course, Subject, University])],
  controllers: [CoursesController],
  providers: [CoursesService],
})
export class CoursesModule {}
