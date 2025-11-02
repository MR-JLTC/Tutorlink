import React, { useEffect, useState } from 'react';
import apiClient from '../../services/api';
import { Tutor, TutorSubject } from '../../types';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { Check, X, FileText, User, Mail, School, Book, Clock } from 'lucide-react';
import { getFileUrl } from '../../services/api';

const TutorManagement: React.FC = () => {
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTutor, setSelectedTutor] = useState<Tutor | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewType, setPreviewType] = useState<string>('');
  
  // Tutor subject states
  const [tutorSubjects, setTutorSubjects] = useState<TutorSubject[]>([]);
  const [subjectLoading, setSubjectLoading] = useState(true);
  const [selectedTutorSubject, setSelectedTutorSubject] = useState<TutorSubject | null>(null);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [isSubjectUpdating, setIsSubjectUpdating] = useState(false);
  const [adminNotes, setAdminNotes] = useState<string>('');
  const [tutorRejectionNotes, setTutorRejectionNotes] = useState<string>('');
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [pendingRejectionAction, setPendingRejectionAction] = useState<(() => void) | null>(null);

  const fetchTutors = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/tutors/applications');
      setTutors(response.data);
    } catch (e) {
      setError('Failed to fetch tutor applications.');
      console.error(e);
      const notify = (window as any).__notify as ((msg: string, type?: 'success' | 'error' | 'info') => void) | undefined;
      if (notify) notify('Unable to load tutor applications. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchTutorSubjects = async () => {
    try {
      setSubjectLoading(true);
      const response = await apiClient.get('/tutors/pending-subjects');
      setTutorSubjects(response.data);
    } catch (e) {
      console.error('Failed to fetch tutor subjects:', e);
      const notify = (window as any).__notify as ((msg: string, type?: 'success' | 'error' | 'info') => void) | undefined;
      if (notify) notify('Unable to load tutor subjects. Please try again.', 'error');
    } finally {
      setSubjectLoading(false);
    }
  };

  useEffect(() => {
    fetchTutors();
    fetchTutorSubjects();
  }, []);
  
  const handleViewDetails = (tutor: Tutor) => {
    setSelectedTutor(tutor);
    setIsModalOpen(true);
  };

  const handleStatusUpdate = async (status: 'approved' | 'rejected') => {
    if (!selectedTutor) return;
    
    // If rejecting, show modal to collect rejection reason
    if (status === 'rejected') {
      setTutorRejectionNotes('');
      // Create action that will read tutorRejectionNotes from state when executed
      setPendingRejectionAction(() => async () => {
        // Read current state value when button is clicked, not when closure is created
        await performStatusUpdate(status);
      });
      setShowRejectionModal(true);
      return;
    }
    
    // For approval, proceed directly
    await performStatusUpdate(status);
  };

  const performStatusUpdate = async (status: 'approved' | 'rejected', rejectionNotes?: string) => {
    if (!selectedTutor) return;
    setIsUpdating(true);
    try {
      // Prepare adminNotes: For rejected status, this will be saved to tutors.admin_notes database column
      let adminNotes: string | undefined = undefined;
      if (status === 'rejected') {
        // Use rejectionNotes parameter if provided, otherwise fall back to state
        const notesToUse = rejectionNotes !== undefined ? rejectionNotes : tutorRejectionNotes.trim();
        if (notesToUse.length > 0) {
          adminNotes = notesToUse;
          console.log(`[Frontend] Admin rejection reason entered: "${adminNotes}"`);
          console.log(`[Frontend] This will be stored in tutors.admin_notes database column`);
        } else {
          console.error(`[Frontend] ERROR: Rejecting without admin notes - modal validation should prevent this!`);
          alert('Please provide a rejection reason before confirming.');
          setIsUpdating(false);
          return;
        }
      }
      
      console.log(`[Frontend] Sending PATCH request to update tutor ${selectedTutor.tutor_id} status to '${status}'`);
      console.log(`[Frontend] Admin notes being sent to backend (will be saved to tutors.admin_notes):`, adminNotes || 'undefined');
      
      // Send request to backend - adminNotes will be saved to tutors.admin_notes database column
      await apiClient.patch(`/tutors/${selectedTutor.tutor_id}/status`, { 
        status,
        adminNotes: adminNotes // This will be saved to tutors.admin_notes column in database
      });

      // If rejecting, automatically reject all pending subject applications
      if (status === 'rejected') {
        try {
          // Fetch all subject applications for this tutor
          const subjectAppsResponse = await apiClient.get(`/tutors/${selectedTutor.tutor_id}/subject-applications`);
          const subjectApplications = subjectAppsResponse.data || [];
          
          // Filter for pending applications and reject them
          const pendingSubjects = subjectApplications.filter((app: any) => app.status === 'pending');
          
          if (pendingSubjects.length > 0) {
            // Create rejection note that explains the main application was rejected
            const mainRejectionReason = adminNotes ? adminNotes : 'No specific reason provided';
            const rejectionNote = `Automatically rejected: Main tutor application was rejected. Reason: ${mainRejectionReason}`;
            
            // Reject each pending subject application
            const rejectionPromises = pendingSubjects.map((subjectApp: any) =>
              apiClient.patch(`/tutors/tutor-subjects/${subjectApp.id}/status`, {
                status: 'rejected',
                adminNotes: rejectionNote
              })
            );
            
            await Promise.all(rejectionPromises);
            console.log(`Automatically rejected ${pendingSubjects.length} pending subject application(s) for tutor ${selectedTutor.tutor_id}`);
          }
        } catch (subjectError) {
          console.error('Failed to auto-reject subject applications:', subjectError);
          // Don't fail the whole operation if subject rejection fails
          // Log it but continue with the main rejection
        }
      }

      setIsModalOpen(false);
      setShowRejectionModal(false);
      setTutorRejectionNotes('');
      // Refetch tutors and tutor subjects to update the lists
      await fetchTutors();
      await fetchTutorSubjects();
      const notify = (window as any).__notify as ((msg: string, type?: 'success' | 'error' | 'info') => void) | undefined;
      if (notify) notify(`Application ${status === 'approved' ? 'approved' : 'rejected'} successfully.${status === 'rejected' ? ' All pending subject applications have also been rejected.' : ''}`, 'success');
    } catch (err) {
      console.error("Failed to update status", err);
      const notify = (window as any).__notify as ((msg: string, type?: 'success' | 'error' | 'info') => void) | undefined;
      if (notify) notify('Failed to update application status. Please try again.', 'error');
    } finally {
        setIsUpdating(false);
    }
  };

  // Tutor subject handlers
  const handleViewSubjectDetails = (tutorSubject: TutorSubject) => {
    setSelectedTutorSubject(tutorSubject);
    setAdminNotes(tutorSubject.admin_notes || '');
    setIsSubjectModalOpen(true);
  };

  const handleSubjectStatusUpdate = async (status: 'approved' | 'rejected') => {
    if (!selectedTutorSubject) return;
    setIsSubjectUpdating(true);
    try {
      await apiClient.patch(`/tutors/tutor-subjects/${selectedTutorSubject.tutor_subject_id}/status`, { 
        status, 
        adminNotes: adminNotes.trim() || undefined 
      });
      setIsSubjectModalOpen(false);
      setAdminNotes('');
      // Refetch tutor subjects to update the list
      await fetchTutorSubjects();
      const notify = (window as any).__notify as ((msg: string, type?: 'success' | 'error' | 'info') => void) | undefined;
      if (notify) notify(`Tutor subject ${status === 'approved' ? 'approved' : 'rejected'} successfully.`, 'success');
    } catch (err) {
      console.error("Failed to update tutor subject status", err);
      const notify = (window as any).__notify as ((msg: string, type?: 'success' | 'error' | 'info') => void) | undefined;
      if (notify) notify('Failed to update tutor subject status. Please try again.', 'error');
    } finally {
      setIsSubjectUpdating(false);
    }
  };

  const handleOpenDocument = (fileUrl: string, fileType?: string) => {
    const normalizedType = (fileType || '').toLowerCase();
    if (normalizedType.startsWith('image/') || normalizedType === 'application/pdf') {
      setPreviewUrl(fileUrl);
      setPreviewType(normalizedType);
      setIsPreviewOpen(true);
      return;
    }
    // Fallback: try extension-based handling
    const lower = fileUrl.toLowerCase();
    if (lower.endsWith('.pdf')) {
      setPreviewUrl(fileUrl);
      setPreviewType('application/pdf');
      setIsPreviewOpen(true);
      return;
    }
    if (/(\.png|\.jpg|\.jpeg|\.gif|\.webp)$/.test(lower)) {
      setPreviewUrl(fileUrl);
      setPreviewType('image/*');
      setIsPreviewOpen(true);
      return;
    }
    // As a last resort, open in new tab
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
  };


  if (loading) return <div>Loading applications...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-800 mb-6">Tutor Application Management</h1>
      
      <Card>
        <h2 className="text-xl font-semibold mb-4">Pending Applications ({tutors.length})</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">University</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tutors.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-500">No pending applications found.</td>
                </tr>
              ) : (
                tutors.map((tutor) => (
                  <tr key={tutor.tutor_id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <div className="flex items-center gap-3">
                        {tutor.user?.profile_image_url ? (
                          <img 
                            src={getFileUrl(tutor.user.profile_image_url)} 
                            alt="Tutor" 
                            className="h-8 w-8 rounded-full object-cover border flex-shrink-0"
                            style={{ aspectRatio: '1 / 1' }}
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-slate-200 border flex-shrink-0" />
                        )}
                        <span className="truncate max-w-[200px]">{tutor.user?.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{(tutor as any).university?.name || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{(tutor as any).course?.course_name || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex justify-center">
                        <Button onClick={() => handleViewDetails(tutor)}>View Details</Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Tutor Subjects Section */}
      <Card className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Pending Subject Expertise ({tutorSubjects.length})</h2>
        {subjectLoading ? (
          <div className="text-center py-4">Loading tutor subjects...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tutor</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applied Date</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tutorSubjects.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">No pending subject expertise found.</td>
                  </tr>
                ) : (
                  tutorSubjects.map((tutorSubject) => (
                    <tr key={tutorSubject.tutor_subject_id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div className="flex items-center gap-3">
                          {(tutorSubject.tutor.user as any)?.profile_image_url ? (
                            <img 
                              src={getFileUrl((tutorSubject.tutor.user as any).profile_image_url)} 
                              alt="Tutor" 
                              className="h-8 w-8 rounded-full object-cover border flex-shrink-0"
                              style={{ aspectRatio: '1 / 1' }}
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-slate-200 border flex-shrink-0" />
                          )}
                          <span className="truncate max-w-[200px]">{(tutorSubject.tutor as any)?.user?.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {(tutorSubject.subject as any)?.subject_name}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(tutorSubject.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <div className="flex justify-center">
                          <Button onClick={() => handleViewSubjectDetails(tutorSubject)}>View Details</Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selectedTutor && (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Application Details`}
          footer={
            <div className="flex flex-row items-center justify-end gap-2 flex-wrap sm:flex-nowrap">
              <Button
                onClick={() => handleStatusUpdate('rejected')}
                variant="danger"
                disabled={isUpdating}
                className="flex items-center"
              >
                <X className="mr-2 h-4 w-4" />
                {isUpdating ? 'Rejecting...' : 'Reject'}
              </Button>
              <Button
                onClick={() => handleStatusUpdate('approved')}
                variant="primary"
                disabled={isUpdating}
                className="flex items-center"
              >
                <Check className="mr-2 h-4 w-4" />
                {isUpdating ? 'Approving...' : 'Approve'}
              </Button>
            </div>
          }
        >
          <div className="space-y-6 max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100 hover:scrollbar-thumb-slate-400 pr-2">
            {/* Header */}
            <div>
              <h3 className="text-xl font-semibold text-slate-800">{selectedTutor.user?.name}</h3>
              <p className="text-sm text-slate-500">{selectedTutor.user?.email}</p>
            </div>

            {/* Content grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                {selectedTutor.user?.profile_image_url && (
                  <div>
                    <h4 className="font-semibold">Profile Image</h4>
                    <div className="mt-2">
                      <div className="h-32 w-32 rounded-full overflow-hidden border-4 border-white shadow-lg bg-slate-100">
                        <img src={getFileUrl(selectedTutor.user.profile_image_url)} alt="Tutor Profile" className="w-full h-full object-cover" style={{aspectRatio: '1/1'}} />
                      </div>
                    </div>
                  </div>
                )}
                <div>
                  <h4 className="font-semibold">University & Course</h4>
                  <div className="mt-2 space-y-1">
                    <div className="bg-gray-50 p-2 rounded-md">
                      <span className="text-xs text-gray-500">University:</span>
                      <p className="text-gray-700 font-medium">{(selectedTutor as any).university?.name || 'Not specified'}</p>
                    </div>
                    <div className="bg-gray-50 p-2 rounded-md">
                      <span className="text-xs text-gray-500">Course:</span>
                      <p className="text-gray-700 font-medium">{(selectedTutor as any).course?.course_name || 'Not specified'}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold">Bio</h4>
                  <p className="text-gray-700 bg-gray-50 p-3 rounded-md mt-1 min-h-[72px]">{selectedTutor.bio || 'No bio provided.'}</p>
                </div>
                <div>
                  <h4 className="font-semibold">Expert Subjects</h4>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedTutor.subjects?.length ? selectedTutor.subjects.map((ts) => (
                      <span key={(ts as any).tutor_subject_id} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">{(ts as any).subject?.subject_name}</span>
                    )) : <span className="text-sm text-gray-500">No subjects submitted.</span>}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold">Submitted Documents</h4>
                  <ul className="mt-2 space-y-2">
                    {selectedTutor.documents?.length ? selectedTutor.documents.map(doc => (
                      <li key={doc.document_id} className="flex items-center justify-between bg-gray-50 rounded p-2">
                        <div className="flex items-center min-w-0">
                          <FileText className="h-5 w-5 mr-2 text-primary-600 flex-shrink-0"/>
                          <button
                            type="button"
                            onClick={() => handleOpenDocument(getFileUrl(doc.file_url), (doc as any).file_type)}
                            className="text-primary-600 hover:underline truncate text-left"
                            title="Open file"
                          >
                            {doc.file_name}
                          </button>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                          <button
                            type="button"
                            onClick={() => handleOpenDocument(getFileUrl(doc.file_url), (doc as any).file_type)}
                            className="text-sm text-slate-600 hover:text-slate-900"
                          >
                            Open
                          </button>
                          <a href={getFileUrl(doc.file_url)} download className="text-sm text-slate-600 hover:text-slate-900">Download</a>
                        </div>
                      </li>
                    )) : <li className="text-sm text-gray-500">No documents uploaded.</li>}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold">Availability</h4>
                  <ul className="mt-2 grid grid-cols-1 gap-2 text-sm">
                    {selectedTutor.availabilities?.length ? selectedTutor.availabilities.map((a) => (
                      <li key={(a as any).availability_id} className="flex justify-between bg-gray-50 p-2 rounded">
                        <span className="font-medium">{(a as any).day_of_week}</span>
                        <span className="text-gray-700">{(a as any).start_time} - {(a as any).end_time}</span>
                      </li>
                    )) : <li className="text-gray-500">No availability submitted.</li>}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Tutor Subject Modal */}
      {selectedTutorSubject && (
          <Modal 
            isOpen={isSubjectModalOpen} 
            onClose={() => {
              setIsSubjectModalOpen(false);
              setAdminNotes('');
            }} 
            title="Subject Expertise Details"
            footer={
              <div className="flex items-center justify-end gap-2">
                <Button
                  onClick={() => handleSubjectStatusUpdate('rejected')}
                  variant="danger"
                  disabled={isSubjectUpdating}
                  className="flex items-center"
                >
                  <X className="mr-2 h-4 w-4" />
                  {isSubjectUpdating ? 'Rejecting...' : 'Reject'}
                </Button>
          
                <Button
                  onClick={() => handleSubjectStatusUpdate('approved')}
                  variant="primary"
                  disabled={isSubjectUpdating}
                  className="flex items-center"
                >
                  <Check className="mr-2 h-4 w-4" />
                  {isSubjectUpdating ? 'Approving...' : 'Approve'}
                </Button>
              </div>
            }
          >
      
          <div className="space-y-6 max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100 hover:scrollbar-thumb-slate-400 pr-2">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-800">{(selectedTutorSubject.tutor as any)?.user?.name}</h3>
                <p className="text-sm text-slate-500">{(selectedTutorSubject.tutor as any)?.user?.email}</p>
              </div>
            </div>

            {/* Subject Expertise Details */}
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold">Subject Expertise</h4>
                <div className="mt-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    {(selectedTutorSubject.subject as any)?.subject_name}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-semibold">Application Date</h4>
                <p className="text-gray-700 bg-gray-50 p-3 rounded-md mt-1">
                  {new Date(selectedTutorSubject.created_at).toLocaleString()}
                </p>
              </div>

              {/* Supporting Documents */}
              <div>
                <h4 className="font-semibold">Supporting Documents</h4>
                <ul className="mt-2 space-y-2">
                  {(selectedTutorSubject as any).documents?.length ? (selectedTutorSubject as any).documents.map((doc: any) => (
                    <li key={doc.id} className="flex items-center justify-between bg-gray-50 rounded p-2">
                      <div className="flex items-center min-w-0">
                        <FileText className="h-5 w-5 mr-2 text-primary-600 flex-shrink-0"/>
                        <button
                          type="button"
                          onClick={() => handleOpenDocument(getFileUrl(doc.file_url), doc.file_type)}
                          className="text-primary-600 hover:underline truncate text-left"
                          title="Open file"
                        >
                          {doc.file_name}
                        </button>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                        <button
                          type="button"
                          onClick={() => handleOpenDocument(getFileUrl(doc.file_url), doc.file_type)}
                          className="text-sm text-slate-600 hover:text-slate-900"
                        >
                          Open
                        </button>
                        <a href={getFileUrl(doc.file_url)} download className="text-sm text-slate-600 hover:text-slate-900">Download</a>
                      </div>
                    </li>
                  )) : <li className="text-sm text-gray-500">No supporting documents uploaded.</li>}
                </ul>
              </div>

              <div>
                <h4 className="font-semibold">Admin Notes</h4>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes for this subject expertise..."
                  className="w-full p-3 border border-gray-300 rounded-md mt-1 min-h-[100px] resize-none"
                />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Rejection Reason Modal */}
      <Modal
        isOpen={showRejectionModal}
        onClose={() => {
          setShowRejectionModal(false);
          setTutorRejectionNotes('');
          setPendingRejectionAction(null);
        }}
        title="Rejection Reason"
        footer={
          <>
            <Button 
              variant="secondary" 
              onClick={() => {
                setShowRejectionModal(false);
                setTutorRejectionNotes('');
                setPendingRejectionAction(null);
              }}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button 
              variant="danger" 
              onClick={async () => {
                // Read the rejection notes directly from state when button is clicked
                const rejectionReason = tutorRejectionNotes.trim();
                
                if (!rejectionReason) {
                  alert('Please provide a rejection reason before confirming.');
                  return;
                }
                
                console.log(`[Frontend] Modal Confirm clicked - Rejection reason from state: "${rejectionReason}"`);
                
                // Call performStatusUpdate directly with the rejection notes
                if (pendingRejectionAction) {
                  // Pass the rejection reason directly to avoid closure issues
                  await performStatusUpdate('rejected', rejectionReason);
                }
              }}
              disabled={isUpdating || !tutorRejectionNotes.trim()}
            >
              {isUpdating ? 'Rejecting...' : 'Confirm Rejection'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Please provide a reason for rejecting this tutor application. This feedback will be shared with the tutor.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={tutorRejectionNotes}
              onChange={(e) => setTutorRejectionNotes(e.target.value)}
              placeholder="Enter the reason for rejection (e.g., incomplete documents, insufficient qualifications, etc.)..."
              className="w-full p-3 border border-gray-300 rounded-md mt-1 min-h-[120px] resize-none"
              required
            />
          </div>
        </div>
      </Modal>

      {/* File Preview Modal */}
      <Modal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title={previewType.startsWith('image/') ? 'Image Preview' : previewType === 'application/pdf' ? 'PDF Preview' : 'File Preview'}
        footer={
          <>
            <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600">Open in new tab</a>
          </>
        }
      >
        <div className="w-full h-[70vh] bg-gray-100 rounded overflow-hidden flex items-center justify-center">
          {previewType === 'application/pdf' ? (
            <iframe title="PDF" src={previewUrl} className="w-full h-full" />
          ) : previewType.startsWith('image/') || previewType === 'image/*' ? (
            <img src={previewUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
          ) : (
            <div className="text-sm text-slate-600 p-4 text-center">
              Preview not available. You can open the file in a new tab.
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default TutorManagement;
