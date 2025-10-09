import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, Tutor, Payment } from '../database/entities';
import { Session } from '../database/entities/session.entity';
import { Subject } from '../database/entities/subject.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Tutor)
    private tutorsRepository: Repository<Tutor>,
    @InjectRepository(Payment)
    private paymentsRepository: Repository<Payment>,
    @InjectRepository(Session)
    private sessionsRepository: Repository<Session>,
    @InjectRepository(Subject)
    private subjectsRepository: Repository<Subject>,
  ) {}

  async getStats() {
    const totalUsers = await this.usersRepository.count();
    
    const totalTutors = await this.tutorsRepository.count({
      where: { status: 'approved' },
    });
    
    const pendingApplications = await this.tutorsRepository.count({
      where: { status: 'pending' },
    });
    
    const totalRevenueResult = await this.paymentsRepository
      .createQueryBuilder('payment')
      .select('SUM(payment.amount)', 'sum')
      .where('payment.status = :status', { status: 'confirmed' })
      .getRawOne();
      
    const totalRevenue = parseFloat(totalRevenueResult.sum) || 0;

    // Confirmed sessions (completed sessions)
    const confirmedSessions = await this.sessionsRepository.count({
      where: { status: 'completed' },
    });

    // Most in-demand subjects: top 5 by number of completed sessions per subject
    const inDemandSubjectsRaw = await this.sessionsRepository
      .createQueryBuilder('session')
      .select('session.subject_id', 'subject_id')
      .addSelect('COUNT(session.session_id)', 'count')
      .where('session.status = :status', { status: 'completed' })
      .groupBy('session.subject_id')
      .orderBy('count', 'DESC')
      .limit(5)
      .getRawMany();

    const subjectIds = inDemandSubjectsRaw.map((row) => row.subject_id).filter(Boolean);
    let subjectsMap: Record<number, string> = {};
    if (subjectIds.length > 0) {
      const subjects = await this.subjectsRepository.findByIds(subjectIds);
      subjectsMap = subjects.reduce((acc, s) => {
        acc[(s as any).subject_id] = (s as any).name;
        return acc;
      }, {} as Record<number, string>);
    }

    const mostInDemandSubjects = inDemandSubjectsRaw.map((row) => ({
      subjectId: Number(row.subject_id),
      subjectName: subjectsMap[Number(row.subject_id)] || 'Unknown',
      sessions: Number(row.count),
    }));

    // Payment activity overview: totals by status and recent payments sum (last 30 days)
    const paymentStatusCountsRaw = await this.paymentsRepository
      .createQueryBuilder('payment')
      .select('payment.status', 'status')
      .addSelect('COUNT(payment.payment_id)', 'count')
      .groupBy('payment.status')
      .getRawMany();

    const paymentStatusCounts = paymentStatusCountsRaw.reduce((acc, row) => {
      acc[row.status] = Number(row.count);
      return acc;
    }, {} as Record<string, number>);

    const recentPaymentsSumRaw = await this.paymentsRepository
      .createQueryBuilder('payment')
      .select('COALESCE(SUM(payment.amount), 0)', 'sum')
      .where('payment.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)')
      .andWhere('payment.status = :status', { status: 'confirmed' })
      .getRawOne();

    const recentConfirmedRevenue = parseFloat(recentPaymentsSumRaw.sum) || 0;

    return {
      totalUsers,
      totalTutors,
      pendingApplications,
      totalRevenue,
      confirmedSessions,
      mostInDemandSubjects,
      paymentOverview: {
        byStatus: paymentStatusCounts,
        recentConfirmedRevenue,
      },
    };
  }
}
