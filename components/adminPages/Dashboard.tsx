import React, { useEffect, useState } from 'react';
import Card from '../ui/Card';
import apiClient from '../../services/api';
import { Users, UserCheck, FileText, CheckCircle2, TrendingUp, CreditCard } from 'lucide-react';
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
    </div>
  );
};

export default Dashboard;
