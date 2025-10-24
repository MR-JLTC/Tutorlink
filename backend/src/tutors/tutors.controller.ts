import { Controller, Get, Patch, Param, Body, UseGuards, Post, Put } from '@nestjs/common';
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

  @Get('pending-subjects')
  @UseGuards(JwtAuthGuard)
  getAllPendingTutorSubjects() {
    return this.tutorsService.getAllPendingTutorSubjects();
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  updateStatus(@Param('id') id: string, @Body() updateTutorStatusDto: UpdateTutorStatusDto) {
    return this.tutorsService.updateStatus(+id, updateTutorStatusDto.status);
  }

  @Patch('tutor-subjects/:tutorSubjectId/status')
  @UseGuards(JwtAuthGuard)
  updateTutorSubjectStatus(
    @Param('tutorSubjectId') tutorSubjectId: string, 
    @Body() body: { status: 'approved' | 'rejected'; adminNotes?: string }
  ) {
    return this.tutorsService.updateTutorSubjectStatus(+tutorSubjectId, body.status, body.adminNotes);
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

  // Upload of tutor profile image
  @Post(':tutorId/profile-image')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        console.log('Multer Destination Called for Profile Image.');
        const dest = path.join(process.cwd(), 'tutor_documents');
        try {
          if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
          }
        } catch (error) {
          console.error('Error creating directory for profile images:', error);
          return cb(error, null);
        }
        console.log('Profile Image Upload Destination:', dest);
        (req as any).uploadDestination = dest; // Store destination on req object
        cb(null, dest);
      },
      filename: (req: any, file, cb) => {
        console.log('Multer Filename Called for Profile Image.', 'Original Name:', file.originalname);
        const tutorId = req.params.tutorId;
        const ext = path.extname(file.originalname) || '';
        // Generate a temporary filename - the service will rename it
        const tempFilename = `temp_profile_${tutorId}_${Date.now()}${ext}`;
        console.log('Generated temporary Profile Image Filename:', tempFilename);
        cb(null, tempFilename);
      }
    })
  }))
  async uploadProfileImage(@Param('tutorId') tutorId: string, @UploadedFile() file: any) {
    return this.tutorsService.saveProfileImage(+tutorId, file);
  }

  @Post(':tutorId/availability')
  async saveAvailability(@Param('tutorId') tutorId: string, @Body() body: { slots: { day_of_week: string; start_time: string; end_time: string }[] }) {
    return this.tutorsService.saveAvailability(+tutorId, body.slots);
  }

  @Post(':tutorId/subjects')
  async saveSubjects(@Param('tutorId') tutorId: string, @Body() body: { subjects: string[] }) {
    return this.tutorsService.saveSubjects(+tutorId, body.subjects);
  }

  // New endpoints for tutor dashboard functionality

  @Get('by-user/:userId/tutor-id')
  @UseGuards(JwtAuthGuard)
  async getTutorIdByUserId(@Param('userId') userId: string) {
    const tutorId = await this.tutorsService.getTutorId(+userId);
    return { tutor_id: tutorId };
  }

  @Get(':tutorId/status')
  @UseGuards(JwtAuthGuard)
  async getTutorStatus(@Param('tutorId') tutorId: string) {
    return this.tutorsService.getTutorStatus(+tutorId);
  }

  @Get(':tutorId/profile')
  @UseGuards(JwtAuthGuard)
  async getTutorProfile(@Param('tutorId') tutorId: string) {
    return this.tutorsService.getTutorProfile(+tutorId);
  }

  @Put(':tutorId/profile')
  @UseGuards(JwtAuthGuard)
  async updateTutorProfile(@Param('tutorId') tutorId: string, @Body() body: { bio?: string; gcash_number?: string }) {
    return this.tutorsService.updateTutorProfile(+tutorId, body);
  }

  @Get(':tutorId/availability')
  @UseGuards(JwtAuthGuard)
  async getTutorAvailability(@Param('tutorId') tutorId: string) {
    return this.tutorsService.getTutorAvailability(+tutorId);
  }

  @Get(':tutorId/subject-applications')
  @UseGuards(JwtAuthGuard)
  async getSubjectApplications(@Param('tutorId') tutorId: string) {
    return this.tutorsService.getTutorSubjectApplications(+tutorId);
  }

  @Post(':tutorId/subject-application')
  @UseGuards(JwtAuthGuard)
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
        const timestamp = Date.now();
        cb(null, `subjectApp_${tutorId}_${timestamp}${originalExt}`);
      }
    })
  }))
  async submitSubjectApplication(@Param('tutorId') tutorId: string, @Body() body: { subject_name: string }, @UploadedFiles() files: any[]) {
    return this.tutorsService.submitSubjectApplication(+tutorId, body.subject_name, files);
  }

  // Availability change request endpoints removed as redundant

  @Get(':tutorId/booking-requests')
  @UseGuards(JwtAuthGuard)
  async getBookingRequests(@Param('tutorId') tutorId: string) {
    return this.tutorsService.getBookingRequests(+tutorId);
  }

  @Post('booking-requests/:bookingId/accept')
  @UseGuards(JwtAuthGuard)
  async acceptBookingRequest(@Param('bookingId') bookingId: string) {
    return this.tutorsService.updateBookingRequestStatus(+bookingId, 'accepted');
  }

  @Post('booking-requests/:bookingId/decline')
  @UseGuards(JwtAuthGuard)
  async declineBookingRequest(@Param('bookingId') bookingId: string) {
    return this.tutorsService.updateBookingRequestStatus(+bookingId, 'declined');
  }

  @Post('booking-requests/:bookingId/payment-approve')
  @UseGuards(JwtAuthGuard)
  async approvePayment(@Param('bookingId') bookingId: string) {
    return this.tutorsService.updatePaymentStatus(+bookingId, 'approved');
  }

  @Post('booking-requests/:bookingId/payment-reject')
  @UseGuards(JwtAuthGuard)
  async rejectPayment(@Param('bookingId') bookingId: string) {
    return this.tutorsService.updatePaymentStatus(+bookingId, 'rejected');
  }

  @Get(':tutorId/sessions')
  @UseGuards(JwtAuthGuard)
  async getTutorSessions(@Param('tutorId') tutorId: string) {
    return this.tutorsService.getTutorSessions(+tutorId);
  }

  @Get(':tutorId/payments')
  @UseGuards(JwtAuthGuard)
  async getTutorPayments(@Param('tutorId') tutorId: string) {
    return this.tutorsService.getTutorPayments(+tutorId);
  }

  @Get(':tutorId/earnings-stats')
  @UseGuards(JwtAuthGuard)
  async getTutorEarningsStats(@Param('tutorId') tutorId: string) {
    return this.tutorsService.getTutorEarningsStats(+tutorId);
  }


  @Post(':tutorId/gcash-qr')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        console.log('Multer Destination Called for GCash QR.');
        const dest = path.join(process.cwd(), 'tutor_documents');
        try {
          if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
          }
        } catch (error) {
          console.error('Error creating directory for GCash QR images:', error);
          return cb(error, null);
        }
        console.log('GCash QR Upload Destination:', dest);
        (req as any).uploadDestination = dest; // Store destination on req object
        cb(null, dest);
      },
      filename: (req: any, file, cb) => {
        console.log('Multer Filename Called for GCash QR.', 'Original Name:', file.originalname);
        const tutorId = req.params.tutorId;
        const ext = path.extname(file.originalname) || '';
        // Generate a temporary filename - the service will rename it
        const tempFilename = `temp_gcash_${tutorId}_${Date.now()}${ext}`;
        console.log('Generated temporary GCash QR Filename:', tempFilename);
        cb(null, tempFilename);
      }
    })
  }))
  async uploadGcashQR(@Param('tutorId') tutorId: string, @UploadedFile() file: any) {
    return this.tutorsService.saveGcashQR(+tutorId, file);
  }

  // Set placeholder profile image when no file is uploaded
  @Post(':tutorId/profile-image-placeholder')
  async setProfileImagePlaceholder(@Param('tutorId') tutorId: string) {
    return this.tutorsService.saveProfileImage(+tutorId, null);
  }

  // Set placeholder GCash QR when no file is uploaded
  @Post(':tutorId/gcash-qr-placeholder')
  async setGcashQRPlaceholder(@Param('tutorId') tutorId: string) {
    return this.tutorsService.saveGcashQR(+tutorId, null);
  }
}