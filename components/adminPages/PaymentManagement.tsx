import React, { useEffect, useState } from 'react';
import apiClient from '../../services/api';
import { Payment } from '../../types';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import Card from '../ui/Card';

const PaymentManagement: React.FC = () => {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
    const [disputeStatus, setDisputeStatus] = useState<'none' | 'open' | 'under_review' | 'resolved' | 'rejected'>('none');
    const [adminNote, setAdminNote] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPayments = async () => {
            try {
                setLoading(true);
                const response = await apiClient.get('/payments');
                setPayments(response.data);
            } catch (e) {
                setError('Failed to fetch payments.');
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchPayments();
    }, []);

    if (loading) return <div>Loading payments...</div>;
    if (error) return <div className="text-red-500">{error}</div>;

    const statusColors: { [key: string]: string } = {
        confirmed: 'bg-green-100 text-green-800',
        pending: 'bg-yellow-100 text-yellow-800',
        rejected: 'bg-red-100 text-red-800',
        refunded: 'bg-blue-100 text-blue-800',
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-slate-800 mb-6">Payment Management</h1>
            <Card>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment ID</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tutor</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {payments.map((payment) => (
                                <tr key={payment.payment_id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">#{payment.payment_id}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{payment.student?.user?.name || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{payment.tutor?.user?.name || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${Number(payment.amount).toFixed(2)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(payment.created_at).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[payment.status]}`}>
                                            {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <Button variant="secondary" onClick={() => { setSelectedPayment(payment); setDisputeStatus(payment.dispute_status || 'none'); setAdminNote(payment.admin_note || ''); }}>Dispute</Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {selectedPayment && (
                <Modal isOpen={true} onClose={() => setSelectedPayment(null)} title={`Payment #${selectedPayment.payment_id} Dispute`}
                    footer={
                        <>
                            <Button variant="secondary" onClick={() => setSelectedPayment(null)}>Close</Button>
                            <Button onClick={async () => { await apiClient.patch(`/payments/${selectedPayment.payment_id}/dispute`, { dispute_status: disputeStatus, admin_note: adminNote }); setSelectedPayment(null); const res = await apiClient.get('/payments'); setPayments(res.data); }}>Save</Button>
                        </>
                    }
                >
                    <div className="space-y-4">
                        <div className="text-sm text-slate-700">
                            <p><strong>Student:</strong> {selectedPayment.student?.user?.name || 'N/A'}</p>
                            <p><strong>Tutor:</strong> {selectedPayment.tutor?.user?.name || 'N/A'}</p>
                            {selectedPayment.dispute_proof_url && (
                                <p className="mt-2">
                                    <strong>Proof:</strong> <a className="text-primary-600 hover:underline" href={selectedPayment.dispute_proof_url} target="_blank" rel="noreferrer">View attachment</a>
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Dispute Status</label>
                            <select className="mt-1 block w-full border border-slate-300 rounded-md px-3 py-2" value={disputeStatus} onChange={(e) => setDisputeStatus(e.target.value as any)}>
                                <option value="none">None</option>
                                <option value="open">Open</option>
                                <option value="under_review">Under Review</option>
                                <option value="resolved">Resolved</option>
                                <option value="rejected">Rejected</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Admin Note</label>
                            <textarea className="mt-1 block w-full border border-slate-300 rounded-md px-3 py-2" rows={4} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} />
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default PaymentManagement;
