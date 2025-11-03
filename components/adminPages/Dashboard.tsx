import React, { useEffect, useMemo, useState } from 'react';
import Card from '../ui/Card';
import apiClient from '../../services/api';
import { Users, UserCheck, FileText, CheckCircle2, TrendingUp, CreditCard, University, BarChart3, Layers } from 'lucide-react';
import PesoSignIcon from '../icons/PesoSignIcon';

interface Stats {
  totalUsers: number;
  totalTutors: number;
  pendingApplications: number;
  totalRevenue: number;
  confirmedSessions: number;
  mostInDemandSubjects: { subjectId: number; subjectName: string; sessions: number }[];
  paymentOverview: { byStatus: Record<string, number>; recentConfirmedRevenue: number };
}

const StatCard: React.FC<{ icon: React.ElementType, title: string, value: string | number, color: string }> = ({ icon: Icon, title, value, color }) => {
    return (
        <Card className="flex items-center p-4">
            <div className={`p-3 rounded-full mr-4 ${color}`}>
                <Icon className="h-6 w-6 text-white" />
            </div>
            <div>
                <p className="text-sm font-medium text-gray-500">{title}</p>
                <p className="text-2xl font-semibold text-gray-800">{value}</p>
            </div>
        </Card>
    );
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uniDistribution, setUniDistribution] = useState<{ university: string; tutors: number; tutees: number }[]>([]);
  const [userTypeTotals, setUserTypeTotals] = useState<{ tutors: number; tutees: number } | null>(null);
  const [courseDistribution, setCourseDistribution] = useState<{ courseName: string; tutors: number; tutees: number }[]>([]);
  const [subjectSessions, setSubjectSessions] = useState<{ subjectName: string; sessions: number }[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get('/dashboard/stats');
        setStats(response.data);
      } catch (e) {
        setError('Failed to fetch dashboard statistics.');
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
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
      const normalizedSubjects = subjectRows.map((r: any) => ({
        subjectName: r.subjectName || r.subject || r.subject_name || r.name || 'Unknown',
        sessions: Number(r.sessions ?? r.count ?? r.sessionsCount ?? 0)
      }));
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
      <h1 className="text-3xl font-bold text-slate-800 mb-6">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
              title="Total Revenue"
              value={`₱${stats.totalRevenue.toLocaleString()}`}
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

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Most In-demand Subjects</h2>
            <TrendingUp className="h-5 w-5 text-slate-400" />
          </div>
          {stats && stats.mostInDemandSubjects && stats.mostInDemandSubjects.length > 0 ? (
            <ul className="divide-y divide-slate-200">
              {stats.mostInDemandSubjects.map((s) => (
                <li key={s.subjectId} className="py-3 flex items-center justify-between">
                  <span className="text-slate-700">{s.subjectName}</span>
                  <span className="text-slate-900 font-medium">{s.sessions} sessions</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-500">No subject data yet.</p>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Payment Activity Overview</h2>
            <CreditCard className="h-5 w-5 text-slate-400" />
          </div>
          {stats && stats.paymentOverview ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-500 mb-2">By status</p>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(stats.paymentOverview.byStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                      <span className="capitalize text-slate-700">{status}</span>
                      <span className="font-semibold text-slate-900">{count as number}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <p className="text-sm text-slate-500">Confirmed revenue (last 30 days)</p>
                <p className="text-2xl font-semibold text-slate-800">₱{stats.paymentOverview.recentConfirmedRevenue.toLocaleString()}</p>
              </div>
            </div>
          ) : (
            <p className="text-slate-500">No payment activity yet.</p>
          )}
        </Card>
      </div>

      {/* University distribution: tutors vs tutees */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold">Top Universities (Total Users)</h2>
            </div>
            <University className="h-5 w-5 text-slate-400" />
          </div>
          {uniDistribution.length > 0 ? (
            (() => {
              const { items, total } = buildTopN(uniDistribution, r => r.university, r => (r.tutors + r.tutees), 6);
              return (
                <div className="flex items-center gap-6 flex-wrap">
                  <Donut items={items} centerLabel={String(total)} centerSub={'Total Users'} />
                  <div className="min-w-[260px] space-y-2">
                    {items.map((it, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                        <span className="flex items-center gap-2 truncate"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: it.color }} /> <span className="truncate" title={it.label}>{it.label}</span></span>
                        <span className="text-slate-700 font-semibold">{it.value} <span className="text-slate-400 font-normal">({Math.round((it.value / (total || 1)) * 100)}%)</span></span>
                      </div>
                    ))}
                    <p className="text-xs text-slate-500">Total: {total}</p>
                  </div>
                </div>
              );
            })()
          ) : (
            <p className="text-slate-500">No university distribution data.</p>
          )}
        </Card>

        {/* Overall user type totals */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Overall Users by Type</h2>
            <BarChart3 className="h-5 w-5 text-slate-400" />
          </div>
          {userTypeTotals ? (
            (() => {
              const items = [
                { label: 'Approved Tutors', value: userTypeTotals.tutors, color: '#6366f1' },
                { label: 'Tutees', value: userTypeTotals.tutees, color: '#06b6d4' },
              ];
              const total = Math.max(1, items[0].value + items[1].value);
              return (
                <div className="flex items-center gap-6 flex-wrap">
                  <Donut items={items} centerLabel={String(total)} centerSub={'Users'} />
                  <div className="min-w-[260px] space-y-2">
                    {items.map((it, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                        <span className="flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: it.color }} /> {it.label}</span>
                        <span className="text-slate-700 font-semibold">{it.value} <span className="text-slate-400 font-normal">({Math.round((it.value / total) * 100)}%)</span></span>
                      </div>
                    ))}
                    <p className="text-xs text-slate-500">Total: {total}</p>
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
      <div className="mt-8 grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold">Top Courses (Total Users)</h2>
            </div>
            <Layers className="h-5 w-5 text-slate-400" />
          </div>
          {courseDistribution.length > 0 ? (
            (() => {
              const { items, total } = buildTopN(courseDistribution, r => r.courseName, r => (r.tutors + r.tutees), 10);
              return (
                <div className="flex items-start gap-6 flex-wrap">
                  <Donut items={items} size={220} thickness={22} centerLabel={String(total)} centerSub={'Users'} />
                  <div className="min-w-[360px] max-w-[520px] space-y-2 max-h-[260px] overflow-y-auto pr-1">
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
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Sessions per Subject</h2>
            <TrendingUp className="h-5 w-5 text-slate-400" />
          </div>
          {subjectSessions.length > 0 ? (
            (() => {
              const { items, total } = buildTopN(subjectSessions, r => r.subjectName, r => r.sessions, 8);
              return (
                <div className="flex items-center gap-6 flex-wrap">
                  <Donut items={items} size={220} thickness={22} centerLabel={String(total)} centerSub={'Sessions'} />
                  <div className="min-w-[300px] grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {items.map((it, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                        <span className="flex items-center gap-2 truncate"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: it.color }} /> <span className="truncate" title={it.label}>{it.label}</span></span>
                        <span className="text-slate-700 font-semibold">{it.value} <span className="text-slate-400 font-normal">({Math.round((it.value / (total || 1)) * 100)}%)</span></span>
                      </div>
                    ))}
                    <p className="text-xs text-slate-500">Total: {total}</p>
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

export default Dashboard;
