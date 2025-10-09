import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('courses')
@UseGuards(JwtAuthGuard)
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  findAllWithDetails() {
    return this.coursesService.findAllWithDetails();
  }

  @Get(':id/subjects')
  findSubjectsForCourse(@Param('id') id: string) {
    return this.coursesService.findSubjectsForCourse(+id);
  }

  @Post()
  createCourse(@Body() body: { course_name: string; university_id: number }) {
    return this.coursesService.createCourse(body.course_name, body.university_id);
  }

  @Patch(':id')
  updateCourse(@Param('id') id: string, @Body() body: { course_name?: string; university_id?: number }) {
    return this.coursesService.updateCourse(+id, body);
  }

  @Post(':id/subjects')
  addSubjectToCourse(@Param('id') id: string, @Body() body: { subject_name: string; semester?: string }) {
    return this.coursesService.addSubjectToCourse(+id, body.subject_name, body.semester);
  }

  @Patch(':courseId/subjects/:subjectId')
  updateSubject(
    @Param('courseId') courseId: string,
    @Param('subjectId') subjectId: string,
    @Body() body: { subject_name?: string; semester?: string },
  ) {
    return this.coursesService.updateSubject(+courseId, +subjectId, body);
  }

  @Delete(':id')
  deleteCourse(@Param('id') id: string) {
    return this.coursesService.deleteCourse(+id);
  }

  @Delete(':courseId/subjects/:subjectId')
  deleteSubject(@Param('courseId') courseId: string, @Param('subjectId') subjectId: string) {
    return this.coursesService.deleteSubject(+courseId, +subjectId);
  }
}
