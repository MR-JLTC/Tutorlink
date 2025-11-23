import React, { useEffect, useState } from 'react';
import apiClient from '../../services/api';
import { Tutor, TutorSubject } from '../../types';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { Check, X, FileText, User, Mail, School, Book, Clock, CreditCard } from 'lucide-react';
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
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-4 sm:mb-6">Tutor Application Management</h1>
      
      <Card>
        <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Pending Applications ({tutors.length})</h2>
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">University</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Session Rate</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tutors.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">No pending applications found.</td>
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
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(tutor.user?.name || 'Tutor')}&background=random`;
                            }}
                          />
                        ) : (
                          <img
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(tutor.user?.name || 'Tutor')}&background=random`}
                            alt="Tutor"
                            className="h-8 w-8 rounded-full object-cover border flex-shrink-0"
                            style={{ aspectRatio: '1 / 1' }}
                          />
                        )}
                        <span className="truncate max-w-[200px]">{tutor.user?.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{(tutor as any).university?.name || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{(tutor as any).course?.course_name || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(tutor as any).session_rate_per_hour 
                        ? `₱${Number((tutor as any).session_rate_per_hour).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/hr`
                        : 'N/A'}
                    </td>
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

        {/* Mobile Card View for Applications */}
        <div className="md:hidden space-y-3 mt-4">
          {tutors.length === 0 ? (
            <p className="text-center text-slate-500 py-4">No pending applications found.</p>
          ) : (
            tutors.map((tutor) => (
              <Card key={tutor.tutor_id} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    {tutor.user?.profile_image_url ? (
                      <img 
                        src={getFileUrl(tutor.user.profile_image_url)} 
                        alt="Tutor" 
                        className="h-12 w-12 rounded-full object-cover border flex-shrink-0"
                        style={{ aspectRatio: '1 / 1' }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(tutor.user?.name || 'Tutor')}&background=random`;
                        }}
                      />
                    ) : (
                      <img
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(tutor.user?.name || 'Tutor')}&background=random`}
                        alt="Tutor"
                        className="h-12 w-12 rounded-full object-cover border flex-shrink-0"
                        style={{ aspectRatio: '1 / 1' }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate">{tutor.user?.name}</h3>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-slate-500 text-xs mb-1">University</p>
                      <p className="font-medium text-slate-900 truncate">{(tutor as any).university?.name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs mb-1">Course</p>
                      <p className="font-medium text-slate-900 truncate">{(tutor as any).course?.course_name || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="text-sm">
                    <p className="text-slate-500 text-xs mb-1">Session Rate per Hour</p>
                    <p className="font-medium text-slate-900">
                      {(tutor as any).session_rate_per_hour 
                        ? `₱${Number((tutor as any).session_rate_per_hour).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/hr`
                        : 'N/A'}
                    </p>
                  </div>
                  <Button onClick={() => handleViewDetails(tutor)} className="w-full">View Details</Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </Card>

      {/* Tutor Subjects Section */}
      <Card className="mt-6 sm:mt-8">
        <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Pending Subject Expertise ({tutorSubjects.length})</h2>
        {subjectLoading ? (
          <div className="text-center py-4 text-sm">Loading tutor subjects...</div>
        ) : (
          <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
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

          {/* Mobile Card View for Tutor Subjects */}
          <div className="md:hidden space-y-3 mt-4">
            {tutorSubjects.length === 0 ? (
              <p className="text-center text-slate-500 py-4">No pending subject expertise found.</p>
            ) : (
              tutorSubjects.map((tutorSubject) => (
                <Card key={tutorSubject.tutor_subject_id} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      {(tutorSubject.tutor.user as any)?.profile_image_url ? (
                        <img 
                          src={getFileUrl((tutorSubject.tutor.user as any).profile_image_url)} 
                          alt="Tutor" 
                          className="h-12 w-12 rounded-full object-cover border flex-shrink-0"
                          style={{ aspectRatio: '1 / 1' }}
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-slate-200 border flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 truncate">{(tutorSubject.tutor as any)?.user?.name}</h3>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div>
                        <p className="text-slate-500 text-xs mb-1">Subject</p>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {(tutorSubject.subject as any)?.subject_name}
                        </span>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs mb-1">Applied Date</p>
                        <p className="font-medium text-slate-900">{new Date(tutorSubject.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <Button onClick={() => handleViewSubjectDetails(tutorSubject)} className="w-full">View Details</Button>
                  </div>
                </Card>
              ))
            )}
          </div>
          </>
        )}
      </Card>

      {selectedTutor && (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Application Details`} maxWidth="5xl"
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
          <div className="space-y-6">
            {/* Enhanced Header Section */}
            <div className="bg-gradient-to-br from-sky-600 via-indigo-600 to-indigo-700 p-4 sm:p-6 rounded-xl text-white relative overflow-hidden">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -mr-16 -mt-16"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full -ml-12 -mb-12"></div>
              </div>
              <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4">
                {selectedTutor.user?.profile_image_url && (
                  <div className="flex-shrink-0">
                    <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full ring-4 ring-white/30 shadow-2xl overflow-hidden bg-white/10 backdrop-blur-sm">
                      <img src={getFileUrl(selectedTutor.user.profile_image_url)} alt="Tutor Profile" className="w-full h-full object-cover" style={{aspectRatio: '1/1'}} />
                    </div>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl sm:text-2xl font-bold mb-1">{selectedTutor.user?.name}</h3>
                  <div className="flex items-center gap-2 text-white/90">
                    <Mail className="h-4 w-4 flex-shrink-0" />
                    <p className="text-sm sm:text-base truncate">{selectedTutor.user?.email}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Content grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Left Column */}
              <div className="space-y-4 sm:space-y-5">
                {/* University & Course Card */}
                <div className="bg-white rounded-lg sm:rounded-xl p-4 sm:p-5 shadow-lg border border-slate-200 hover:shadow-xl transition-shadow">
                  <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                    <div className="p-2 bg-gradient-to-br from-sky-100 to-sky-200 rounded-lg flex-shrink-0 shadow-md">
                      <School className="h-5 w-5 sm:h-6 sm:w-6 text-sky-600" />
                    </div>
                    <h4 className="text-lg sm:text-xl font-bold text-slate-800">University & Course</h4>
                  </div>
                  <div className="space-y-2.5 sm:space-y-3">
                    <div className="bg-gradient-to-r from-sky-50 to-indigo-50 p-3 sm:p-4 rounded-lg border border-sky-200">
                      <span className="text-xs sm:text-sm text-slate-600 font-medium block mb-1">University</span>
                      <p className="text-slate-800 font-semibold text-sm sm:text-base">{(selectedTutor as any).university?.name || 'Not specified'}</p>
                    </div>
                    <div className="bg-gradient-to-r from-indigo-50 to-sky-50 p-3 sm:p-4 rounded-lg border border-indigo-200">
                      <span className="text-xs sm:text-sm text-slate-600 font-medium block mb-1">Course</span>
                      <p className="text-slate-800 font-semibold text-sm sm:text-base">{(selectedTutor as any).course?.course_name || 'Not specified'}</p>
                    </div>
                  </div>
                </div>

                {/* Bio Card */}
                <div className="bg-white rounded-lg sm:rounded-xl p-4 sm:p-5 shadow-lg border border-slate-200 hover:shadow-xl transition-shadow">
                  <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                    <div className="p-2 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-lg flex-shrink-0 shadow-md">
                      <User className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600" />
                    </div>
                    <h4 className="text-lg sm:text-xl font-bold text-slate-800">Bio</h4>
                  </div>
                  <p className="text-slate-700 bg-gradient-to-br from-slate-50 to-sky-50 p-3 sm:p-4 rounded-lg border border-slate-200 min-h-[80px] leading-relaxed text-sm sm:text-base">{selectedTutor.bio || 'No bio provided.'}</p>
                </div>

                {/* Expert Subjects Card */}
                <div className="bg-white rounded-lg sm:rounded-xl p-4 sm:p-5 shadow-lg border border-slate-200 hover:shadow-xl transition-shadow">
                  <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                    <div className="p-2 bg-gradient-to-br from-sky-100 to-indigo-100 rounded-lg flex-shrink-0 shadow-md">
                      <Book className="h-5 w-5 sm:h-6 sm:w-6 text-sky-600" />
                    </div>
                    <h4 className="text-lg sm:text-xl font-bold text-slate-800">Expert Subjects</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(selectedTutor as any).subjects?.length ? (selectedTutor as any).subjects.map((ts: any) => (
                      <span key={(ts as any).tutor_subject_id} className="px-3 py-1.5 bg-gradient-to-r from-sky-100 to-indigo-100 text-sky-800 rounded-lg text-xs sm:text-sm font-medium border border-sky-200 shadow-sm hover:shadow-md transition-shadow">
                        {(ts as any).subject?.subject_name}
                      </span>
                    )) : <span className="text-sm text-slate-500 italic">No subjects submitted.</span>}
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4 sm:space-y-5">
                {/* Session Rate Card */}
                <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-50 rounded-lg sm:rounded-xl p-4 sm:p-5 shadow-lg border-2 border-emerald-200 hover:shadow-xl transition-shadow">
                  <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                    <div className="p-2 bg-gradient-to-br from-emerald-200 to-teal-200 rounded-lg flex-shrink-0 shadow-md">
                      <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-700" />
                    </div>
                    <h4 className="text-lg sm:text-xl font-bold text-slate-800">Session Rate</h4>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-emerald-200 shadow-sm">
                    <span className="text-xs sm:text-sm text-slate-600 font-medium block mb-2">Rate per hour</span>
                    <p className="text-emerald-700 font-bold text-xl sm:text-2xl">
                      {(selectedTutor as any).session_rate_per_hour 
                        ? `₱${Number((selectedTutor as any).session_rate_per_hour).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` 
                        : 'Not specified'}
                    </p>
                  </div>
                </div>

                {/* Submitted Documents Card */}
                <div className="bg-white rounded-lg sm:rounded-xl p-4 sm:p-5 shadow-lg border border-slate-200 hover:shadow-xl transition-shadow">
                  <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                    <div className="p-2 bg-gradient-to-br from-sky-100 to-sky-200 rounded-lg flex-shrink-0 shadow-md">
                      <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-sky-600" />
                    </div>
                    <h4 className="text-lg sm:text-xl font-bold text-slate-800">Submitted Documents</h4>
                  </div>
                  <ul className="space-y-2">
                    {selectedTutor.documents?.length ? selectedTutor.documents.map(doc => (
                      <li key={doc.document_id} className="flex items-center justify-between bg-gradient-to-r from-slate-50 to-sky-50 rounded-lg p-3 border border-slate-200 hover:border-sky-300 hover:shadow-md transition-all">
                        <div className="flex items-center min-w-0 flex-1">
                          <FileText className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3 text-sky-600 flex-shrink-0"/>
                          <button
                            type="button"
                            onClick={() => handleOpenDocument(getFileUrl(doc.file_url), (doc as any).file_type)}
                            className="text-sky-700 hover:text-sky-900 hover:underline truncate text-left text-xs sm:text-sm font-medium"
                            title="Open file"
                          >
                            {doc.file_name}
                          </button>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                          <button
                            type="button"
                            onClick={() => handleOpenDocument(getFileUrl(doc.file_url), (doc as any).file_type)}
                            className="text-xs sm:text-sm px-2 sm:px-3 py-1 bg-sky-100 text-sky-700 hover:bg-sky-200 rounded-md font-medium transition-colors"
                          >
                            Open
                          </button>
                          <a href={getFileUrl(doc.file_url)} download className="text-xs sm:text-sm px-2 sm:px-3 py-1 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-md font-medium transition-colors">
                            Download
                          </a>
                        </div>
                      </li>
                    )) : <li className="text-sm text-slate-500 italic bg-slate-50 p-3 rounded-lg border border-slate-200">No documents uploaded.</li>}
                  </ul>
                </div>

                {/* Availability Card */}
                <div className="bg-gradient-to-br from-sky-50 via-indigo-50 to-sky-50 rounded-lg sm:rounded-xl p-4 sm:p-5 shadow-lg border-2 border-sky-200 hover:shadow-xl transition-shadow">
                  <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                    <div className="p-2 bg-gradient-to-br from-sky-200 to-indigo-200 rounded-lg flex-shrink-0 shadow-md">
                      <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-sky-700" />
                    </div>
                    <h4 className="text-lg sm:text-xl font-bold text-slate-800">Availability</h4>
                  </div>
                  <ul className="grid grid-cols-1 gap-2">
                    {(selectedTutor as any).availabilities?.length ? (selectedTutor as any).availabilities.map((a: any) => (
                      <li key={(a as any).availability_id} className="flex justify-between items-center bg-white p-3 rounded-lg border border-sky-200 hover:border-sky-300 hover:shadow-md transition-all">
                        <span className="font-semibold text-slate-800 text-sm sm:text-base">{(a as any).day_of_week}</span>
                        <span className="text-sky-700 font-medium text-sm sm:text-base">{(a as any).start_time} - {(a as any).end_time}</span>
                      </li>
                    )) : <li className="text-sm text-slate-500 italic bg-white p-3 rounded-lg border border-slate-200">No availability submitted.</li>}
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
