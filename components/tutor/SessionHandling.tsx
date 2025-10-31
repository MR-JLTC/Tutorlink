import React, { useState, useEffect } from 'react';
import apiClient from '../../services/api';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { useAuth } from '../../hooks/useAuth';
import { MessageSquare, Clock, CheckCircle, X, Eye, AlertCircle } from 'lucide-react';

interface BookingRequest {
  id: number;
  student_name: string;
  student_email: string;
  subject: string;
  date: string;
  time: string;
  duration: number;
  status: 'pending' | 'accepted' | 'declined' | 'awaiting_payment' | 'confirmed' | 'completed' | 'cancelled';
  payment_proof?: string;
  student_notes?: string;
  created_at: string;
}

const SessionHandling: React.FC = () => {
  const { user } = useAuth();
  const [tutorId, setTutorId] = useState<number | null>(null);
  const [bookingRequests, setBookingRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'awaiting_payment' | 'confirmed'>('all');

  useEffect(() => {
    if (user?.user_id) {
      // Resolve actual tutor_id for this user (tutor_id may differ from user_id)
      const resolveTutorIdAndFetch = async () => {
        try {
          const res = await apiClient.get(`/tutors/by-user/${user.user_id}/tutor-id`);
          const resolved = res.data?.tutor_id;
          if (resolved) {
            console.log('Resolved tutor_id for user', user.user_id, '->', resolved);
            setTutorId(resolved);
            await fetchBookingRequests(resolved);
            return;
          }
        } catch (err) {
          console.warn('Failed to resolve tutor id for user', user.user_id, err);
        }
        // Fallback to using user.user_id if resolver fails
        setTutorId(user.user_id);
        await fetchBookingRequests(user.user_id);
      };
      resolveTutorIdAndFetch();
    }
  }, [user]);

  const fetchBookingRequests = async (overrideTutorId?: number) => {
    const idToUse = overrideTutorId || tutorId;
    if (!idToUse) return;
    try {
      const response = await apiClient.get(`/tutors/${idToUse}/booking-requests`);
      const data = response.data || [];
      console.log('Fetched booking-requests raw for tutor', idToUse, ':', data);
      // Map backend booking entity shape to the UI-friendly shape expected below
      const mapped = (data as any[]).map(b => ({
        id: b.id,
        student_name: b.student?.name || (b.student_name as any) || 'Student',
        student_email: b.student?.email || (b.student_email as any) || '',
        subject: b.subject,
  date: b.date,
        time: b.time,
        duration: b.duration,
        status: b.status,
        payment_proof: b.payment_proof ? (b.payment_proof.startsWith('http') ? b.payment_proof : b.payment_proof) : undefined,
        student_notes: b.student_notes,
        created_at: b.created_at,
      })) as BookingRequest[];
      console.log('Mapped booking-requests:', mapped);
      setBookingRequests(mapped);
    } catch (error) {
      console.error('Failed to fetch booking requests:', error);
    }
  };

  const handleBookingAction = async (bookingId: number, action: 'accept' | 'decline') => {
    setLoading(true);
    try {
      await apiClient.post(`/tutors/booking-requests/${bookingId}/${action}`);
      fetchBookingRequests();
      alert(`Booking ${action}ed successfully!`);
    } catch (error) {
      console.error(`Failed to ${action} booking:`, error);
      alert(`Failed to ${action} booking. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentAction = async (bookingId: number, action: 'approve' | 'reject') => {
    setLoading(true);
    try {
      await apiClient.post(`/tutors/booking-requests/${bookingId}/payment-${action}`);
      fetchBookingRequests();
      alert(`Payment ${action}d successfully!`);
    } catch (error) {
      console.error(`Failed to ${action} payment:`, error);
      alert(`Failed to ${action} payment. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'accepted': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'declined': return 'text-red-600 bg-red-50 border-red-200';
      case 'awaiting_payment': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'confirmed': return 'text-green-600 bg-green-50 border-green-200';
      case 'completed': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'cancelled': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'accepted': return <CheckCircle className="h-4 w-4" />;
      case 'declined': return <X className="h-4 w-4" />;
      case 'awaiting_payment': return <AlertCircle className="h-4 w-4" />;
      case 'confirmed': return <CheckCircle className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'cancelled': return <X className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const filteredRequests = bookingRequests.filter(request => {
    if (filter === 'all') return true;
    return request.status === filter;
  });

  const stats = {
    total: bookingRequests.length,
    pending: bookingRequests.filter(r => r.status === 'pending').length,
    awaiting_payment: bookingRequests.filter(r => r.status === 'awaiting_payment').length,
    confirmed: bookingRequests.filter(r => r.status === 'confirmed').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Session Handling</h1>
          <p className="text-slate-600">Manage booking requests and payment confirmations</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg mr-3">
              <MessageSquare className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Requests</p>
              <p className="text-2xl font-semibold text-gray-800">{stats.total}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg mr-3">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Pending</p>
              <p className="text-2xl font-semibold text-gray-800">{stats.pending}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg mr-3">
              <AlertCircle className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Awaiting Payment</p>
              <p className="text-2xl font-semibold text-gray-800">{stats.awaiting_payment}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg mr-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Confirmed</p>
              <p className="text-2xl font-semibold text-gray-800">{stats.confirmed}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter Tabs */}
      <Card className="p-4">
        <div className="flex space-x-1">
          {[
            { key: 'all', label: 'All Requests' },
            { key: 'pending', label: 'Pending' },
            { key: 'awaiting_payment', label: 'Awaiting Payment' },
            { key: 'confirmed', label: 'Confirmed' }
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
      </Card>

      {/* Booking Requests */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <Card className="p-8 text-center">
            <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No booking requests</h3>
            <p className="text-gray-500">
              {filter === 'all' 
                ? "You haven't received any booking requests yet."
                : `No ${filter.replace('_', ' ')} requests found.`
              }
            </p>
          </Card>
        ) : (
          filteredRequests.map(request => (
            <Card key={request.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-slate-800">
                      {request.student_name}
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(request.status)}`}>
                      <div className="flex items-center space-x-1">
                        {getStatusIcon(request.status)}
                        <span>{request.status.replace('_', ' ').charAt(0).toUpperCase() + request.status.replace('_', ' ').slice(1)}</span>
                      </div>
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600">
                    <div>
                      <p><strong>Subject:</strong> {request.subject}</p>
                      <p><strong>Date:</strong> {new Date(request.date).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p><strong>Time:</strong> {request.time}</p>
                      <p><strong>Duration:</strong> {request.duration} hours</p>
                    </div>
                  </div>
                  
                  {request.student_notes && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-700">
                        <strong>Student Notes:</strong> {request.student_notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Proof Section */}
              {request.payment_proof && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-medium text-green-800 mb-2">Payment Proof Received</h4>
                  <div className="flex items-center space-x-3">
                    <img
                      src={request.payment_proof}
                      alt="Payment proof"
                      className="w-20 h-20 object-cover rounded border"
                    />
                    <div className="flex-1">
                      <p className="text-sm text-green-700">
                        Student has submitted payment proof. Please review and confirm.
                      </p>
                    </div>
                    <button
                      onClick={() => window.open(request.payment_proof, '_blank')}
                      className="flex items-center space-x-1 text-green-600 hover:text-green-700"
                    >
                      <Eye className="h-4 w-4" />
                      <span className="text-sm">View</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <div className="text-xs text-slate-500">
                  Requested on {new Date(request.created_at).toLocaleDateString()}
                </div>
                
                <div className="flex space-x-2">
                  {request.status === 'pending' && (
                    <>
                      <Button
                        onClick={() => handleBookingAction(request.id, 'accept')}
                        disabled={loading}
                        className="flex items-center space-x-1"
                      >
                        <CheckCircle className="h-4 w-4" />
                        <span>Accept</span>
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => handleBookingAction(request.id, 'decline')}
                        disabled={loading}
                        className="flex items-center space-x-1"
                      >
                        <X className="h-4 w-4" />
                        <span>Decline</span>
                      </Button>
                    </>
                  )}
                  
                  {request.status === 'awaiting_payment' && request.payment_proof && (
                    <>
                      <Button
                        onClick={() => handlePaymentAction(request.id, 'approve')}
                        disabled={loading}
                        className="flex items-center space-x-1"
                      >
                        <CheckCircle className="h-4 w-4" />
                        <span>Approve Payment</span>
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => handlePaymentAction(request.id, 'reject')}
                        disabled={loading}
                        className="flex items-center space-x-1"
                      >
                        <X className="h-4 w-4" />
                        <span>Reject Payment</span>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default SessionHandling;