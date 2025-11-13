import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient, { getFileUrl } from '../../services/api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface PaymentRow {
  id: number;
  payment_id: number;
  amount: number;
  status: string;
  created_at: string;
  student_name?: string;
  admin_payment_proof_url?: string;
  subject?: string | null;
}

const PaymentsHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofOpen, setProofOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [timeframe, setTimeframe] = useState<'all' | 'week' | 'month'>('all');

  useEffect(() => {
    const load = async () => {
      if (!user?.user_id) return;
      setLoading(true);
      try {
        const res = await apiClient.get(`/tutors/${user.user_id}/payments`);
        setPayments(res.data || []);
      } catch (e) {
        console.error('Failed to load payments history', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  // Debounce search input for smoother UX
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const filteredPayments = payments.filter(p => {
    // timeframe filter
    if (timeframe !== 'all') {
      const created = new Date(p.created_at).getTime();
      const now = Date.now();
      if (timeframe === 'week') {
        if (created < now - 7 * 24 * 60 * 60 * 1000) return false;
      } else if (timeframe === 'month') {
        if (created < now - 30 * 24 * 60 * 60 * 1000) return false;
      }
    }

    // search filter (live)
    if (debouncedQuery) {
      const name = (p.student_name || '').toLowerCase();
      if (!name.includes(debouncedQuery.toLowerCase())) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => navigate('/tutor-dashboard/earnings')}>
            <div className="flex items-center gap-2"><ArrowLeft className="h-4 w-4"/> Back</div>
          </Button>
          <h1 className="text-2xl font-bold">Payments history</h1>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <div className="flex items-center space-x-2">
            <button className={`px-3 py-1 rounded ${timeframe === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`} onClick={() => setTimeframe('all')}>All</button>
            <button className={`px-3 py-1 rounded ${timeframe === 'week' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`} onClick={() => setTimeframe('week')}>1 week</button>
            <button className={`px-3 py-1 rounded ${timeframe === 'month' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`} onClick={() => setTimeframe('month')}>1 month</button>
          </div>

          <div>
            <input type="search" placeholder="Search student name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="px-3 py-2 border rounded-lg w-64" />
          </div>
        </div>
      </div>

      <Card className="p-6">
        {loading ? (
          <div className="text-center py-6">Loading...</div>
        ) : filteredPayments.length === 0 ? (
          <div className="text-center py-6 text-slate-500">No payments found</div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-auto p-1">
            {filteredPayments.map(p => (
              <div key={p.payment_id} className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm hover:shadow-md transition">
                <div>
                  <div className="font-medium text-slate-800">{p.student_name || 'Student'}</div>
                  <div className="text-xs text-slate-500">ID #{p.payment_id} • {new Date(p.created_at).toLocaleString()}{p.subject ? ` • Subject: ${p.subject}` : ''}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-semibold">₱{Number(p.amount).toLocaleString()}</div>
                    <div className="text-xs text-slate-500">{p.status}</div>
                  </div>
                  {p.admin_payment_proof_url && (
                    <Button variant="secondary" onClick={() => { setProofUrl(getFileUrl(p.admin_payment_proof_url)); setProofOpen(true); }}>
                      View proof
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {proofOpen && proofUrl && (
        <Modal isOpen={proofOpen} onClose={() => setProofOpen(false)} title="Admin proof">
          <div className="flex justify-center">
            <img src={proofUrl} alt="Admin proof" className="max-w-full h-auto rounded" />
          </div>
        </Modal>
      )}
    </div>
  );
};

export default PaymentsHistoryPage;
