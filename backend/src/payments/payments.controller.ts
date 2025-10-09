import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdatePaymentDisputeDto } from './payment.dto';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  findAll() {
    return this.paymentsService.findAll();
  }

  @Patch(':id/dispute')
  updateDispute(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentDisputeDto,
  ) {
    return this.paymentsService.updateDispute(+id, dto);
  }
}
