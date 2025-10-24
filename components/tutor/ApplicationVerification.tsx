import React, { useState, useEffect } from 'react';
import apiClient from '../../services/api';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Modal from '../ui/Modal';
import { useAuth } from '../../hooks/useAuth';
import { useVerification } from '../../context/VerificationContext';
import { FileText, Upload, CheckCircle, Clock, Plus, X, User, Camera, CreditCard } from 'lucide-react';

interface TutorProfileData {
  profile_photo: string;
  gcash_number: string;
  gcash_qr: string;
}

interface Subject {
  subject_id: number;
  subject_name: string;
}

interface SubjectApplication {
  id: number;
  subject_name: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes?: string;
  created_at: string;
  updated_at: string;
  documents?: Array<{
    id: number;
    file_url: string;
    file_name: string;
    file_type: string;
  }>;
}

const ApplicationVerification: React.FC = () => {
  const { user } = useAuth();
  const { isVerified, applicationStatus, refreshStatus } = useVerification();
  const [tutorId, setTutorId] = useState<number | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<Subject[]>([]);
  const [subjectToAdd, setSubjectToAdd] = useState('');
  const [otherSubject, setOtherSubject] = useState('');
  const [isCustomInputDisabled, setIsCustomInputDisabled] = useState(false);
  const [documents, setDocuments] = useState<File[]>([]);
  const [showNewSubjectForm, setShowNewSubjectForm] = useState(false);
  const [newSubjectDocuments, setNewSubjectDocuments] = useState<File[]>([]);
  const [subjectApplications, setSubjectApplications] = useState<SubjectApplication[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewType, setPreviewType] = useState<string>('');

  // New state for profile and payment info
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [existingProfilePhotoUrl, setExistingProfilePhotoUrl] = useState<string>('');
  const [gcashNumber, setGcashNumber] = useState<string>('');
  const [gcashQR, setGcashQR] = useState<File | null>(null);
  const [existingGcashQRUrl, setExistingGcashQRUrl] = useState<string>('');
  const [tutorIdError, setTutorIdError] = useState<string>('');

  useEffect(() => {
    if (user?.user_id) {
      fetchTutorId();
    }
  }, [user]);

  const fetchTutorId = async () => {
    if (!user?.user_id) return;
    try {
      const response = await apiClient.get(`/tutors/by-user/${user.user_id}/tutor-id`);
      setTutorId(response.data.tutor_id);
    } catch (error: any) {
      console.error('Failed to fetch tutor ID:', error);
      console.log('Error details:', {
        status: error.response?.status,
        message: error.message,
        responseData: error.response?.data,
        url: error.config?.url
      });
      // If tutor not found, this means the user doesn't have a tutor profile yet
      // This can happen if they were incorrectly identified as a tutor during login
      if (error.response?.status === 404 || error.message?.includes('Tutor not found')) {
        console.log('User does not have a tutor profile yet. They may need to complete tutor registration.');
        setTutorIdError('You need to complete your tutor registration first. Please go to the tutor registration page to complete your application.');
        // Don't set tutorId, which will prevent the component from making tutor-specific API calls
      }
    }
  };

  useEffect(() => {
    if (tutorId) {
      fetchSubjectApplications();
      fetchTutorProfile();
    }
  }, [tutorId]);

  useEffect(() => {
    fetchAvailableSubjects();
  }, []);


  const fetchAvailableSubjects = async () => {
    try {
      const response = await apiClient.get('/subjects');
      setAvailableSubjects(response.data);
    } catch (error) {
      console.error('Failed to fetch subjects:', error);
    }
  };

  const fetchSubjectApplications = async () => {
    if (!tutorId) return;
    try {
      const response = await apiClient.get(`/tutors/${tutorId}/subject-applications`);
      setSubjectApplications(response.data);
    } catch (error) {
      console.error('Failed to fetch subject applications:', error);
    }
  };

  const normalizedSelected = new Set(subjects.map(s => s.toLowerCase()));

  const fetchTutorProfile = async () => {
    if (!tutorId) return;
    try {
      const response = await apiClient.get(`/tutors/${tutorId}/profile`);
      setExistingProfilePhotoUrl(response.data.profile_photo || '');
      setGcashNumber(response.data.gcash_number || '');
      setExistingGcashQRUrl(response.data.gcash_qr || '');
    } catch (error) {
      console.error('Failed to fetch tutor profile:', error);
    }
  };

  const handleProfilePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) setProfilePhoto(file);
  };

  const handleGcashNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGcashNumber(e.target.value);
  };

  const handleGcashQRChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) setGcashQR(file);
  };

  const handleCustomSubjectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setOtherSubject(inputValue);
    
    // Check if the input matches any available subject
    const matchingSubject = availableSubjects.find(subject => 
      subject.subject_name.toLowerCase() === inputValue.toLowerCase()
    );
    
    if (matchingSubject) {
      // If match found, select it in dropdown and disable custom input
      setSubjectToAdd(matchingSubject.subject_name);
      setIsCustomInputDisabled(true);
    } else {
      // If no match, clear dropdown selection and enable custom input
      if (subjectToAdd) {
        setSubjectToAdd('');
      }
      setIsCustomInputDisabled(false);
    }
  };

  const handleSubjectDropdownChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    setSubjectToAdd(selectedValue);
    
    // If "Select a subject..." is chosen, enable custom input
    if (selectedValue === '') {
      setIsCustomInputDisabled(false);
      setOtherSubject('');
    } else {
      // If a subject is selected, disable custom input and clear it
      setIsCustomInputDisabled(true);
      setOtherSubject('');
    }
  };

  const addSelectedSubject = () => {
    if (subjectToAdd && !normalizedSelected.has(subjectToAdd.toLowerCase())) {
      setSubjects(prev => [...prev, subjectToAdd]);
      setSubjectToAdd('');
    }
  };

  const addOtherSubject = () => {
    const trimmed = otherSubject.trim();
    if (trimmed && !normalizedSelected.has(trimmed.toLowerCase())) {
      setSubjects(prev => [...prev, trimmed]);
      setOtherSubject('');
    }
  };

  const removeSubject = (name: string) => {
    setSubjects(prev => prev.filter(s => s !== name));
  };

  const handleDocsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setDocuments(Array.from(e.target.files));
  };

  const handleNewSubjectDocsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setNewSubjectDocuments(Array.from(e.target.files));
  };

  const submitApplication = async () => {
    if (!tutorId) {
      alert('Tutor not found. Please complete application first.');
      return;
    }

    try {
      // Upload profile image if changed
      if (profilePhoto) {
        const formData = new FormData();
        formData.append('file', profilePhoto);
        await apiClient.post(`/tutors/${tutorId}/profile-image`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      // Upload GCash QR if changed
      if (gcashQR) {
        const formData = new FormData();
        formData.append('file', gcashQR);
        await apiClient.post(`/tutors/${tutorId}/gcash-qr`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      // Update GCash number and bio (if needed)
      await apiClient.put(`/tutors/${tutorId}/profile`, {
        gcash_number: gcashNumber,
        // You can add bio here if it's also part of this form
      });

      // Upload documents
      if (documents.length > 0) {
        const form = new FormData();
        documents.forEach(f => form.append('files', f));
        await apiClient.post(`/tutors/${tutorId}/documents`, form, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      // Submit subjects
      if (subjects.length > 0) {
        await apiClient.post(`/tutors/${tutorId}/subjects`, { subjects });
      }

      // Update application status
      await apiClient.post(`/tutors/${tutorId}/submit-application`);

      alert('Application submitted successfully! Awaiting admin approval.');
      refreshStatus();
    } catch (error) {
      console.error('Failed to submit application:', error);
      alert('Failed to submit application. Please try again.');
    }
  };

  const submitNewSubjectApplication = async () => {
    // Determine which subject to use: dropdown selection or custom input
    const selectedSubject = subjectToAdd || otherSubject.trim();
    
    if (!tutorId || !selectedSubject || newSubjectDocuments.length === 0) {
      alert('Please select a subject (or enter a custom subject) and upload supporting documents.');
      return;
    }

    try {
      const form = new FormData();
      form.append('subject_name', selectedSubject);
      newSubjectDocuments.forEach(f => form.append('files', f));
      
      await apiClient.post(`/tutors/${tutorId}/subject-application`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      alert('Subject application submitted successfully! Awaiting admin approval.');
      setShowNewSubjectForm(false);
      setSubjectToAdd('');
      setOtherSubject('');
      setNewSubjectDocuments([]);
      fetchSubjectApplications();
    } catch (error: any) {
      console.error('Failed to submit subject application:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to submit subject application. Please try again.';
      alert(errorMessage);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-green-600 bg-green-50 border-green-200';
      case 'rejected': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="h-4 w-4" />;
      case 'rejected': return <X className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getFileUrl = (url: string) => {
    console.log('Getting file URL for:', url);
    if (url.startsWith('http://') || url.startsWith('https://')) {
      console.log('URL is already absolute:', url);
      return url;
    }
    
    // Files are served directly at /tutor_documents/ without /api/files/ prefix
    if (url.startsWith('/tutor_documents/')) {
      const fullUrl = `${apiClient.defaults.baseURL.replace('/api', '')}${url}`;
      console.log('Constructed tutor document URL:', fullUrl);
      return fullUrl;
    }
    
    // For other files, use the standard /files/ endpoint
    const cleanUrl = url.startsWith('/') ? url.substring(1) : url;
    const fullUrl = `${apiClient.defaults.baseURL}/files/${cleanUrl}`;
    console.log('Constructed file URL:', fullUrl);
    return fullUrl;
  };

  const handleOpenDocument = (fileUrl: string, fileType?: string) => {
    console.log('Opening document:', { fileUrl, fileType });
    
    const normalizedType = (fileType || '').toLowerCase();
    if (normalizedType.startsWith('image/') || normalizedType === 'application/pdf') {
      console.log('Opening in preview modal:', { fileUrl, fileType: normalizedType });
      setPreviewUrl(fileUrl);
      setPreviewType(normalizedType);
      setIsPreviewOpen(true);
      return;
    }
    // Fallback: try extension-based handling
    const lower = fileUrl.toLowerCase();
    if (lower.endsWith('.pdf')) {
      console.log('Opening PDF in preview modal:', fileUrl);
      setPreviewUrl(fileUrl);
      setPreviewType('application/pdf');
      setIsPreviewOpen(true);
      return;
    }
    if (/(\.png|\.jpg|\.jpeg|\.gif|\.webp)$/.test(lower)) {
      console.log('Opening image in preview modal:', fileUrl);
      setPreviewUrl(fileUrl);
      setPreviewType('image/*');
      setIsPreviewOpen(true);
      return;
    }
    // As a last resort, open in new tab
    console.log('Opening in new tab:', fileUrl);
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Application & Verification</h1>
          <p className="text-slate-600">Manage your tutor application and subject expertise</p>
        </div>
        <div className={`px-4 py-2 rounded-full text-sm font-medium border ${getStatusColor(applicationStatus)}`}>
          <div className="flex items-center space-x-2">
            {getStatusIcon(applicationStatus)}
            <span>{applicationStatus.charAt(0).toUpperCase() + applicationStatus.slice(1)}</span>
          </div>
        </div>
      </div>

      {/* Error message for users without tutor profiles */}
      {tutorIdError && (
        <Card className="p-6 border-red-200 bg-red-50">
          <div className="flex items-center space-x-3">
            <X className="h-6 w-6 text-red-600 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-semibold text-red-800">Tutor Profile Not Found</h3>
              <p className="text-red-700 mt-1">{tutorIdError}</p>
              <p className="text-sm text-red-600 mt-2">
                If you believe this is an error, please contact support or try logging out and logging back in.
              </p>
              <div className="mt-4">
                <Button 
                  onClick={() => window.location.href = '/tutor-registration'}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Complete Tutor Registration
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Main Application Status */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center">
            <FileText className="h-5 w-5 mr-2 text-blue-600" />
            Main Application Status
          </h2>
        </div>
        
        {isVerified ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <CheckCircle className="h-6 w-6 text-green-600 mr-3" />
              <div>
                <p className="font-medium text-green-800">✓ Your application has been approved!</p>
                <p className="text-sm text-green-600 mt-1">You can now start accepting tutoring sessions.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center">
              <Clock className="h-6 w-6 text-yellow-600 mr-3" />
              <div>
                <p className="font-medium text-yellow-800">⏳ Your application is pending review</p>
                <p className="text-sm text-yellow-600 mt-1">An admin will review your documents and approve your account.</p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Current Approved Subjects */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Approved Subjects of Expertise</h2>
          {isVerified && (
            <Button 
              onClick={() => setShowNewSubjectForm(true)}
              className="flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Apply for New Subject</span>
            </Button>
          )}
        </div>
        
        <div className="flex flex-wrap gap-2">
          {subjectApplications
            .filter(app => app.status === 'approved')
            .map(app => (
              <span
                key={app.id}
                className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm flex items-center gap-2"
              >
                <CheckCircle className="h-3 w-3" />
                {app.subject_name}
              </span>
            ))}
          {subjectApplications.filter(app => app.status === 'approved').length === 0 && (
            <div className="w-full text-center py-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <Clock className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                <p className="text-yellow-800 font-medium">No approved subjects yet</p>
                <p className="text-sm text-yellow-700 mt-1">
                  Your subject expertise applications are being reviewed by our admin team.
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* New Subject Application Form */}
      {showNewSubjectForm && (
        <Card className="p-6 border-2 border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-blue-800">Apply for Additional Subject</h3>
            <button
              onClick={() => setShowNewSubjectForm(false)}
              className="text-slate-500 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select Subject
              </label>
              <p className="text-xs text-slate-500 mb-2">
                You can only reapply for subjects that have been previously rejected.
              </p>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                value={subjectToAdd}
                onChange={handleSubjectDropdownChange}
              >
                <option value="">Select a subject...</option>
                {availableSubjects
                  .filter(s => {
                    const normalizedName = s.subject_name.toLowerCase();
                    // Check if there's an existing application for this subject
                    const existingApp = subjectApplications.find(app => 
                      app.subject_name.toLowerCase() === normalizedName
                    );
                    
                    // Allow selection if:
                    // 1. No existing application, OR
                    // 2. Existing application is rejected (can reapply)
                    if (!existingApp) {
                      return true; // No existing application, can apply
                    }
                    
                    // Only allow if rejected - this allows reapplying for rejected subjects
                    return existingApp.status === 'rejected';
                  })
                  .map(s => {
                    const isRejected = subjectApplications.find(app => 
                      app.subject_name.toLowerCase() === s.subject_name.toLowerCase() && app.status === 'rejected'
                    );
                    return (
                      <option key={s.subject_id} value={s.subject_name}>
                        {s.subject_name} {isRejected ? '(Reapply)' : ''}
                      </option>
                    );
                  })}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Custom Subject (Optional)
              </label>
              <p className="text-xs text-slate-500 mb-2">
                If your desired subject is not in the dropdown above, you can type a custom subject name here.
                {isCustomInputDisabled && (
                  <span className="text-blue-600 font-medium ml-1">
                    ✓ Subject found in dropdown and auto-selected!
                  </span>
                )}
              </p>
              <input
                type="text"
                className={`w-full border rounded-lg px-3 py-2 ${
                  isCustomInputDisabled 
                    ? 'border-gray-300 bg-gray-100 text-gray-500 cursor-not-allowed' 
                    : 'border-slate-300 bg-white'
                }`}
                placeholder={
                  isCustomInputDisabled 
                    ? "Custom input disabled - subject found in dropdown" 
                    : "Type your custom subject name (e.g., Advanced Calculus, Organic Chemistry)"
                }
                value={otherSubject}
                onChange={handleCustomSubjectChange}
                disabled={isCustomInputDisabled}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Supporting Documents
              </label>
              <input
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleNewSubjectDocsChange}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
              {newSubjectDocuments.length > 0 && (
                <ul className="list-disc list-inside text-sm text-slate-600 mt-2">
                  {newSubjectDocuments.map((f, i) => (
                    <li key={i}>{f.name}</li>
                  ))}
                </ul>
              )}
            </div>
            
            {/* Subject Preview */}
            {(subjectToAdd || otherSubject.trim()) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <h4 className="text-sm font-medium text-blue-800 mb-1">Subject to be submitted:</h4>
                <p className="text-blue-700">
                  {subjectToAdd || otherSubject.trim()}
                  {subjectToAdd && otherSubject.trim() && (
                    <span className="text-xs text-blue-600 ml-2">
                      (Using dropdown selection)
                    </span>
                  )}
                  {!subjectToAdd && otherSubject.trim() && (
                    <span className="text-xs text-blue-600 ml-2">
                      (Custom subject)
                    </span>
                  )}
                </p>
              </div>
            )}
            
            <div className="flex space-x-3">
              <Button 
                onClick={submitNewSubjectApplication}
                disabled={(!subjectToAdd && !otherSubject.trim()) || newSubjectDocuments.length === 0}
              >
                Submit Application
              </Button>
              <Button variant="secondary" onClick={() => setShowNewSubjectForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Subject Applications History */}
      {subjectApplications.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Subject Application History</h2>
          <div className="space-y-4">
            {subjectApplications.map(app => (
              <div key={app.id} className="p-4 bg-slate-50 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <span className="font-medium text-slate-800">{app.subject_name}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(app.status)}`}>
                      <div className="flex items-center space-x-1">
                        {getStatusIcon(app.status)}
                        <span>{app.status.charAt(0).toUpperCase() + app.status.slice(1)}</span>
                      </div>
                    </span>
                  </div>
                  <span className="text-sm text-slate-500">
                    Applied: {new Date(app.created_at).toLocaleDateString()}
                  </span>
                </div>
                
                {app.status === 'rejected' && (
                  <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <X className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold text-red-800">❌ Application Rejected</p>
                          <span className="text-xs text-red-600">
                            Rejected: {new Date(app.updated_at).toLocaleDateString()}
                          </span>
                        </div>
                        {app.admin_notes ? (
                          <div>
                            <p className="text-sm font-medium text-red-700 mb-1">Admin Feedback:</p>
                            <div className="bg-red-100 border border-red-300 rounded-md p-3">
                              <p className="text-sm text-red-800 leading-relaxed">{app.admin_notes}</p>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <p className="text-sm font-medium text-red-700 mb-1">No specific feedback provided</p>
                            <p className="text-xs text-red-600">
                              The application was rejected based on current requirements and standards. 
                              You can reapply with additional documentation or qualifications.
                            </p>
                          </div>
                        )}
                        <div className="mt-3 p-2 bg-red-100 rounded-md">
                          <p className="text-xs text-red-700 font-medium">
                            💡 You can reapply for this subject by clicking "Apply for New Subject" above.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {app.status === 'approved' && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <p className="text-sm text-green-800 font-medium">
                        This subject is now part of your approved expertise areas!
                      </p>
                    </div>
                  </div>
                )}
                
                {app.status === 'pending' && (
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-yellow-600" />
                      <p className="text-sm text-yellow-800">
                        Your application is being reviewed by our admin team.
                      </p>
                    </div>
                  </div>
                )}

                {/* Supporting Documents */}
                {app.documents && app.documents.length > 0 && (
                  <div className="mt-3">
                    <h5 className="text-sm font-medium text-slate-700 mb-2">Supporting Documents:</h5>
                    <ul className="space-y-1">
                      {app.documents.map((doc) => (
                        <li key={doc.id} className="flex items-center justify-between bg-slate-50 rounded p-2">
                          <div className="flex items-center min-w-0">
                            <FileText className="h-4 w-4 mr-2 text-primary-600 flex-shrink-0"/>
                            <button
                              type="button"
                              onClick={() => handleOpenDocument(getFileUrl(doc.file_url), doc.file_type)}
                              className="text-primary-600 hover:underline truncate text-left text-sm"
                              title="Open file"
                            >
                              {doc.file_name}
                            </button>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                            <button
                              type="button"
                              onClick={() => handleOpenDocument(getFileUrl(doc.file_url), doc.file_type)}
                              className="text-xs text-slate-600 hover:text-slate-900"
                            >
                              Open
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Initial Application Form (only show if not verified) */}
      {!isVerified && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Complete Your Application</h2>
          <div className="space-y-4">
            {/* Profile Photo Upload */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Profile Photo
              </label>
              <div className="flex items-center space-x-4">
                <div className="relative w-24 h-24 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center border-4 border-white shadow-lg">
                  {profilePhoto ? (
                    <img src={URL.createObjectURL(profilePhoto)} alt="Profile Preview" className="w-full h-full object-cover" style={{aspectRatio: '1/1'}} />
                  ) : existingProfilePhotoUrl ? (
                    <img src={getFileUrl(existingProfilePhotoUrl)} alt="Profile" className="w-full h-full object-cover" style={{aspectRatio: '1/1'}} />
                  ) : (
                    <User className="h-12 w-12 text-slate-400" />
                  )}
                  {applicationStatus === 'approved' ? (
                    <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full border-2 border-white">
                      ✓
                    </div>
                  ) : (
                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full border-2 border-white">
                      <X className="h-4 w-4" />
                    </div>
                  )}
                </div>
                <label className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
                  <Camera className="h-5 w-5" />
                  <span>Upload Photo</span>
                  <input type="file" accept="image/*" onChange={handleProfilePhotoChange} className="hidden" />
                </label>
                {profilePhoto && (
                  <button
                    onClick={() => setProfilePhoto(null)}
                    className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition-colors"
                    title="Remove selected image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Subjects of Expertise
              </label>
              <p className="text-xs text-slate-500 mb-2">
                You can reapply for subjects that have been previously rejected.
                {isCustomInputDisabled && (
                  <span className="text-blue-600 font-medium ml-1">
                    ✓ Subject found in dropdown and auto-selected!
                  </span>
                )}
              </p>
              <div className="flex items-center gap-2">
                <select
                  className="flex-grow border border-slate-300 rounded-lg px-3 py-2"
                  value={subjectToAdd}
                  onChange={handleSubjectDropdownChange}
                >
                  <option value="">Select a subject...</option>
                  {availableSubjects
                    .filter(s => {
                      const normalizedName = s.subject_name.toLowerCase();
                      // Check if there's an existing application for this subject
                      const existingApp = subjectApplications.find(app => 
                        app.subject_name.toLowerCase() === normalizedName
                      );
                      
                      // Allow selection if:
                      // 1. Not already selected in current form AND no existing application, OR
                      // 2. Existing application is rejected (can reapply)
                      if (!existingApp) {
                        return !normalizedSelected.has(normalizedName); // Not selected in current form
                      }
                      
                      // Only allow if rejected - this allows reapplying for rejected subjects
                      return existingApp.status === 'rejected';
                    })
                    .map(s => {
                      const isRejected = subjectApplications.find(app => 
                        app.subject_name.toLowerCase() === s.subject_name.toLowerCase() && app.status === 'rejected'
                      );
                      return (
                        <option key={s.subject_id} value={s.subject_name}>
                          {s.subject_name} {isRejected ? '(Reapply)' : ''}
                        </option>
                      );
                    })}
                </select>
                <Button onClick={addSelectedSubject} disabled={!subjectToAdd}>
                  Add
                </Button>
              </div>
              
              <div className="flex items-center gap-2 mt-2">
                <input
                  className={`flex-grow border rounded-lg px-3 py-2 ${
                    isCustomInputDisabled 
                      ? 'border-gray-300 bg-gray-100 text-gray-500 cursor-not-allowed' 
                      : 'border-slate-300 bg-white'
                  }`}
                  placeholder={
                    isCustomInputDisabled 
                      ? "Custom input disabled - subject found in dropdown" 
                      : "Not in the list? Type a custom subject name"
                  }
                  value={otherSubject}
                  onChange={handleCustomSubjectChange}
                  disabled={isCustomInputDisabled}
                />
                <Button 
                  variant="secondary" 
                  onClick={addOtherSubject} 
                  disabled={!otherSubject.trim() || isCustomInputDisabled}
                >
                  Add Custom
                </Button>
              </div>
            </div>
            
            {/* Payment Information */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                GCash Number
              </label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="09XX XXX XXXX"
                value={gcashNumber}
                onChange={handleGcashNumberChange}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                GCash QR Code
              </label>
              <div>
                <div className="flex items-center space-x-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleGcashQRChange}
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2"
                  />
                  {gcashQR && (
                    <button
                      onClick={() => setGcashQR(null)}
                      className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition-colors"
                      title="Remove selected QR code"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {gcashQR ? (
                  <p className="text-sm text-slate-600 mt-1">Selected: {gcashQR.name}</p>
                ) : existingGcashQRUrl ? (
                  <div className="mt-2 p-2 bg-slate-50 rounded-lg">
                    <img src={getFileUrl(existingGcashQRUrl)} alt="Existing GCash QR" className="w-32 h-32 object-contain" />
                    <p className="text-sm text-slate-600 mt-1">Existing QR code uploaded.</p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-600 mt-1">No GCash QR code selected.</p>
                )}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Proof Documents
              </label>
              <input
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleDocsChange}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
              {documents.length > 0 && (
                <ul className="list-disc list-inside text-sm text-slate-600 mt-2">
                  {documents.map((f, i) => (
                    <li key={i}>{f.name}</li>
                  ))}
                </ul>
              )}
            </div>
            
            <div className="flex justify-end">
              <Button 
                onClick={submitApplication}
                disabled={subjects.length === 0 || documents.length === 0}
                className="px-8"
              >
                Submit Application
              </Button>
            </div>
          </div>
        </Card>
      )}

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

export default ApplicationVerification;