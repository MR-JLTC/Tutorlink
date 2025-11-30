import React, { useEffect, useMemo, useState } from 'react';
import Card from '../ui/Card';
import apiClient from '../../services/api';
import { Users, UserCheck, FileText, CheckCircle2, TrendingUp, University, BarChart3, Layers, BookOpen } from 'lucide-react';
import PesoSignIcon from '../icons/PesoSignIcon';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { Payment } from '../../types';

interface PaymentTrendPoint {
  label: string;
  amount: number;
}

interface Stats {
  totalUsers: number;
  totalTutors: number;
  pendingApplications: number;
  totalRevenue: number;
  confirmedSessions: number;
  mostInDemandSubjects: { subjectId: number; subjectName: string; sessions: number }[];
  paymentOverview: { byStatus: Record<string, number>; recentConfirmedRevenue: number; trends: PaymentTrendPoint[] };
}

// Helper function to format numbers with K/M suffixes for large values
const formatNumber = (num: number): string => {
    if (num >= 1000000) {
        const millions = num / 1000000;
        return millions % 1 === 0 
            ? `${millions.toFixed(0)}M` 
            : `${millions.toFixed(1)}M`;
    } else if (num >= 1000) {
        const thousands = num / 1000;
        return thousands % 1 === 0 
            ? `${thousands.toFixed(0)}K` 
            : `${thousands.toFixed(1)}K`;
    }
    return num.toLocaleString('en-US');
};

const StatCard: React.FC<{ icon: React.ElementType, title: string, value: string | number, color: string, showActualValue?: boolean }> = ({ icon: Icon, title, value, color, showActualValue = false }) => {
    const isRevenue = typeof value === 'string' && value.includes('₱');
    
    // Format numeric values for better readability (unless showActualValue is true)
    let displayValue: string | number = value;
    if (typeof value === 'number' && !showActualValue) {
        displayValue = formatNumber(value);
    } else if (typeof value === 'number' && showActualValue) {
        displayValue = value.toLocaleString('en-US');
    }
    
    return (
        <Card className="relative overflow-visible bg-gradient-to-br from-white via-slate-50/30 to-white rounded-xl shadow-lg border border-slate-200/50 hover:shadow-2xl hover:border-primary-300/50 transition-all duration-300 group h-full flex flex-col">
            {/* Decorative gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary-50/0 to-primary-100/0 group-hover:from-primary-50/30 group-hover:to-primary-100/20 transition-all duration-300 pointer-events-none"></div>
            
            <div className="relative p-4 sm:p-5 flex-1 flex flex-col min-w-0">
                <div className="flex items-start justify-between gap-3 mb-3 flex-shrink-0">
                    <div className={`p-2.5 sm:p-3 rounded-xl flex-shrink-0 shadow-lg group-hover:shadow-xl transition-all duration-300 ${color}`}>
                        <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                    </div>
                    {/* Optional badge or indicator */}
                    <div className="flex-shrink-0">
                        <div className="w-2 h-2 rounded-full bg-primary-400/50 group-hover:bg-primary-500 transition-colors"></div>
                    </div>
                </div>
                
                <div className="space-y-1.5 min-w-0 w-full flex-1 flex flex-col justify-end">
                    <p className="text-xs sm:text-sm font-semibold text-slate-500 uppercase tracking-wider leading-tight">
                        {title}
                    </p>
                    {isRevenue ? (
                        <div className="flex flex-col min-w-0 w-full">
                            <p className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-extrabold text-slate-900 leading-tight break-words hyphens-auto">
                                {value}
                            </p>
                            <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-0.5">
                                Platform Fee
                            </p>
                        </div>
                    ) : (
                        <p className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-extrabold text-slate-900 leading-tight break-words hyphens-auto">
                            {displayValue}
                        </p>
                    )}
                </div>
            </div>
            
            {/* Bottom accent bar */}
            <div className={`absolute bottom-0 left-0 right-0 h-1 ${color} opacity-60 group-hover:opacity-100 transition-opacity`}></div>
        </Card>
    );
}

import ErrorBoundary from '../ErrorBoundary';

const DashboardContent: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uniDistribution, setUniDistribution] = useState<{ university: string; tutors: number; tutees: number }[]>([]);
  const [userTypeTotals, setUserTypeTotals] = useState<{ tutors: number; tutees: number } | null>(null);
  const [courseDistribution, setCourseDistribution] = useState<{ courseName: string; tutors: number; tutees: number }[]>([]);
  const [subjectSessions, setSubjectSessions] = useState<{ subjectName: string; sessions: number }[]>([]);
  const [universityMap, setUniversityMap] = useState<Map<string, string>>(new Map());
  const [courseMap, setCourseMap] = useState<Map<string, string>>(new Map());
  const [payments, setPayments] = useState<Payment[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [monthsFilter, setMonthsFilter] = useState(6); // Default to 6 months

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get('/dashboard/stats');
        console.log('Dashboard stats response:', response.data);
        console.log('Total Revenue:', response.data?.totalRevenue);
        console.log('Payment Overview:', response.data?.paymentOverview);
        setStats(response.data);
      } catch (e) {
        setError('Failed to fetch dashboard statistics.');
        console.error('Dashboard fetch error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);


  useEffect(() => {
    const fetchPayouts = async () => {
      try {
        const response = await apiClient.get('/payments/payouts');
        // Filter to only include payouts with status "released" that have a payment_id reference
        const releasedPayouts = (response.data || []).filter((payout: any) => {
          return payout.status === 'released' && payout.payment_id != null;
        });
        setPayouts(releasedPayouts);
      } catch (e) {
        console.error('Failed to fetch payouts:', e);
      }
    };
    fetchPayouts();
  }, []);

  // Fetch payments to get payment amounts for released payouts
  useEffect(() => {
    const fetchPaymentsForPayouts = async () => {
      try {
        const response = await apiClient.get('/payments');
        setPayments(response.data || []);
      } catch (e) {
        console.error('Failed to fetch payments:', e);
      }
    };
    fetchPaymentsForPayouts();
  }, []);


  useEffect(() => {
    // Fetch universities to get acronyms
    const fetchUniversities = async () => {
      try {
        const response = await apiClient.get('/universities');
        const universities = response.data || [];
        const map = new Map<string, string>();
        universities.forEach((uni: any) => {
          if (uni.name && uni.acronym) {
            map.set(uni.name, uni.acronym);
          }
        });
        setUniversityMap(map);
      } catch (e) {
        console.error('Failed to fetch universities:', e);
      }
    };
    fetchUniversities();
  }, []);

  useEffect(() => {
    // Fetch courses to get acronyms
    const fetchCourses = async () => {
      try {
        const response = await apiClient.get('/courses');
        const courses = response.data || [];
        const map = new Map<string, string>();
        courses.forEach((course: any) => {
          if (course.course_name && course.acronym) {
            map.set(course.course_name, course.acronym);
          }
        });
        setCourseMap(map);
      } catch (e) {
        console.error('Failed to fetch courses:', e);
      }
    };
    fetchCourses();
  }, []);

  useEffect(() => {
    // Prefer data embedded in /dashboard/stats if backend provides it
    if (!stats) return;
    const uniRows = (stats as any).universityDistribution || [];
    if (Array.isArray(uniRows)) {
      const normalized = uniRows.map((r: any) => ({
        university: r.university || r.name || r.university_name || 'Unknown',
        tutors: Number(r.tutors ?? r.numTutors ?? r.tutorCount ?? 0),
        tutees: Number(r.tutees ?? r.numTutees ?? r.tuteeCount ?? 0)
      }));
      setUniDistribution(normalized);
    } else {
      setUniDistribution([]);
    }

    const totals = (stats as any).userTypeTotals;
    if (totals && (typeof totals === 'object')) {
      setUserTypeTotals({ tutors: Number(totals.tutors ?? totals.numTutors ?? 0), tutees: Number(totals.tutees ?? totals.numTutees ?? 0) });
    } else {
      setUserTypeTotals(null);
    }

    const courseRows = (stats as any).courseDistribution || [];
    if (Array.isArray(courseRows)) {
      const normalizedCourses = courseRows.map((r: any) => ({
        courseName: r.courseName || r.course || r.name || 'Unknown',
        tutors: Number(r.tutors ?? r.numTutors ?? r.tutorCount ?? 0),
        tutees: Number(r.tutees ?? r.numTutees ?? r.tuteeCount ?? 0)
      }));
      setCourseDistribution(normalizedCourses);
    } else {
      setCourseDistribution([]);
    }

    const subjectRows = (stats as any).subjectSessions || (stats as any).mostInDemandSubjects || [];
    if (Array.isArray(subjectRows)) {
      console.log('Subject rows from backend:', subjectRows);
      const normalizedSubjects = subjectRows.map((r: any) => {
        // Try multiple possible field names to get the subject name
        const subjectName = r.subjectName || r.subject || r.subject_name || r.name || null;
        console.log('Processing subject row:', r, 'Extracted name:', subjectName);
        
        // If we still don't have a name, log it for debugging
        if (!subjectName || subjectName === 'Unknown') {
          console.warn('Subject name not found for row:', r);
        }
        
        return {
          subjectName: subjectName || 'Unknown',
          sessions: Number(r.sessions ?? r.count ?? r.sessionsCount ?? 0)
        };
      }).filter(s => s.subjectName && s.subjectName !== 'Unknown'); // Filter out Unknown subjects
      
      console.log('Normalized subjects:', normalizedSubjects);
      setSubjectSessions(normalizedSubjects);
    } else {
      setSubjectSessions([]);
    }
  }, [stats]);

  const maxUniRow = useMemo(() => {
    return uniDistribution.reduce((m, r) => Math.max(m, r.tutors + r.tutees), 0);
  }, [uniDistribution]);

  const maxCourseRow = useMemo(() => {
    return courseDistribution.reduce((m, r) => Math.max(m, r.tutors + r.tutees), 0);
  }, [courseDistribution]);

  const maxSubjectSessions = useMemo(() => {
    return subjectSessions.reduce((m, r) => Math.max(m, r.sessions), 0);
  }, [subjectSessions]);

  // Prepare chart data for payment trends
  const paymentChartData = useMemo(() => {
    if (!stats?.paymentOverview?.trends) return [];
    
    return stats.paymentOverview.trends.map((trend) => ({
      month: trend.label,
      'Platform Revenue': trend.amount
    }));
  }, [stats]);

  // Calculate most-in-demand subjects from payments
  const mostDemandedSubjects = useMemo(() => {
    const subjectCounts: Record<string, number> = {};
    payments.forEach(payment => {
      // Try multiple sources for subject name:
      // 1. payment.subject.subject_name (if subject relation is loaded)
      // 2. payment.bookingRequest.subject (if bookingRequest relation is loaded)
      // 3. payment.subject (if it's a string directly)
      let subjectName: string | null = null;
      
      if ((payment as any).subject) {
        if (typeof (payment as any).subject === 'string') {
          subjectName = (payment as any).subject;
        } else if ((payment as any).subject.subject_name) {
          subjectName = (payment as any).subject.subject_name;
        }
      }
      
      if (!subjectName && (payment as any).bookingRequest) {
        if (typeof (payment as any).bookingRequest === 'object' && (payment as any).bookingRequest.subject) {
          subjectName = (payment as any).bookingRequest.subject;
        }
      }
      
      // Only count if we have a valid subject name
      if (subjectName && subjectName.trim() !== '') {
        subjectCounts[subjectName] = (subjectCounts[subjectName] || 0) + 1;
      }
    });
    return Object.entries(subjectCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
  }, [payments]);

  // Calculate total revenue: payment amount - amount_released (for released payouts only)
  // This represents the 13% platform fee
  const calculatedTotalRevenue = useMemo(() => {
    if (!payouts || payouts.length === 0 || !payments || payments.length === 0) {
      return 0;
    }
    
    // Create a map of payment_id to payment amount for quick lookup
    const paymentMap = new Map<number, number>();
    payments.forEach((p: any) => {
      const paymentId = p.payment_id || p.id;
      if (paymentId) {
        paymentMap.set(Number(paymentId), Number(p.amount || 0));
      }
    });
    
    // Calculate total revenue: sum of (payment amount - amount_released) for all released payouts
    const totalRevenue = payouts.reduce((sum, payout: any) => {
      const paymentId = payout.payment_id || (payout.payment as any)?.payment_id;
      if (!paymentId) return sum;
      
      const paymentAmount = paymentMap.get(Number(paymentId)) || 0;
      const amountReleased = Number(payout.amount_released || 0);
      
      // Platform revenue = payment amount - amount released (13% of payment)
      const platformRevenue = paymentAmount - amountReleased;
      
      return sum + platformRevenue;
    }, 0);
    
    return Number(totalRevenue.toFixed(2));
  }, [payouts, payments]);


  // Calculate payment activity overview (from released payouts only)
  const paymentActivity = useMemo(() => {
    if (!payouts || payouts.length === 0 || !payments || payments.length === 0) {
      return {
        totalPayments: 0,
        pendingPayments: 0,
        confirmedPayments: 0,
        rejectedPayments: 0,
        totalAmount: 0,
        confirmedAmount: 0
      };
    }
    
    // Create a map of payment_id to payment amount for quick lookup
    const paymentMap = new Map<number, number>();
    payments.forEach((p: any) => {
      const paymentId = p.payment_id || p.id;
      if (paymentId) {
        paymentMap.set(Number(paymentId), Number(p.amount || 0));
      }
    });
    
    // Calculate platform revenue from released payouts: payment amount - amount_released
    const platformRevenue = payouts.reduce((sum, payout: any) => {
      const paymentId = payout.payment_id || (payout.payment as any)?.payment_id;
      if (!paymentId) return sum;
      
      const paymentAmount = paymentMap.get(Number(paymentId)) || 0;
      const amountReleased = Number(payout.amount_released || 0);
      
      // Platform revenue = payment amount - amount released (13% of payment)
      return sum + (paymentAmount - amountReleased);
    }, 0);
    
    const totalPayments = payments.length;
    const pendingPayments = payments.filter(p => p.status === 'pending').length;
    const confirmedPayments = payments.filter(p => p.status === 'confirmed').length;
    const rejectedPayments = payments.filter(p => p.status === 'rejected').length;
    
    return {
      totalPayments,
      pendingPayments,
      confirmedPayments,
      rejectedPayments,
      totalAmount: Number(platformRevenue.toFixed(2)),
      confirmedAmount: Number(platformRevenue.toFixed(2))
    };
  }, [payouts, payments]);

  // Calculate payment trends chart data (from released payouts only)
  const paymentTrendsData = useMemo(() => {
    if (!payouts || payouts.length === 0 || !payments || payments.length === 0) {
      const lastNMonths = Array.from({ length: monthsFilter }, (_, i) => {
        const date = new Date();
        date.setMonth(date.getMonth() - (monthsFilter - 1 - i));
        return {
          month: date.toLocaleDateString('en-US', { month: 'short' }),
          'Platform Revenue': 0
        };
      });
      return lastNMonths;
    }
    
    // Create a map of payment_id to payment amount for quick lookup
    const paymentMap = new Map<number, number>();
    payments.forEach((p: any) => {
      const paymentId = p.payment_id || p.id;
      if (paymentId) {
        paymentMap.set(Number(paymentId), Number(p.amount || 0));
      }
    });
    
    const lastNMonths = Array.from({ length: monthsFilter }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (monthsFilter - 1 - i));
      return {
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        monthIndex: date.getMonth(),
        year: date.getFullYear()
      };
    });

    return lastNMonths.map(({ month, monthIndex, year }) => {
      // Filter released payouts for this month
      const monthPayouts = payouts.filter((payout: any) => {
        if (!payout.created_at) return false;
        const payoutDate = new Date(payout.created_at);
        return payoutDate.getMonth() === monthIndex && payoutDate.getFullYear() === year;
      });

      // Calculate platform revenue: payment amount - amount_released for each payout
      const platformRevenue = monthPayouts.reduce((sum, payout: any) => {
        const paymentId = payout.payment_id || (payout.payment as any)?.payment_id;
        if (!paymentId) return sum;
        
        const paymentAmount = paymentMap.get(Number(paymentId)) || 0;
        const amountReleased = Number(payout.amount_released || 0);
        
        // Platform revenue = payment amount - amount released (13% of payment)
        return sum + (paymentAmount - amountReleased);
      }, 0);

      return {
        month,
        'Platform Revenue': Number(platformRevenue.toFixed(2))
      };
    });
  }, [payouts, payments, monthsFilter]);

  const tutorGradient = 'linear-gradient(90deg, #6366f1, #8b5cf6)';
  const tuteeGradient = 'linear-gradient(90deg, #06b6d4, #22d3ee)';
  const positiveGradient = 'linear-gradient(90deg, #10b981, #34d399)';
  const barBaseClass = 'h-3 transition-[width] duration-700 ease-out';
  const cardLegend = (
    <div className="flex items-center gap-3 text-xs text-slate-600">
      <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: tutorGradient }} /> Tutors</span>
      <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: tuteeGradient }} /> Tutees</span>
    </div>
  );

  // ---------- Pie/Donut chart utilities (pure SVG, no lib) ----------
  const PIE_COLORS = [
    '#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#22c55e', '#0ea5e9', '#f97316', '#a78bfa'
  ];

  const buildTopN = <T,>(rows: T[], getLabel: (r: T)=>string, getValue: (r: T)=>number, topN = 6) => {
    const sorted = [...rows].sort((a, b) => getValue(b) - getValue(a));
    const top = sorted.slice(0, topN);
    const rest = sorted.slice(topN);
    const otherSum = rest.reduce((s, r) => s + getValue(r), 0);
    const items = top.map((r, i) => ({ label: getLabel(r), value: Math.max(0, getValue(r)), color: PIE_COLORS[i % PIE_COLORS.length] }));
    if (otherSum > 0) items.push({ label: 'Other', value: otherSum, color: '#cbd5e1' });
    const total = items.reduce((s, it) => s + it.value, 0) || 1;
    return { items, total };
  };

  const Donut: React.FC<{ items: { label: string; value: number; color: string }[]; size?: number; thickness?: number; total?: number; centerLabel?: string; centerSub?: string }>
    = ({ items, size = 200, thickness = 20, total, centerLabel, centerSub }) => {
    const r = (size / 2) - thickness / 2;
    const C = size / 2;
    const circumference = 2 * Math.PI * r;
    const sum = (total ?? items.reduce((s, x) => s + x.value, 0)) || 1;
    let offset = 0;
    const segments = items.map((it, idx) => {
      const frac = it.value / sum;
      const len = circumference * frac;
      const seg = (
        <circle
          key={idx}
          cx={C}
          cy={C}
          r={r}
          fill="transparent"
          stroke={it.color}
          strokeWidth={thickness}
          strokeDasharray={`${len} ${circumference - len}`}
          strokeDashoffset={-offset}
          strokeLinecap="butt"
          style={{ transition: 'stroke-dashoffset 700ms ease-out' }}
        />
      );
      offset += len;
      return seg;
    });
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#0f172a" floodOpacity="0.15" />
          </filter>
        </defs>
        <circle cx={C} cy={C} r={r} fill="transparent" stroke="#e2e8f0" strokeWidth={thickness} filter="url(#softShadow)" />
        {segments}
        {(centerLabel || centerSub) && (
          <>
            {centerLabel && (
              <text x={C} y={C} textAnchor="middle" dominantBaseline="central" fontSize={16} fontWeight={700} fill="#0f172a">
                {centerLabel}
              </text>
            )}
            {centerSub && (
              <text x={C} y={C + 16} textAnchor="middle" dominantBaseline="hanging" fontSize={11} fill="#475569">
                {centerSub}
              </text>
            )}
          </>
        )}
      </svg>
    );
  };

  if (loading) return <div>Loading dashboard...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -mr-20 -mt-20 blur-2xl"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full -ml-16 -mb-16 blur-2xl"></div>
        </div>
        <div className="relative">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 drop-shadow-lg">Admin Dashboard</h1>
          <p className="text-sm sm:text-base text-white/90">Overview of platform statistics and revenue</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-5 md:gap-6 auto-rows-fr">
        {stats && (
          <>
            <StatCard 
              icon={Users}
              title="Total Users"
              value={stats.totalUsers}
              color="bg-gradient-to-br from-blue-500 to-blue-600"
            />
            <StatCard 
              icon={UserCheck}
              title="Verified Tutors"
              value={stats.totalTutors}
              color="bg-gradient-to-br from-green-500 to-green-600"
            />
            <StatCard 
              icon={FileText}
              title="Pending Applications"
              value={stats.pendingApplications}
              color="bg-gradient-to-br from-yellow-500 to-yellow-600"
              showActualValue={true}
            />
            <StatCard 
              icon={PesoSignIcon}
              title="Total Revenue"
              value={`₱${calculatedTotalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              color="bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600"
            />
            <StatCard 
              icon={CheckCircle2}
              title="Confirmed Sessions"
              value={stats.confirmedSessions ?? 0}
              color="bg-gradient-to-br from-emerald-600 to-emerald-700"
              showActualValue={true}
            />
          </>
        )}
      </div>

      {/* Most-in-Demand Subjects and Payment Activity Overview */}
      <div className="mt-6 sm:mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Most-in-Demand Subjects */}
        <Card className="p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl shadow-lg">
              <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800">Most-in-Demand Subjects</h2>
          </div>
          <div className="space-y-3">
            {mostDemandedSubjects.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No subject data available</p>
            ) : (
              mostDemandedSubjects.map(([subject, count], index) => (
                <div key={subject} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-100 text-primary-700 font-bold text-sm">
                      {index + 1}
                    </div>
                    <span className="font-medium text-slate-900">{subject}</span>
                  </div>
                  <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-semibold">
                    {count} {count === 1 ? 'payment' : 'payments'}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Payment Activity Overview */}
        <Card className="p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl shadow-lg">
              <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-800">Platform Revenue Overview (From Released Payouts)</h2>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-600 font-semibold mb-1">Total Payments</p>
                <p className="text-lg sm:text-xl font-bold text-blue-900">{paymentActivity.totalPayments}</p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-xs text-yellow-600 font-semibold mb-1">Pending</p>
                <p className="text-lg sm:text-xl font-bold text-yellow-900">{paymentActivity.pendingPayments}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-xs text-green-600 font-semibold mb-1">Confirmed</p>
                <p className="text-lg sm:text-xl font-bold text-green-900">{paymentActivity.confirmedPayments}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="text-xs text-red-600 font-semibold mb-1">Rejected</p>
                <p className="text-lg sm:text-xl font-bold text-red-900">{paymentActivity.rejectedPayments}</p>
              </div>
            </div>
            <div className="pt-3 border-t border-slate-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-600">Platform Revenue (From Released Payouts)</span>
                <span className="text-base sm:text-lg font-bold text-slate-900">₱{paymentActivity.confirmedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Released Payouts Revenue</span>
                <span className="text-base sm:text-lg font-bold text-green-700">₱{paymentActivity.confirmedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Payment Trends */}
      <Card className="mt-4 sm:mt-6 mb-4 sm:mb-6 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl shadow-lg">
              <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-800">Platform Revenue Trends (From Released Payouts)</h2>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="months-filter" className="text-sm text-slate-600 font-medium">Display:</label>
            <select
              id="months-filter"
              value={monthsFilter}
              onChange={(e) => setMonthsFilter(Number(e.target.value))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            >
              <option value={3}>3 Months</option>
              <option value={6}>6 Months</option>
              <option value={12}>12 Months</option>
            </select>
          </div>
        </div>
        <div className="bg-white rounded-lg p-3 sm:p-4 border border-slate-200">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={paymentTrendsData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 11, fill: '#64748b' }}
                stroke="#cbd5e1"
              />
              <YAxis 
                tick={{ fontSize: 11, fill: '#64748b' }}
                stroke="#cbd5e1"
                tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                formatter={(value: number) => [`₱${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, '']}
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e2e8f0', 
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '12px'
                }}
              />
              <Legend 
                wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                iconType="rect"
              />
              <Bar dataKey="Platform Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* University distribution: tutors vs tutees */}
      <div className="mt-6 sm:mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <h2 className="text-lg sm:text-xl font-semibold truncate">Top Universities (Total Users)</h2>
            </div>
            <University className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400 flex-shrink-0" />
          </div>
          {uniDistribution.length > 0 ? (
            (() => {
              // Build items with acronyms included in labels
              const itemsWithAcronyms = uniDistribution
                .map(r => {
                  const acronym = universityMap.get(r.university);
                  const displayLabel = acronym ? `${r.university} (${acronym})` : r.university;
                  return {
                    ...r,
                    displayLabel,
                    value: r.tutors + r.tutees
                  };
                })
                .sort((a, b) => b.value - a.value)
                .slice(0, 6);
              
              const total = itemsWithAcronyms.reduce((sum, r) => sum + r.value, 0);
              const colors = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
              const items = itemsWithAcronyms.map((r, i) => ({
                label: r.displayLabel,
                value: r.value,
                color: colors[i % colors.length]
              }));
              
              return (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                  <div className="flex-shrink-0 mx-auto sm:mx-0">
                    <Donut items={items} size={180} centerLabel={String(total)} centerSub={'Total Users'} />
                  </div>
                  <div className="w-full sm:flex-1 space-y-2 min-w-0">
                    {items.map((it, i) => (
                      <div key={i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 sm:py-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="inline-block h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: it.color }} />
                          <span className="text-sm text-slate-900 font-medium break-words" title={it.label}>{it.label}</span>
                        </div>
                        <div className="flex items-center justify-end sm:justify-start gap-1.5 sm:ml-auto flex-shrink-0">
                          <span className="text-sm sm:text-base text-slate-700 font-semibold whitespace-nowrap">{it.value}</span>
                          <span className="text-xs sm:text-sm text-slate-400 font-normal whitespace-nowrap">({Math.round((it.value / (total || 1)) * 100)}%)</span>
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-slate-500 pt-1">Total: {total}</p>
                  </div>
                </div>
              );
            })()
          ) : (
            <p className="text-slate-500">No university distribution data.</p>
          )}
        </Card>

        {/* Overall user type totals */}
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-lg sm:text-xl font-semibold">Overall Users by Type</h2>
            <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400 flex-shrink-0" />
          </div>
          {userTypeTotals ? (
            (() => {
              const items = [
                { label: 'Approved Tutors', value: userTypeTotals.tutors, color: '#6366f1' },
                { label: 'Tutees', value: userTypeTotals.tutees, color: '#06b6d4' },
              ];
              const total = Math.max(1, items[0].value + items[1].value);
              return (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                  <div className="flex-shrink-0 mx-auto sm:mx-0">
                    <Donut items={items} size={180} centerLabel={String(total)} centerSub={'Users'} />
                  </div>
                  <div className="w-full sm:flex-1 space-y-2 min-w-0">
                    {items.map((it, i) => (
                      <div key={i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 sm:py-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="inline-block h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: it.color }} />
                          <span className="text-sm text-slate-900 font-medium">{it.label}</span>
                        </div>
                        <div className="flex items-center justify-end sm:justify-start gap-1.5 sm:ml-auto flex-shrink-0">
                          <span className="text-sm sm:text-base text-slate-700 font-semibold whitespace-nowrap">{it.value}</span>
                          <span className="text-xs sm:text-sm text-slate-400 font-normal whitespace-nowrap">({Math.round((it.value / total) * 100)}%)</span>
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-slate-500 pt-1">Total: {total}</p>
                  </div>
                </div>
              );
            })()
          ) : (
            <p className="text-slate-500">No user totals available.</p>
          )}
        </Card>
      </div>

      {/* Courses and Sessions Charts - Separated */}
      <div className="mt-6 sm:mt-8 grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {/* Top Courses Chart */}
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl shadow-lg">
                <Layers className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-800">Top Courses (Total Users)</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#6366f1' }}></div>
              <span className="text-xs sm:text-sm text-slate-600 font-medium">Total Users</span>
            </div>
          </div>
          
          {(() => {
            // Aggregate courses with the same name
            const aggregatedCourses = courseDistribution.reduce((acc, course) => {
              const courseName = course.courseName || 'Unknown';
              if (!acc[courseName]) {
                acc[courseName] = {
                  courseName: courseName,
                  tutors: 0,
                  tutees: 0
                };
              }
              acc[courseName].tutors += course.tutors || 0;
              acc[courseName].tutees += course.tutees || 0;
              return acc;
            }, {} as Record<string, { courseName: string; tutors: number; tutees: number }>);
            
            const aggregatedArray = Object.values(aggregatedCourses);
            const topCourses = buildTopN(aggregatedArray, (r: any) => r.courseName, (r: any) => (r.tutors + r.tutees), 10);
            
            if (topCourses.items.length === 0 || topCourses.total === 0) {
              return (
                <div className="text-center py-12">
                  <p className="text-slate-500">No course distribution data.</p>
                </div>
              );
            }
            
            const chartData = topCourses.items.map(item => {
              const courseName = item.label;
              const acronym = courseMap.get(courseName) || courseName;
              return {
                name: acronym.length > 20 ? acronym.substring(0, 20) + '...' : acronym,
                fullName: courseName,
                value: item.value,
              };
            });
            
            return (
              <div className="w-full">
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      stroke="#cbd5e1"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      stroke="#cbd5e1"
                      tickFormatter={(value) => formatNumber(value)}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
                              <p className="font-semibold text-slate-900 mb-2">{data.fullName}</p>
                              <p className="text-sm" style={{ color: payload[0].color }}>
                                <span className="font-medium">Total Users:</span>{' '}
                                <span className="font-bold">{data.value?.toLocaleString()}</span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="value"
                      name="Total Users"
                      fill="#6366f1"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={60}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill="#6366f1" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                
                {/* Summary Stat */}
                <div className="mt-6 pt-4 border-t border-slate-200">
                  <div className="bg-gradient-to-br from-primary-50 to-primary-100/50 rounded-lg p-4 border border-primary-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs sm:text-sm font-semibold text-primary-700 uppercase tracking-wider mb-1">
                          Total Course Users
                        </p>
                        <p className="text-2xl sm:text-3xl font-extrabold text-primary-900">
                          {formatNumber(topCourses.total)}
                        </p>
                      </div>
                      <Layers className="h-8 w-8 sm:h-10 sm:w-10 text-primary-400 opacity-60" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </Card>

        {/* Sessions per Subject Chart */}
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl shadow-lg">
                <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-800">Sessions per Subject</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-primary-600"></div>
              <span className="text-xs sm:text-sm text-slate-600 font-medium">Sessions</span>
            </div>
          </div>
          
          {(() => {
            const topSubjects = buildTopN(subjectSessions, (r: any) => r.subjectName, (r: any) => r.sessions, 10);
            
            if (topSubjects.items.length === 0 || topSubjects.total === 0) {
              return (
                <div className="text-center py-12">
                  <p className="text-slate-500">No subject sessions data.</p>
                </div>
              );
            }
            
            const chartData = topSubjects.items.map(item => ({
              name: item.label.length > 20 ? item.label.substring(0, 20) + '...' : item.label,
              fullName: item.label,
              value: item.value,
            }));
            
            return (
              <div className="w-full">
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      stroke="#cbd5e1"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      stroke="#cbd5e1"
                      tickFormatter={(value) => formatNumber(value)}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
                              <p className="font-semibold text-slate-900 mb-2">{data.fullName}</p>
                              <p className="text-sm" style={{ color: payload[0].color }}>
                                <span className="font-medium">Sessions:</span>{' '}
                                <span className="font-bold">{data.value?.toLocaleString()}</span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="value"
                      name="Sessions"
                      fill="#435de9"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={60}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill="#435de9" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                
                {/* Summary Stat */}
                <div className="mt-6 pt-4 border-t border-slate-200">
                  <div className="bg-gradient-to-br from-primary-100 to-primary-200/50 rounded-lg p-4 border border-primary-300">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs sm:text-sm font-semibold text-primary-800 uppercase tracking-wider mb-1">
                          Total Sessions
                        </p>
                        <p className="text-2xl sm:text-3xl font-extrabold text-primary-900">
                          {formatNumber(topSubjects.total)}
                        </p>
                      </div>
                      <TrendingUp className="h-8 w-8 sm:h-10 sm:w-10 text-primary-500 opacity-60" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </Card>
      </div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  return (
    <ErrorBoundary>
      <DashboardContent />
    </ErrorBoundary>
  );
};

export default Dashboard;
