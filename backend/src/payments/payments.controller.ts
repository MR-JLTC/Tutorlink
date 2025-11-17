import { Controller, Get, Patch, Param, Body, UseGuards, Post, UploadedFile, UseInterceptors, Request } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdatePaymentDisputeDto } from './payment.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';

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

  @Post('submit-proof')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const dest = path.join(process.cwd(), 'tutor_documents');
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
      },
      filename: (req: any, file, cb) => {
        const ext = path.extname(file.originalname) || '.jpg';
        const filename = `paymentProof_${Date.now()}${ext}`;
        cb(null, filename);
      }
    })
  }))
  async submitProof(
    @Body() body: { bookingId: string; adminId: string; amount: string },
    @UploadedFile() file: any
  ) {
    return this.paymentsService.submitProof(+body.bookingId, +body.adminId, Number(body.amount), file);
  }

  @Patch(':id/verify')
  @UseInterceptors(FileInterceptor('adminProof', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const dest = path.join(process.cwd(), 'tutor_documents');
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
      },
      filename: (req: any, file, cb) => {
        const ext = path.extname(file.originalname) || '.jpg';
        const filename = `adminPaymentProof_${Date.now()}${ext}`;
        cb(null, filename);
      }
    })
  }))
  async verifyPayment(
    @Param('id') id: string, 
    @Body() body: { status: 'confirmed' | 'rejected'; rejection_reason?: string },
    @UploadedFile() adminProof?: any
  ) {
    try {
      if (adminProof) {
        console.log(`PaymentsController.verifyPayment: Received adminProof filename=${adminProof.filename}, mimetype=${adminProof.mimetype}`);
      } else {
        console.log('PaymentsController.verifyPayment: No adminProof file received in request');
      }
      if (body.status === 'rejected' && body.rejection_reason) {
        console.log(`PaymentsController.verifyPayment: Rejection reason: ${body.rejection_reason}`);
      }
      const res = await this.paymentsService.verifyPayment(+id, body.status, adminProof, body.rejection_reason);
      console.log(`PaymentsController.verifyPayment: Service result:`, res);
      return res;
    } catch (err) {
      console.error('PaymentsController.verifyPayment: Error while verifying payment:', err);
      throw err;
    }
  }

  @Patch(':id/confirm')
  async confirmByTutor(
    @Param('id') id: string,
    @Request() req: any
  ) {
    const userId = req.user?.user_id;
    return this.paymentsService.confirmByTutor(+id, userId);
  }
}
