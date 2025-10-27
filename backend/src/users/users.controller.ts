import { Controller, Get, Patch, Param, Body, UseGuards, Delete } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll() {
    const users = await this.usersService.findAll();
    // This is a simplified mapping. A real app might use DTOs or serializers.
    return users.map(u => ({
      user_id: u.user_id,
      name: u.name,
      email: u.email,
      university_id: u.student_profile?.university_id || u.tutor_profile?.university_id || null,
      university_name: u.student_profile?.university?.name || u.tutor_profile?.university?.name || 'N/A',
      status: u.status,
      created_at: u.created_at,
      // Simplified role for now. A real implementation would check the related tables (admin, tutor, student).
      role: u.admin_profile ? 'admin' : (u.tutor_profile ? 'tutor' : 'student')
    }));
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
    @Body() body: { name?: string; email?: string; status?: 'active' | 'inactive'; year_level?: number; university_id?: number },
  ) {
    return this.usersService.updateUser(+id, body);
  }

  @Delete(':id')
  async deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(+id);
  }
}
