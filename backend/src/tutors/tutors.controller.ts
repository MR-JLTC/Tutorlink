import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { TutorsService } from './tutors.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateTutorStatusDto } from './tutor.dto';

@Controller('tutors')
@UseGuards(JwtAuthGuard)
export class TutorsController {
  constructor(private readonly tutorsService: TutorsService) {}

  @Get('applications')
  findPendingApplications() {
    return this.tutorsService.findPendingApplications();
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() updateTutorStatusDto: UpdateTutorStatusDto) {
    return this.tutorsService.updateStatus(+id, updateTutorStatusDto.status);
  }
}
