import React, { useEffect, useMemo, useState } from 'react';
import Card from '../ui/Card';
import apiClient from '../../services/api';
import { Users, UserCheck, FileText, CheckCircle2, TrendingUp, CreditCard, University, BarChart3, Layers, BookOpen } from 'lucide-react';
import PesoSignIcon from '../icons/PesoSignIcon';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
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

const StatCard: React.FC<{ icon: React.ElementType, title: string, value: string | number, color: string }> = ({ icon: Icon, title, value, color }) => {
    return (
        <Card className="flex items-center p-3 sm:p-4">
            <div className={`p-2 sm:p-3 rounded-full mr-3 sm:mr-4 flex-shrink-0 ${color}`}>
                <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">{title}</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-800 truncate">{value}</p>
            </div>
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
    const fetchPayments = async () => {
      try {
        const response = await apiClient.get('/payments');
        setPayments(response.data || []);
      } catch (e) {
        console.error('Failed to fetch payments:', e);
      }
    };
    fetchPayments();
  }, []);

  useEffect(() => {
    const fetchPayouts = async () => {
      try {
        const response = await apiClient.get('/payments/payouts');
        setPayouts(response.data || []);
      } catch (e) {
        console.error('Failed to fetch payouts:', e);
      }
    };
    fetchPayouts();
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
      const subject = (payment as any).subject || 'Unknown';
      subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;
    });
    return Object.entries(subjectCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
  }, [payments]);

  // Calculate total revenue: 13% of payouts with status 'released'
  const calculatedTotalRevenue = useMemo(() => {
    // Filter only payouts with status='released'
    const releasedPayouts = payouts.filter(p => 
      p.status === 'released'
    );
    
    // Sum the amount_released and calculate 13%
    const totalAmount = releasedPayouts.reduce((sum, p) => sum + Number(p.amount_released || 0), 0);
    const totalRevenue = Number((totalAmount * 0.13).toFixed(2));
    
    return totalRevenue;
  }, [payouts]);

  // Calculate payment activity overview (13% of tutee payments)
  const paymentActivity = useMemo(() => {
    // Filter only payments with sender='tutee' (exclude null, empty, or other values)
    const tuteePayments = payments.filter(p => 
      (p as any).sender === 'tutee' && (p as any).sender !== null && (p as any).sender !== undefined
    );
    
    const totalPayments = tuteePayments.length;
    const pendingPayments = tuteePayments.filter(p => p.status === 'pending').length;
    const confirmedPayments = tuteePayments.filter(p => p.status === 'confirmed' || p.status === 'admin_confirmed' || p.status === 'admin_paid').length;
    const rejectedPayments = tuteePayments.filter(p => p.status === 'rejected').length;
    
    // Calculate 13% of total amount from tutee payments
    const totalAmount = Number((tuteePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0) * 0.13).toFixed(2));
    const confirmedAmount = Number((
      tuteePayments
        .filter(p => p.status === 'confirmed' || p.status === 'admin_confirmed' || p.status === 'admin_paid')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0) * 0.13
    ).toFixed(2));
    
    return {
      totalPayments,
      pendingPayments,
      confirmedPayments,
      rejectedPayments,
      totalAmount,
      confirmedAmount
    };
  }, [payments]);

  // Calculate payment trends chart data (13% of tutee payments)
  const paymentTrendsData = useMemo(() => {
    // Filter only payments with sender='tutee' (exclude null, empty, or other values)
    const tuteePayments = payments.filter(p => 
      (p as any).sender === 'tutee' && (p as any).sender !== null && (p as any).sender !== undefined
    );
    
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
      const monthPayments = tuteePayments.filter(p => {
        if (!p.created_at) return false;
        const paymentDate = new Date(p.created_at);
        return paymentDate.getMonth() === monthIndex && paymentDate.getFullYear() === year;
      });

      // Calculate 13% of amounts
      const totalAmount = Number((monthPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0) * 0.13).toFixed(2));
      const confirmedAmount = Number((
        monthPayments
          .filter(p => p.status === 'confirmed' || p.status === 'admin_confirmed' || p.status === 'admin_paid')
          .reduce((sum, p) => sum + Number(p.amount || 0), 0) * 0.13
      ).toFixed(2));
      const pendingAmount = Number((
        monthPayments
          .filter(p => p.status === 'pending')
          .reduce((sum, p) => sum + Number(p.amount || 0), 0) * 0.13
      ).toFixed(2));

      return {
        month,
        'Total': totalAmount,
        'Confirmed': confirmedAmount,
        'Pending': pendingAmount
      };
    });
  }, [payments, monthsFilter]);

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
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-4 sm:mb-6">Admin Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-6">
        {stats && (
          <>
            <StatCard 
              icon={Users}
              title="Total Users"
              value={stats.totalUsers}
              color="bg-blue-500"
            />
            <StatCard 
              icon={UserCheck}
              title="Verified Tutors"
              value={stats.totalTutors}
              color="bg-green-500"
            />
            <StatCard 
              icon={FileText}
              title="Pending Applications"
              value={stats.pendingApplications}
              color="bg-yellow-500"
            />
             <StatCard 
              icon={PesoSignIcon}
              title="Total Revenue (13% of Admin Payments)"
              value={`₱${calculatedTotalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              color="bg-indigo-500"
            />
            <StatCard 
              icon={CheckCircle2}
              title="Confirmed Sessions"
              value={stats.confirmedSessions ?? 0}
              color="bg-emerald-600"
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
            <h2 className="text-lg sm:text-xl font-bold text-slate-800">Platform Revenue Overview (13% of Tutee Payments)</h2>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-600 font-semibold mb-1">Total Payments</p>
                <p className="text-xl font-bold text-blue-900">{paymentActivity.totalPayments}</p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-xs text-yellow-600 font-semibold mb-1">Pending</p>
                <p className="text-xl font-bold text-yellow-900">{paymentActivity.pendingPayments}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-xs text-green-600 font-semibold mb-1">Confirmed</p>
                <p className="text-xl font-bold text-green-900">{paymentActivity.confirmedPayments}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="text-xs text-red-600 font-semibold mb-1">Rejected</p>
                <p className="text-xl font-bold text-red-900">{paymentActivity.rejectedPayments}</p>
              </div>
            </div>
            <div className="pt-3 border-t border-slate-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-600">Platform Revenue (13% of Tutee Payments)</span>
                <span className="text-lg font-bold text-slate-900">₱{paymentActivity.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Confirmed Revenue (13%)</span>
                <span className="text-lg font-bold text-green-700">₱{paymentActivity.confirmedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
            <h2 className="text-lg sm:text-xl font-bold text-slate-800">Platform Revenue Trends (13% of Tutee Payments)</h2>
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
              <Bar dataKey="Total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Confirmed" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Pending" fill="#f59e0b" radius={[4, 4, 0, 0]} />
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

      {/* Course distribution chart + Sessions per subject side-by-side */}
      <div className="mt-6 sm:mt-8 grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <h2 className="text-lg sm:text-xl font-semibold truncate">Top Courses (Total Users)</h2>
            </div>
            <Layers className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400 flex-shrink-0" />
          </div>
          {courseDistribution.length > 0 ? (
            (() => {
              const { items, total } = buildTopN(courseDistribution, r => r.courseName, r => (r.tutors + r.tutees), 10);
              return (
                <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
                  <div className="flex-shrink-0 mx-auto sm:mx-0">
                    <Donut items={items} size={180} thickness={20} centerLabel={String(total)} centerSub={'Users'} />
                  </div>
                  <div className="w-full sm:min-w-[280px] sm:max-w-[520px] space-y-2 max-h-[260px] overflow-y-auto pr-1">
                    {items.map((it, i) => (
                      <div key={i} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                        <span className="flex items-start gap-2 flex-1 min-w-0"><span className="mt-1 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: it.color }} /> <span className="whitespace-normal break-words" title={it.label}>{it.label}</span></span>
                        <span className="text-slate-700 font-semibold shrink-0">{it.value} <span className="text-slate-400 font-normal">({Math.round((it.value / (total || 1)) * 100)}%)</span></span>
                      </div>
                    ))}
                    <p className="text-xs text-slate-500">Total: {total}</p>
                  </div>
                </div>
              );
            })()
          ) : (
            <p className="text-slate-500">No course distribution data.</p>
          )}
        </Card>
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-lg sm:text-xl font-semibold">Sessions per Subject</h2>
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400 flex-shrink-0" />
          </div>
          {subjectSessions.length > 0 ? (
            (() => {
              const { items, total } = buildTopN(subjectSessions, r => r.subjectName, r => r.sessions, 8);
              return (
                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                  <div className="flex-shrink-0 mx-auto sm:mx-0">
                    <Donut items={items} size={180} thickness={20} centerLabel={String(total)} centerSub={'Sessions'} />
                  </div>
                  <div className="w-full sm:min-w-[300px] space-y-2">
                    {items.map((it, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
                        <span className="flex items-center gap-2 min-w-0 flex-1"><span className="inline-block h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: it.color }} /> <span className="break-words whitespace-normal font-medium text-slate-800" title={it.label}>{it.label}</span></span>
                        <span className="text-slate-700 font-semibold flex-shrink-0 ml-2 whitespace-nowrap">{it.value} <span className="text-slate-400 font-normal">({Math.round((it.value / (total || 1)) * 100)}%)</span></span>
                      </div>
                    ))}
                    <p className="text-xs text-slate-500 pt-1">Total: {total}</p>
                  </div>
                </div>
              );
            })()
          ) : (
            <p className="text-slate-500">No subject sessions data.</p>
          )}
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
