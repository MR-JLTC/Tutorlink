import React, { useState, useEffect } from 'react';
import apiClient from '../../services/api';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { useAuth } from '../../hooks/useAuth';
import { DollarSign, TrendingUp, Clock, CheckCircle, Star, Calendar } from 'lucide-react';

interface Session {
  id: number;
  student_name: string;
  subject: string;
  date: string;
  duration: number;
  hourly_rate: number;
  total_amount: number;
  status: 'completed' | 'pending' | 'cancelled';
  payment_status: 'pending' | 'approved' | 'paid';
  created_at: string;
}

interface Payment {
  id: number;
  session_id: number;
  amount: number;
  status: 'pending' | 'approved' | 'paid';
  payment_date?: string;
  created_at: string;
}

interface EarningsStats {
  total_earnings: number;
  pending_earnings: number;
  completed_sessions: number;
  average_rating: number;
  total_hours: number;
}

const EarningsHistory: React.FC = () => {
  const { user } = useAuth();
  const [tutorId, setTutorId] = useState<number | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<EarningsStats>({
    total_earnings: 0,
    pending_earnings: 0,
    completed_sessions: 0,
    average_rating: 0,
    total_hours: 0
  });
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending'>('all');

  useEffect(() => {
    if (user?.user_id) {
      setTutorId(user.user_id);
      fetchEarningsData();
    }
  }, [user]);

  const fetchEarningsData = async () => {
    if (!tutorId) return;
    try {
      setLoading(true);
      const [sessionsRes, paymentsRes, statsRes] = await Promise.all([
        apiClient.get(`/tutors/${tutorId}/sessions`),
        apiClient.get(`/tutors/${tutorId}/payments`),
        apiClient.get(`/tutors/${tutorId}/earnings-stats`)
      ]);
      
      setSessions(sessionsRes.data);
      setPayments(paymentsRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to fetch earnings data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50 border-green-200';
      case 'pending': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'cancelled': return 'text-red-600 bg-red-50 border-red-200';
      case 'approved': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'paid': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'cancelled': return <X className="h-4 w-4" />;
      case 'approved': return <CheckCircle className="h-4 w-4" />;
      case 'paid': return <DollarSign className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const filteredSessions = sessions.filter(session => {
    if (filter === 'all') return true;
    return session.status === filter;
  });

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < Math.floor(rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'
        }`}
      />
    ));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading earnings data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Earnings & History</h1>
          <p className="text-slate-600">Track your completed sessions and earnings</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-full mr-4">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Earnings</p>
              <p className="text-2xl font-semibold text-gray-800">
                ₱{stats.total_earnings.toLocaleString()}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-full mr-4">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Pending Earnings</p>
              <p className="text-2xl font-semibold text-gray-800">
                ₱{stats.pending_earnings.toLocaleString()}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-full mr-4">
              <CheckCircle className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Completed Sessions</p>
              <p className="text-2xl font-semibold text-gray-800">{stats.completed_sessions}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-full mr-4">
              <Star className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Average Rating</p>
              <p className="text-2xl font-semibold text-gray-800">
                {stats.average_rating > 0 ? stats.average_rating.toFixed(1) : 'N/A'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-blue-600" />
            Performance Overview
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Total Hours Tutored</span>
              <span className="font-semibold text-slate-800">{stats.total_hours} hours</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Average Session Duration</span>
              <span className="font-semibold text-slate-800">
                {stats.completed_sessions > 0 
                  ? (stats.total_hours / stats.completed_sessions).toFixed(1) 
                  : '0'
                } hours
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Average Hourly Rate</span>
              <span className="font-semibold text-slate-800">
                ₱{stats.total_hours > 0 
                  ? (stats.total_earnings / stats.total_hours).toFixed(0) 
                  : '0'
                }
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Calendar className="h-5 w-5 mr-2 text-green-600" />
            Recent Payments
          </h2>
          <div className="space-y-3">
            {payments.slice(0, 5).map(payment => (
              <div key={payment.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="font-medium text-slate-800">
                    Session #{payment.session_id}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(payment.status)}`}>
                    <div className="flex items-center space-x-1">
                      {getStatusIcon(payment.status)}
                      <span>{payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}</span>
                    </div>
                  </span>
                </div>
                <span className="font-semibold text-slate-800">
                  ₱{payment.amount.toLocaleString()}
                </span>
              </div>
            ))}
            {payments.length === 0 && (
              <p className="text-slate-500 text-center py-4">No payments yet</p>
            )}
          </div>
        </Card>
      </div>

      {/* Session History */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Session History</h2>
          <div className="flex space-x-1">
            {[
              { key: 'all', label: 'All Sessions' },
              { key: 'completed', label: 'Completed' },
              { key: 'pending', label: 'Pending' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === tab.key
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {filteredSessions.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No sessions found</h3>
              <p className="text-gray-500">
                {filter === 'all' 
                  ? "You haven't completed any sessions yet."
                  : `No ${filter} sessions found.`
                }
              </p>
            </div>
          ) : (
            filteredSessions.map(session => (
              <div key={session.id} className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-slate-800">
                        {session.student_name}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(session.status)}`}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(session.status)}
                          <span>{session.status.charAt(0).toUpperCase() + session.status.slice(1)}</span>
                        </div>
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(session.payment_status)}`}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(session.payment_status)}
                          <span>{session.payment_status.charAt(0).toUpperCase() + session.payment_status.slice(1)}</span>
                        </div>
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
                      <div>
                        <p><strong>Subject:</strong> {session.subject}</p>
                        <p><strong>Date:</strong> {new Date(session.date).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p><strong>Duration:</strong> {session.duration} hours</p>
                        <p><strong>Rate:</strong> ₱{session.hourly_rate}/hour</p>
                      </div>
                      <div>
                        <p><strong>Total Amount:</strong> ₱{session.total_amount.toLocaleString()}</p>
                        <p><strong>Session ID:</strong> #{session.id}</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                  <div className="text-xs text-slate-500">
                    Session created on {new Date(session.created_at).toLocaleDateString()}
                  </div>
                  <div className="text-lg font-semibold text-slate-800">
                    ₱{session.total_amount.toLocaleString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};

export default EarningsHistory;