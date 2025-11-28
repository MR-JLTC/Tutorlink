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

    // Hide payments that are already confirmed
    if (p.status === 'confirmed') return false;
    return true;
  });

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 text-white shadow-lg -mx-2 sm:-mx-3 md:mx-0">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="secondary" onClick={() => navigate('/tutor-dashboard/earnings')} className="text-xs sm:text-sm !px-2 sm:!px-3 !py-1 sm:!py-1.5 bg-white/20 hover:bg-white/30 text-white border-white/30">
              <div className="flex items-center gap-1 sm:gap-1.5"><ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4"/> <span className="hidden sm:inline">Back</span></div>
            </Button>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">Payments history</h1>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <div className="flex items-center space-x-1 sm:space-x-2">
              <button className={`px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-medium transition-colors touch-manipulation ${timeframe === 'all' ? 'bg-white text-blue-600 shadow-md' : 'bg-white/20 text-white hover:bg-white/30'}`} onClick={() => setTimeframe('all')} style={{ WebkitTapHighlightColor: 'transparent' }}>All</button>
              <button className={`px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-medium transition-colors touch-manipulation ${timeframe === 'week' ? 'bg-white text-blue-600 shadow-md' : 'bg-white/20 text-white hover:bg-white/30'}`} onClick={() => setTimeframe('week')} style={{ WebkitTapHighlightColor: 'transparent' }}>1 week</button>
              <button className={`px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-medium transition-colors touch-manipulation ${timeframe === 'month' ? 'bg-white text-blue-600 shadow-md' : 'bg-white/20 text-white hover:bg-white/30'}`} onClick={() => setTimeframe('month')} style={{ WebkitTapHighlightColor: 'transparent' }}>1 month</button>
            </div>

            <div className="w-full sm:w-auto flex-1 sm:flex-none">
              <input type="search" placeholder="Search student name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="px-3 py-2 border-0 rounded-lg w-full sm:w-64 text-sm bg-white/90 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-white/50" />
            </div>
          </div>
        </div>
      </div>

      <Card className="p-4 sm:p-6">
        {loading ? (
          <div className="text-center py-6 text-sm sm:text-base">Loading...</div>
        ) : filteredPayments.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-sm sm:text-base">No payments found</div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-auto p-1">
            {filteredPayments.map(p => (
              <div key={p.payment_id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 p-3 bg-white border rounded-lg shadow-sm hover:shadow-md transition">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm sm:text-base text-slate-800 break-words">{p.student_name || 'Student'}</div>
                  <div className="text-xs text-slate-500 break-words">ID #{p.payment_id} • {new Date(p.created_at).toLocaleString()}{p.subject ? ` • Subject: ${p.subject}` : ''}</div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                  <div className="text-left sm:text-right">
                    <div className="text-sm font-semibold">₱{Number(p.amount).toLocaleString()}</div>
                    <div className="text-xs text-slate-500">{p.status}</div>
                  </div>
                  {p.admin_payment_proof_url && (
                    <Button variant="secondary" onClick={() => { setProofUrl(getFileUrl(p.admin_payment_proof_url)); setProofOpen(true); }} className="text-xs sm:text-sm w-full sm:w-auto">
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
