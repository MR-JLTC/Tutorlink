import { Controller, Post, Body, UseGuards, Req, Get, Param, Patch, Delete } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReschedulesService } from './reschedules.service';
import { CreateRescheduleDto } from './dto/create-reschedule.dto';

@Controller('reschedules')
@UseGuards(JwtAuthGuard)
export class ReschedulesController {
  constructor(private readonly reschedulesService: ReschedulesService) {}

  @Post()
  async propose(@Req() req: any, @Body() body: CreateRescheduleDto) {
    const userId = req.user?.user_id;
    console.log('ReschedulesController.propose called by user:', userId, 'body:', body);
    const result = await this.reschedulesService.propose(userId, body);
    console.log('ReschedulesController.propose result:', result?.success ? 'ok' : 'fail');
    return result;
  }

  @Get('booking/:bookingId')
  async listByBooking(@Param('bookingId') bookingId: string) {
    return this.reschedulesService.listByBooking(+bookingId);
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.reschedulesService.findById(+id);
  }

  @Patch(':id/accept')
  async accept(@Req() req: any, @Param('id') id: string) {
    const userId = req.user?.user_id;
    return this.reschedulesService.accept(userId, +id);
  }

  @Patch(':id/reject')
  async reject(@Req() req: any, @Param('id') id: string) {
    const userId = req.user?.user_id;
    return this.reschedulesService.reject(userId, +id);
  }

  @Delete(':id')
  async cancel(@Req() req: any, @Param('id') id: string) {
    const userId = req.user?.user_id;
    return this.reschedulesService.cancel(userId, +id);
  }
}
