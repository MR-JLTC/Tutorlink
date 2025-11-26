import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, Tutor, Payment } from '../database/entities';
import { Session } from '../database/entities/session.entity';
import { Subject } from '../database/entities/subject.entity';
import { Student } from '../database/entities/student.entity';
import { University } from '../database/entities/university.entity';
import { Course } from '../database/entities/course.entity';

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
    @InjectRepository(Student)
    private studentsRepository: Repository<Student>,
    @InjectRepository(University)
    private universitiesRepository: Repository<University>,
    @InjectRepository(Course)
    private coursesRepository: Repository<Course>,
  ) {}

  async getStats() {
    const totalUsers = await this.usersRepository.count();
    
    const totalTutors = await this.tutorsRepository.count({
      where: { status: 'approved' },
    });
    
    const pendingApplications = await this.tutorsRepository.count({
      where: { status: 'pending' },
    });
    
    const PLATFORM_SHARE = 0.13;
    const TUTEE_SENDER: 'tutee' = 'tutee';

    // Calculate total revenue: 13% of tutee payments + full amount of admin payments
    const totalRevenueResult = await this.paymentsRepository
      .createQueryBuilder('payment')
      .select(`
        COALESCE(SUM(
          CASE 
            WHEN payment.sender = :tuteeSender THEN payment.amount * :platformShare
            ELSE payment.amount
          END
        ), 0)`, 'sum')
      .where('(payment.status = :confirmed OR payment.status = :adminConfirmed OR payment.status = :adminPaid)', { 
        confirmed: 'confirmed', 
        adminConfirmed: 'admin_confirmed',
        adminPaid: 'admin_paid',
        tuteeSender: TUTEE_SENDER,
        platformShare: PLATFORM_SHARE
      })
      .getRawOne();
      
    const totalRevenue = Number((parseFloat(totalRevenueResult?.sum || '0') || 0).toFixed(2));
    console.log(`[Dashboard] Total Revenue Query:`, {
      result: totalRevenueResult,
      sum: totalRevenueResult?.sum,
      totalRevenue
    });

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

    // Payment activity overview: totals by status (all payments)
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

    // Recent confirmed revenue: 13% of tutee payments + full amount of admin payments (last 30 days)
    const recentPaymentsSumRaw = await this.paymentsRepository
      .createQueryBuilder('payment')
      .select(`
        COALESCE(SUM(
          CASE 
            WHEN payment.sender = :tuteeSender THEN payment.amount * :platformShare
            ELSE payment.amount
          END
        ), 0)`, 'sum')
      .where('payment.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)')
      .andWhere('(payment.status = :confirmed OR payment.status = :adminConfirmed OR payment.status = :adminPaid)', { 
        confirmed: 'confirmed', 
        adminConfirmed: 'admin_confirmed',
        adminPaid: 'admin_paid',
        tuteeSender: TUTEE_SENDER,
        platformShare: PLATFORM_SHARE
      })
      .getRawOne();

    const recentConfirmedRevenue = Number((parseFloat(recentPaymentsSumRaw?.sum || '0') || 0).toFixed(2));
    console.log(`[Dashboard] Recent Confirmed Revenue:`, {
      result: recentPaymentsSumRaw,
      sum: recentPaymentsSumRaw?.sum,
      recentConfirmedRevenue
    });

    // Payment trends: 13% of tutee payments + full amount of admin payments (last 6 months)
    const paymentTrendsRaw = await this.paymentsRepository
      .createQueryBuilder('payment')
      .select("DATE_FORMAT(payment.created_at, '%Y-%m')", 'period')
      .addSelect("DATE_FORMAT(payment.created_at, '%b %Y')", 'label')
      .addSelect(`
        COALESCE(SUM(
          CASE 
            WHEN payment.sender = :tuteeSender THEN payment.amount * :platformShare
            ELSE payment.amount
          END
        ), 0)`, 'sum')
      .where('(payment.status = :confirmed OR payment.status = :adminConfirmed)', { 
        confirmed: 'confirmed', 
        adminConfirmed: 'admin_confirmed',
        tuteeSender: TUTEE_SENDER,
        platformShare: PLATFORM_SHARE
      })
      .andWhere('payment.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)')
      .groupBy('period')
      .addGroupBy('label')
      .orderBy('period', 'ASC')
      .getRawMany();

    const paymentTrends = paymentTrendsRaw.map((row: any) => ({
      label: row.label || row.period,
      amount: Number((parseFloat(row.sum || '0') || 0).toFixed(2)),
    }));
    console.log(`[Dashboard] Payment Trends:`, paymentTrends);

    // University distribution: tutors vs tutees per university
    const tutorUniRaw = await this.tutorsRepository
      .createQueryBuilder('tutor')
      .select('tutor.university_id', 'university_id')
      .addSelect('COUNT(tutor.tutor_id)', 'tutors')
      .where('tutor.university_id IS NOT NULL')
      .andWhere('tutor.status = :status', { status: 'approved' })
      .groupBy('tutor.university_id')
      .getRawMany();

    const tuteeUniRaw = await this.studentsRepository
      .createQueryBuilder('student')
      .select('student.university_id', 'university_id')
      .addSelect('COUNT(student.student_id)', 'tutees')
      .where('student.university_id IS NOT NULL')
      .groupBy('student.university_id')
      .getRawMany();

    const uniIds = Array.from(new Set([
      ...tutorUniRaw.map((r: any) => Number(r.university_id)),
      ...tuteeUniRaw.map((r: any) => Number(r.university_id)),
    ].filter(Boolean)));
    const uniMap: Record<number, string> = {};
    if (uniIds.length) {
      const universities = await this.universitiesRepository.findByIds(uniIds);
      universities.forEach(u => { (uniMap as any)[(u as any).university_id] = (u as any).name; });
    }
    const uniAgg: Record<number, { university: string; tutors: number; tutees: number }> = {};
    tutorUniRaw.forEach((r: any) => {
      const id = Number(r.university_id);
      if (!id) return;
      uniAgg[id] = uniAgg[id] || { university: uniMap[id] || 'Unknown', tutors: 0, tutees: 0 };
      uniAgg[id].tutors = Number(r.tutors) || 0;
    });
    tuteeUniRaw.forEach((r: any) => {
      const id = Number(r.university_id);
      if (!id) return;
      uniAgg[id] = uniAgg[id] || { university: uniMap[id] || 'Unknown', tutors: 0, tutees: 0 };
      uniAgg[id].tutees = Number(r.tutees) || 0;
    });
    const universityDistribution = Object.values(uniAgg).sort((a, b) => (b.tutors + b.tutees) - (a.tutors + a.tutees));

    // Overall users by type (approved tutors only)
    const tutorsTotal = await this.tutorsRepository.count({ where: { status: 'approved' as any } });
    // Prefer counting active tutee users; fallback to students table if needed
    let tuteesTotal = await this.usersRepository.count({ where: { user_type: 'tutee' as any } });
    if (!tuteesTotal) {
      tuteesTotal = await this.studentsRepository.count();
    }
    const userTypeTotals = { tutors: tutorsTotal, tutees: tuteesTotal };

    // Course distribution: tutors vs tutees per course
    const tutorCourseRaw = await this.tutorsRepository
      .createQueryBuilder('tutor')
      .select('tutor.course_id', 'course_id')
      .addSelect('COUNT(tutor.tutor_id)', 'tutors')
      .where('tutor.course_id IS NOT NULL')
      .andWhere('tutor.status = :status', { status: 'approved' })
      .groupBy('tutor.course_id')
      .getRawMany();
    const tuteeCourseRaw = await this.studentsRepository
      .createQueryBuilder('student')
      .select('student.course_id', 'course_id')
      .addSelect('COUNT(student.student_id)', 'tutees')
      .where('student.course_id IS NOT NULL')
      .groupBy('student.course_id')
      .getRawMany();
    const courseIds = Array.from(new Set([
      ...tutorCourseRaw.map((r: any) => Number(r.course_id)),
      ...tuteeCourseRaw.map((r: any) => Number(r.course_id)),
    ].filter(Boolean)));
    const courseMap: Record<number, string> = {};
    if (courseIds.length) {
      const courses = await this.coursesRepository.findByIds(courseIds);
      courses.forEach(c => { (courseMap as any)[(c as any).course_id] = (c as any).course_name || (c as any).name; });
    }
    const courseAgg: Record<number, { courseName: string; tutors: number; tutees: number }> = {};
    tutorCourseRaw.forEach((r: any) => {
      const id = Number(r.course_id);
      if (!id) return;
      courseAgg[id] = courseAgg[id] || { courseName: courseMap[id] || 'Unknown', tutors: 0, tutees: 0 };
      courseAgg[id].tutors = Number(r.tutors) || 0;
    });
    tuteeCourseRaw.forEach((r: any) => {
      const id = Number(r.course_id);
      if (!id) return;
      courseAgg[id] = courseAgg[id] || { courseName: courseMap[id] || 'Unknown', tutors: 0, tutees: 0 };
      courseAgg[id].tutees = Number(r.tutees) || 0;
    });
    const courseDistribution = Object.values(courseAgg).sort((a, b) => (b.tutors + b.tutees) - (a.tutors + a.tutees));

    // Sessions per subject (completed)
    const subjectSessionsRaw = await this.sessionsRepository
      .createQueryBuilder('session')
      .select('session.subject_id', 'subject_id')
      .addSelect('COUNT(session.session_id)', 'sessions')
      .where('session.status = :status', { status: 'completed' })
      .groupBy('session.subject_id')
      .orderBy('sessions', 'DESC')
      .getRawMany();
    const subjIdsAll = subjectSessionsRaw.map((r) => Number(r.subject_id)).filter(Boolean);
    const subjMapAll: Record<number, string> = {};
    if (subjIdsAll.length) {
      const subjectsAll = await this.subjectsRepository.findByIds(subjIdsAll);
      subjectsAll.forEach(s => { (subjMapAll as any)[(s as any).subject_id] = (s as any).name; });
    }
    const subjectSessions = subjectSessionsRaw.map((r: any) => ({
      subjectId: Number(r.subject_id),
      subjectName: subjMapAll[Number(r.subject_id)] || 'Unknown',
      sessions: Number(r.sessions) || 0,
    }));

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
        trends: paymentTrends,
      },
      universityDistribution,
      userTypeTotals,
      courseDistribution,
      subjectSessions,
    };
  }
}
