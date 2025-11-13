import { Controller, Get, Patch, Param, Body, UseGuards, Delete, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { UsersService } from './users.service';
import { TutorsService } from '../tutors/tutors.service';
import { Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService, private readonly tutorsService: TutorsService) {}

  @Get()
  async findAll() {
    const users = await this.usersService.findAll();
    // This is a simplified mapping. A real app might use DTOs or serializers.
    return users.map(u => ({
      user_id: u.user_id,
      name: u.name,
      email: u.email,
      profile_image_url: u.profile_image_url,
      university_id: u.student_profile?.university_id || u.tutor_profile?.university_id || null,
      university_name: u.student_profile?.university?.name || u.tutor_profile?.university?.name || 'N/A',
      status: u.status,
      created_at: u.created_at,
      role: u.admin_profile ? 'admin' : (u.tutor_profile ? 'tutor' : 'student'),
      tutor_profile: u.tutor_profile ? {
        tutor_id: u.tutor_profile.tutor_id,
        status: u.tutor_profile.status
      } : null
    }));
  }

  @Get('test-auth')
  async testAuth() {
    console.log('=== TEST AUTH ENDPOINT ===');
    return { message: 'Authentication successful', timestamp: new Date().toISOString() };
  }

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: { status: 'active' | 'inactive' }) {
    return this.usersService.updateStatus(+id, body.status);
  }

  @Patch(':id/reset-password')
  async resetPassword(@Param('id') id: string, @Body() body: { newPassword: string }) {
    return this.usersService.resetPassword(+id, body.newPassword);
  }

  @Patch(':id')
  async updateUser(
    @Param('id') id: string,
    @Body() body: { name?: string; email?: string; status?: 'active' | 'inactive'; year_level?: number; university_id?: number; profile_image_url?: string },
  ) {
    return this.usersService.updateUser(+id, body);
  }

  @Delete(':id')
  async deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(+id);
  }

  @Post(':id/profile-image')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        console.log('=== MULTER DESTINATION DEBUG ===');
        console.log('Request params:', req.params);
        console.log('File info:', file);
        
        const dest = path.join(process.cwd(), 'user_profile_images');
        console.log('Destination path:', dest);
        
        try {
          if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
            console.log('Created directory:', dest);
          } else {
            console.log('Directory already exists:', dest);
          }
        } catch (error) {
          console.error('Error creating directory for profile images:', error);
          return cb(error, null);
        }
        cb(null, dest);
        console.log('=== END MULTER DESTINATION DEBUG ===');
      },
      filename: (req: any, file, cb) => {
        console.log('=== MULTER FILENAME DEBUG ===');
        console.log('Request params:', req.params);
        console.log('File originalname:', file.originalname);
        
        const userId = req.params.id;
        const ext = path.extname(file.originalname) || '.jpg';
        const filename = `userProfile_${userId}${ext}`;
        
        console.log('Generated filename:', filename);
        console.log('=== END MULTER FILENAME DEBUG ===');
        
        cb(null, filename);
      }
    })
  }))
  async uploadProfileImage(@Param('id') id: string, @UploadedFile() file: any) {
    console.log('=== PROFILE IMAGE UPLOAD DEBUG ===');
    console.log('User ID:', id);
    console.log('File received:', file);
    console.log('File filename:', file?.filename);
    
    const userId = parseInt(id);
    const filename = file.filename;
    const filePath = path.join('user_profile_images', filename);
    
    console.log('Parsed user ID:', userId);
    console.log('Generated filename:', filename);
    console.log('File path:', filePath);
    
    // Check if old profile image exists and delete it
    try {
      const oldFiles = fs.readdirSync(path.join(process.cwd(), 'user_profile_images'));
      const oldFile = oldFiles.find(f => f.startsWith(`userProfile_${userId}`));
      if (oldFile && oldFile !== filename) {
        const oldFilePath = path.join(process.cwd(), 'user_profile_images', oldFile);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
          console.log(`Deleted old profile image: ${oldFile}`);
        }
      }
    } catch (error) {
      console.error('Error deleting old profile image:', error);
    }
    
    // Update the user's profile_image_url in the database
    const dbUrl = `user_profile_images/${filename}`;
    console.log('Updating database with URL:', dbUrl);
    
    await this.usersService.updateUser(userId, { 
      profile_image_url: dbUrl
    });

    console.log('Database updated successfully');
    console.log('=== END PROFILE IMAGE UPLOAD DEBUG ===');

    return { 
      message: 'Profile image uploaded successfully',
      profile_image_url: dbUrl
    };
  }

  @Post(':id/profile-image-placeholder')
  async setPlaceholderProfileImage(@Param('id') id: string) {
    const userId = parseInt(id);
    // No placeholder image stored, just return success
    // The frontend will use initials as fallback
    
    return { 
      message: 'Placeholder profile image set successfully',
      profile_image_url: null 
    };
  }

  @Get('me/bookings')
  async getMyBookings(@Req() req: any) {
    const userId = req.user?.user_id;
    return this.tutorsService.getStudentBookingRequests(userId);
  }

  @Get(':id/bookings')
  async getBookingsForUser(@Param('id') id: string) {
    return this.tutorsService.getStudentBookingRequests(+id);
  }

  // Notifications endpoints
  @Get('notifications')
  @UseGuards(JwtAuthGuard)
  async getNotifications(@Req() req: any) {
    const userId = req.user?.user_id;
    return this.usersService.getNotifications(userId);
  }

  @Get('notifications/unread-count')
  async getUnreadCount(@Req() req: any) {
    const userId = req.user?.user_id;
    return this.usersService.getUnreadNotificationCount(userId);
  }

  @Get('notifications/upcoming-sessions')
  async getUpcomingSessions(@Req() req: any) {
    const userId = req.user?.user_id;
    return this.usersService.hasUpcomingSessions(userId);
  }

  @Get('upcoming-sessions/list')
  async getUpcomingSessionsList(@Req() req: any) {
    const userId = req.user?.user_id;
    return this.usersService.getUpcomingSessionsList(userId);
  }

  @Patch('notifications/:id/read')
  async markNotificationAsRead(@Param('id') id: string) {
    return this.usersService.markNotificationAsRead(+id);
  }

  @Patch('notifications/mark-all-read')
  async markAllNotificationsAsRead(@Req() req: any) {
    const userId = req.user?.user_id;
    return this.usersService.markAllNotificationsAsRead(userId);
  }

  @Delete('notifications/:id')
  async deleteNotification(@Param('id') id: string) {
    return { success: true };
  }

  @Get('admins-with-qr')
  async getAdminsWithQr() {
    return { success: true, data: await this.usersService.getAdminsWithQr() };
  }

  // Admin profile details
  @Get(':id/admin-profile')
  async getAdminProfile(@Param('id') id: string) {
    return this.usersService.getAdminProfile(+id);
  }

  // Upload Admin QR code image
  @Post(':id/admin-qr')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const dest = path.join(process.cwd(), 'admin_qr');
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
      },
      filename: (req: any, file, cb) => {
        const userId = req.params.id;
        const ext = path.extname(file.originalname) || '.png';
        const filename = `adminQR_${userId}${ext}`;
        cb(null, filename);
      }
    })
  }))
  async uploadAdminQr(@Param('id') id: string, @UploadedFile() file: any) {
    const userId = parseInt(id);
    if (!file) {
      return { success: false, message: 'No file uploaded' };
    }
    const dbUrl = `/admin_qr/${file.filename}`;
    return this.usersService.updateAdminQr(userId, dbUrl);
  }
}
