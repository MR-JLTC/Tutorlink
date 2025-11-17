import React, { useState } from 'react';
import apiClient from '../../services/api';

interface Props {
  open: boolean;
  bookingId: number;
  onClose: () => void;
  onSuccess?: () => void;
}

const RescheduleModal: React.FC<Props> = ({ open, bookingId, onClose, onSuccess }) => {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState<number | undefined>(undefined);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const notify = (window as any).__notify as ((msg: string, type?: 'success' | 'error' | 'info') => void) | undefined;

  const submit = async () => {
    if (!date || !time) {
      notify?.('Please select a date and time', 'error');
      return;
    }
    setLoading(true);
    try {
      const payload: any = {
        booking_id: bookingId,
        proposedDate: date,
        proposedTime: time,
      };
      if (duration) payload.proposedDuration = duration;
      if (reason) payload.reason = reason;

      const res = await apiClient.post('/reschedules', payload);
      if (!res.data?.success) {
        throw new Error(res.data?.message || 'Failed to send proposal');
      }
      notify?.('Reschedule proposal sent', 'success');
      onSuccess?.();
      onClose();
    } catch (e: any) {
      notify?.(e?.response?.data?.message || 'Failed to send proposal', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg max-w-lg w-full p-6">
        <h3 className="text-lg font-semibold mb-3">Propose reschedule</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 block w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium">Time</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1 block w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium">Duration (hours)</label>
            <input type="number" min={0.5} step={0.5} value={duration ?? ''} onChange={(e) => setDuration(e.target.value ? Number(e.target.value) : undefined)} className="mt-1 block w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium">Reason (optional)</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 block w-full border rounded px-3 py-2" rows={3} />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded bg-gray-100">Cancel</button>
          <button onClick={submit} disabled={loading} className="px-4 py-2 rounded bg-blue-600 text-white">{loading ? 'Sending...' : 'Send proposal'}</button>
        </div>
      </div>
    </div>
  );
};

export default RescheduleModal;
