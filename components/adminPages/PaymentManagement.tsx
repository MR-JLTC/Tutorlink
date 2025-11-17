import React, { useEffect, useState } from 'react';
import apiClient, { getFileUrl } from '../../services/api';
import { Payment } from '../../types';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import Card from '../ui/Card';
import { Upload } from 'lucide-react';

const PaymentManagement: React.FC = () => {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
    const [disputeStatus, setDisputeStatus] = useState<'none' | 'open' | 'under_review' | 'resolved' | 'rejected'>('none');
    const [adminNote, setAdminNote] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [verifyingId, setVerifyingId] = useState<number | null>(null);
    const [selectedPaymentForProof, setSelectedPaymentForProof] = useState<Payment | null>(null);
    const [adminProofFile, setAdminProofFile] = useState<File | null>(null);
    const [uploadingProof, setUploadingProof] = useState(false);
    const [showTutorQrModal, setShowTutorQrModal] = useState<Payment | null>(null);
    const [approveModalPayment, setApproveModalPayment] = useState<Payment | null>(null);
    const [approveProofFile, setApproveProofFile] = useState<File | null>(null);
    const [selectedProofModalPayment, setSelectedProofModalPayment] = useState<Payment | null>(null);
    const [rejectModalPayment, setRejectModalPayment] = useState<Payment | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

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

    const verify = async (paymentId: number, status: 'confirmed' | 'rejected', adminFile?: File | null, rejectionReasonText?: string) => {
        try {
            setVerifyingId(paymentId);
            const formData = new FormData();
            formData.append('status', status);
            
            // If approving and an admin proof file is provided, include it
            const adminProofToUse = adminFile ?? (status === 'confirmed' && approveModalPayment?.payment_id === paymentId ? approveProofFile : null);
            if (status === 'confirmed' && adminProofToUse) {
                formData.append('adminProof', adminProofToUse);
            }
            
            // If rejecting and a rejection reason is provided, include it
            if (status === 'rejected' && rejectionReasonText) {
                formData.append('rejection_reason', rejectionReasonText);
            }
            
            // Let the browser set the multipart Content-Type (including boundary).
            // Manually setting it can prevent the file from being sent correctly.
            await apiClient.patch(`/payments/${paymentId}/verify`, formData);
            
            const response = await apiClient.get('/payments');
            setPayments(response.data);
            setApproveModalPayment(null);
            setApproveProofFile(null);
            setRejectModalPayment(null);
            setRejectionReason('');
            setSelectedProofModalPayment(null);
        } finally {
            setVerifyingId(null);
        }
    };

    const handleApproveProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            alert('File size should be less than 5MB');
            return;
        }
        setApproveProofFile(file);
    };

    if (loading) return <div>Loading payments...</div>;
    if (error) return <div className="text-red-500">{error}</div>;

    const statusColors: { [key: string]: string } = {
        confirmed: 'bg-green-100 text-green-800',
        pending: 'bg-yellow-100 text-yellow-800',
        rejected: 'bg-red-100 text-red-800',
        refunded: 'bg-blue-100 text-blue-800',
    };

    const pendingCount = payments.filter(p => p.status === 'pending').length;

    return (
        <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Payment Management</h1>
                {pendingCount > 0 && (
                    <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                        {pendingCount} pending
                    </div>
                )}
            </div>
            <Card>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
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
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₱{Number(payment.amount).toFixed(2)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(payment.created_at).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[payment.status]}`}>
                                            {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className="inline-flex items-center gap-2">
                                            {/* <Button variant="secondary" onClick={() => { setSelectedPayment(payment); setDisputeStatus(payment.dispute_status || 'none'); setAdminNote(payment.admin_note || ''); }}>Dispute</Button> */}
                                                {/* View student's uploaded proof (opens modal) */}
                                                {payment.dispute_proof_url && (
                                                    <Button variant="secondary" onClick={() => { setSelectedProofModalPayment(payment); }}>View Proof</Button>
                                                )}
                                            {payment.status === 'pending' && (
                                                <>
                                                    <Button 
                                                        onClick={() => setApproveModalPayment(payment)} 
                                                        disabled={verifyingId === payment.payment_id}
                                                    >
                                                        Approve
                                                    </Button>
                                                    <Button variant="danger" onClick={() => setRejectModalPayment(payment)} disabled={verifyingId === payment.payment_id}>Reject</Button>
                                                </>
                                            )}
                                            {payment.status === 'confirmed' && (payment as any).admin_payment_proof_url && (
                                                <a 
                                                    href={getFileUrl((payment as any).admin_payment_proof_url)} 
                                                    target="_blank" 
                                                    rel="noreferrer"
                                                    className="text-xs text-green-600 hover:text-green-700 underline"
                                                >
                                                    View proof
                                                </a>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                    {payments.map((payment) => (
                        <Card key={payment.payment_id} className="p-4">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-slate-500">Payment ID</p>
                                        <p className="font-semibold text-slate-900">#{payment.payment_id}</p>
                                    </div>
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColors[payment.status]}`}>
                                        {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <p className="text-slate-500 text-xs mb-1">Student</p>
                                        <p className="font-medium text-slate-900 truncate">{payment.student?.user?.name || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500 text-xs mb-1">Tutor</p>
                                        <p className="font-medium text-slate-900 truncate">{payment.tutor?.user?.name || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <p className="text-slate-500 text-xs mb-1">Amount</p>
                                        <p className="font-medium text-slate-900">${Number(payment.amount).toFixed(2)}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500 text-xs mb-1">Date</p>
                                        <p className="font-medium text-slate-900">{new Date(payment.created_at).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
                                    {/* <Button 
                                        variant="secondary" 
                                        onClick={() => { setSelectedPayment(payment); setDisputeStatus(payment.dispute_status || 'none'); setAdminNote(payment.admin_note || ''); }} 
                                        className="text-xs flex-1 sm:flex-none"
                                    >
                                        Dispute
                                    </Button> */}
                                    {payment.dispute_proof_url && (
                                        <Button 
                                            variant="secondary" 
                                            onClick={() => { setSelectedProofModalPayment(payment); }} 
                                            className="text-xs flex-1 sm:flex-none"
                                        >
                                            View Proof
                                        </Button>
                                    )}
                                    {payment.status === 'pending' && (
                                        <>
                                            <Button 
                                                onClick={() => setApproveModalPayment(payment)} 
                                                disabled={verifyingId === payment.payment_id}
                                                className="text-xs flex-1 sm:flex-none"
                                            >
                                                Approve
                                            </Button>
                                            <Button 
                                                variant="danger" 
                                                onClick={() => setRejectModalPayment(payment)} 
                                                disabled={verifyingId === payment.payment_id}
                                                className="text-xs flex-1 sm:flex-none"
                                            >
                                                Reject
                                            </Button>
                                        </>
                                    )}
                                    {payment.status === 'confirmed' && (payment as any).admin_payment_proof_url && (
                                        <a 
                                            href={getFileUrl((payment as any).admin_payment_proof_url)} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="text-xs text-green-600 hover:text-green-700 underline flex-1 sm:flex-none text-center"
                                        >
                                            View proof
                                        </a>
                                    )}
                                </div>
                            </div>
                        </Card>
                    ))}
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

            {approveModalPayment && (
                <Modal 
                    isOpen={true} 
                    onClose={() => { setApproveModalPayment(null); setApproveProofFile(null); }} 
                    title={`Approve Payment #${approveModalPayment.payment_id}`}
                    footer={
                        <div className="flex items-center gap-2">
                            <Button variant="secondary" onClick={() => { setApproveModalPayment(null); setApproveProofFile(null); }}>Cancel</Button>
                            <Button 
                                onClick={() => verify(approveModalPayment.payment_id, 'confirmed')} 
                                disabled={verifyingId === approveModalPayment.payment_id || !approveProofFile}
                            >
                                Confirm Approve
                            </Button>
                        </div>
                    }
                >
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600">
                            Review the tutor's QR, then upload an admin proof screenshot to finalize approval.
                        </p>
                        {(approveModalPayment.tutor as any)?.gcash_qr_url ? (
                            <div className="flex justify-center">
                                <img 
                                    src={getFileUrl((approveModalPayment.tutor as any).gcash_qr_url)} 
                                    alt="Tutor GCash QR" 
                                    className="max-w-full h-auto border border-slate-200 rounded-lg"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300?text=QR+Not+Available';
                                    }}
                                />
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500 text-center py-4">Tutor has not uploaded a GCash QR code yet.</p>
                        )}
                        {(approveModalPayment.tutor as any)?.gcash_number && (
                            <p className="text-sm text-slate-600 text-center">
                                <strong>GCash Number:</strong> {(approveModalPayment.tutor as any).gcash_number}
                            </p>
                        )}
                        <div className="pt-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Upload Admin Proof</label>
                            <input type="file" accept="image/*" onChange={handleApproveProofChange} />
                            {approveProofFile && (
                                <div className="text-xs text-green-700 mt-1">Selected: {approveProofFile.name}</div>
                            )}
                            {!approveProofFile && (
                                <div className="text-xs text-red-600 mt-1">Proof is required to confirm approval.</div>
                            )}
                        </div>
                    </div>
                </Modal>
            )}

            {/* Reject Payment Modal */}
            {rejectModalPayment && (
                <Modal 
                    isOpen={true} 
                    onClose={() => { setRejectModalPayment(null); setRejectionReason(''); }} 
                    title={`Reject Payment #${rejectModalPayment.payment_id}`}
                    footer={
                        <div className="flex items-center gap-2">
                            <Button variant="secondary" onClick={() => { setRejectModalPayment(null); setRejectionReason(''); }}>Cancel</Button>
                            <Button 
                                variant="danger"
                                onClick={() => {
                                    if (!rejectionReason.trim()) {
                                        alert('Please provide a rejection reason');
                                        return;
                                    }
                                    verify(rejectModalPayment.payment_id, 'rejected', null, rejectionReason.trim());
                                }} 
                                disabled={verifyingId === rejectModalPayment.payment_id || !rejectionReason.trim()}
                            >
                                Confirm Reject
                            </Button>
                        </div>
                    }
                >
                    <div className="space-y-4">
                        <div className="text-sm text-slate-700">
                            <p><strong>Student:</strong> {rejectModalPayment.student?.user?.name || 'N/A'}</p>
                            <p><strong>Tutor:</strong> {rejectModalPayment.tutor?.user?.name || 'N/A'}</p>
                            <p><strong>Amount:</strong> ₱{Number(rejectModalPayment.amount).toFixed(2)}</p>
                            <p><strong>Subject:</strong> {(rejectModalPayment as any).subject || 'N/A'}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Rejection Reason <span className="text-red-500">*</span>
                            </label>
                            <textarea 
                                className="w-full border border-slate-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500" 
                                rows={4} 
                                value={rejectionReason} 
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Please provide a reason for rejecting this payment (e.g., Payment proof is unclear, Amount mismatch, etc.)"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                This reason will be shown to the student to help them understand why their payment was rejected.
                            </p>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Student proof modal: lets admin view the tutee-uploaded proof and Approve/Reject from the same modal */}
            {selectedProofModalPayment && (
                <Modal
                    isOpen={true}
                    onClose={() => { setSelectedProofModalPayment(null); }}
                    title={`Payment Proof #${selectedProofModalPayment.payment_id}`}
                >
                    <div className="space-y-4">
                        <div className="text-sm text-slate-700">
                            <p><strong>Student:</strong> {selectedProofModalPayment.student?.user?.name || 'N/A'}</p>
                            <p><strong>Tutor:</strong> {selectedProofModalPayment.tutor?.user?.name || 'N/A'}</p>
                            <p><strong>Amount:</strong> ₱{Number(selectedProofModalPayment.amount).toFixed(2)}</p>
                        </div>
                        <div className="flex justify-center">
                            <img src={getFileUrl((selectedProofModalPayment as any).dispute_proof_url || (selectedProofModalPayment as any).dispute_proof_url)} alt="Payment proof" className="max-h-[70vh] object-contain border rounded" onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400?text=No+Image'; }} />
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default PaymentManagement;
