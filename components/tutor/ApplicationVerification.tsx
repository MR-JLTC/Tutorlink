import React, { useState, useEffect } from 'react';
import apiClient from '../../services/api';
import Button from '../ui/Button';
import Card from '../ui/Card';
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
  documents: string[];
  created_at: string;
}

const ApplicationVerification: React.FC = () => {
  const { user } = useAuth();
  const { isVerified, applicationStatus, refreshStatus } = useVerification();
  const [tutorId, setTutorId] = useState<number | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<Subject[]>([]);
  const [subjectToAdd, setSubjectToAdd] = useState('');
  const [otherSubject, setOtherSubject] = useState('');
  const [documents, setDocuments] = useState<File[]>([]);
  const [showNewSubjectForm, setShowNewSubjectForm] = useState(false);
  const [newSubjectDocuments, setNewSubjectDocuments] = useState<File[]>([]);
  const [subjectApplications, setSubjectApplications] = useState<SubjectApplication[]>([]);

  // New state for profile and payment info
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [existingProfilePhotoUrl, setExistingProfilePhotoUrl] = useState<string>('');
  const [gcashNumber, setGcashNumber] = useState<string>('');
  const [gcashQR, setGcashQR] = useState<File | null>(null);
  const [existingGcashQRUrl, setExistingGcashQRUrl] = useState<string>('');

  useEffect(() => {
    if (user?.user_id) {
      // For now, we'll use user_id as tutor_id since they should be the same
      // In a real app, you'd need to fetch the tutor profile first
      setTutorId(user.user_id);
      fetchSubjectApplications();
      fetchTutorProfile();
    }
  }, [user]);

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
    if (!tutorId || !subjectToAdd || newSubjectDocuments.length === 0) {
      alert('Please select a subject and upload supporting documents.');
      return;
    }

    try {
      const form = new FormData();
      form.append('subject_name', subjectToAdd);
      newSubjectDocuments.forEach(f => form.append('files', f));
      
      await apiClient.post(`/tutors/${tutorId}/subject-application`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      alert('Subject application submitted successfully! Awaiting admin approval.');
      setShowNewSubjectForm(false);
      setSubjectToAdd('');
      setNewSubjectDocuments([]);
      fetchSubjectApplications();
    } catch (error) {
      console.error('Failed to submit subject application:', error);
      alert('Failed to submit subject application. Please try again.');
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
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `${apiClient.defaults.baseURL}/files/${url}`;
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

      {/* Current Subjects */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Current Subjects of Expertise</h2>
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
          {subjects.map(s => (
            <span
              key={s}
              className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2"
            >
              {s}
              <button
                type="button"
                onClick={() => removeSubject(s)}
                className="text-blue-700 hover:text-blue-900"
              >
                ×
              </button>
            </span>
          ))}
          {subjects.length === 0 && (
            <span className="text-sm text-slate-500">No subjects selected.</span>
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
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                value={subjectToAdd}
                onChange={(e) => setSubjectToAdd(e.target.value)}
              >
                <option value="">Select a subject...</option>
                {availableSubjects
                  .filter(s => !normalizedSelected.has(s.subject_name.toLowerCase()))
                  .map(s => (
                    <option key={s.subject_id} value={s.subject_name}>
                      {s.subject_name}
                    </option>
                  ))}
              </select>
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
            
            <div className="flex space-x-3">
              <Button onClick={submitNewSubjectApplication}>
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
          <div className="space-y-3">
            {subjectApplications.map(app => (
              <div key={app.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
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
                  {new Date(app.created_at).toLocaleDateString()}
                </span>
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
              <div className="flex items-center gap-2">
                <select
                  className="flex-grow border border-slate-300 rounded-lg px-3 py-2"
                  value={subjectToAdd}
                  onChange={(e) => setSubjectToAdd(e.target.value)}
                >
                  <option value="">Select a subject...</option>
                  {availableSubjects
                    .filter(s => !normalizedSelected.has(s.subject_name.toLowerCase()))
                    .map(s => (
                      <option key={s.subject_id} value={s.subject_name}>
                        {s.subject_name}
                      </option>
                    ))}
                </select>
                <Button onClick={addSelectedSubject} disabled={!subjectToAdd}>
                  Add
                </Button>
              </div>
              
              <div className="flex items-center gap-2 mt-2">
                <input
                  className="flex-grow border border-slate-300 rounded-lg px-3 py-2"
                  placeholder="Not in the list? Type a subject"
                  value={otherSubject}
                  onChange={(e) => setOtherSubject(e.target.value)}
                />
                <Button 
                  variant="secondary" 
                  onClick={addOtherSubject} 
                  disabled={!otherSubject.trim()}
                >
                  Add
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
    </div>
  );
};

export default ApplicationVerification;