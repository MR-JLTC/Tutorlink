import { Controller, Get, Patch, Param, Body, UseGuards, Post } from '@nestjs/common';
import type { Express } from 'express';
import { TutorsService } from './tutors.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateTutorStatusDto } from './tutor.dto';
import { UseInterceptors, UploadedFiles, UploadedFile } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('tutors')
export class TutorsController {
  constructor(private readonly tutorsService: TutorsService) {}

  @Get('applications')
  @UseGuards(JwtAuthGuard)
  findPendingApplications() {
    return this.tutorsService.findPendingApplications();
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  updateStatus(@Param('id') id: string, @Body() updateTutorStatusDto: UpdateTutorStatusDto) {
    return this.tutorsService.updateStatus(+id, updateTutorStatusDto.status);
  }

  // Public apply endpoint to create a user+tutor (pending)
  @Post('apply')
  async applyTutor(@Body() body: { email: string; password: string; university_id: number; course_id?: number; course_name?: string; name?: string; bio?: string }) {
    return this.tutorsService.applyTutor(body);
  }

  // Public upload of tutor documents after receiving tutor_id (pre-approval)
  @Post(':tutorId/documents')
  @UseInterceptors(FilesInterceptor('files', 10, {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const dest = path.join(process.cwd(), 'tutor_documents');
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
      },
      filename: (req: any, file, cb) => {
        const tutorId = req.params.tutorId;
        const originalExt = path.extname(file.originalname) || '';
        // Determine starting sequence from existing files (matches _<tutorId>)
        const dest = path.join(process.cwd(), 'tutor_documents');
        if (typeof req.__tutorDocsSeqStart !== 'number') {
          const files = fs.existsSync(dest) ? fs.readdirSync(dest) : [];
          const existing = files.filter((f) => f.endsWith(`_${tutorId}${path.extname(f)}`) || f.includes(`_${tutorId}.`)).length;
          req.__tutorDocsSeqStart = existing; // number of existing docs
          req.__tutorDocsSeqCounter = 0; // counter within this request
        }
        req.__tutorDocsSeqCounter = (req.__tutorDocsSeqCounter || 0) + 1;
        const seq = req.__tutorDocsSeqStart + req.__tutorDocsSeqCounter; // 1-based when none exists
        const base = `tutorDocs${seq}_${tutorId}`;
        cb(null, `${base}${originalExt}`);
      }
    })
  }))
  async uploadDocuments(@Param('tutorId') tutorId: string, @UploadedFiles() files: any[]) {
    return this.tutorsService.saveDocuments(+tutorId, files);
  }

  // Public upload of tutor profile image
  @Post(':tutorId/profile-image')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const dest = path.join(process.cwd(), 'tutor_documents');
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
      },
      filename: (req: any, file, cb) => {
        const tutorId = req.params.tutorId;
        const ext = path.extname(file.originalname) || '';
        cb(null, `tutorProfile_${tutorId}${ext}`);
      }
    })
  }))
  async uploadProfileImage(@Param('tutorId') tutorId: string, @UploadedFile() file: any) {
    return this.tutorsService.saveProfileImage(+tutorId, (file as any));
  }

  @Post(':tutorId/availability')
  async saveAvailability(@Param('tutorId') tutorId: string, @Body() body: { slots: { day_of_week: string; start_time: string; end_time: string }[] }) {
    return this.tutorsService.saveAvailability(+tutorId, body.slots);
  }

  @Post(':tutorId/subjects')
  async saveSubjects(@Param('tutorId') tutorId: string, @Body() body: { subjects: string[] }) {
    return this.tutorsService.saveSubjects(+tutorId, body.subjects);
  }
}
