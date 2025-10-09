import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from '../database/entities';
import { UpdatePaymentDisputeDto } from './payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private paymentsRepository: Repository<Payment>,
  ) {}

  findAll(): Promise<Payment[]> {
    return this.paymentsRepository.find({
      relations: ['student', 'student.user', 'tutor', 'tutor.user'],
      order: {
        created_at: 'DESC',
      },
    });
  }

  async updateDispute(id: number, dto: UpdatePaymentDisputeDto): Promise<Payment> {
    const payment = await this.paymentsRepository.findOne({ where: { payment_id: id } });
    if (!payment) {
      throw new Error('Payment not found');
    }
    (payment as any).dispute_status = dto.dispute_status;
    (payment as any).admin_note = dto.admin_note ?? null;
    return this.paymentsRepository.save(payment);
  }
}
