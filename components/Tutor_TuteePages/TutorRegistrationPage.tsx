import React, { useState, useMemo, useEffect } from 'react';
import apiClient from '../../services/api';
import { useNavigate } from 'react-router-dom';
// Subjects now fetched from backend
import { CheckCircleIcon } from '../../components/icons/CheckCircleIcon';
import { DocumentArrowUpIcon } from '../../components/icons/DocumentArrowUpIcon';

interface DayAvailability {
  available: boolean;
  startTime: string;
  endTime: string;
}

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TutorRegistrationPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set<string>());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [universities, setUniversities] = useState<{ university_id: number; name: string; email_domain: string }[]>([]);
  const [universityId, setUniversityId] = useState<number | ''>('');
  const [emailDomainError, setEmailDomainError] = useState<string | null>(null);
  const [courses, setCourses] = useState<{ course_id: number; course_name: string; university_id: number }[]>([]);
  const [courseId, setCourseId] = useState<number | ''>('');
  const [courseInput, setCourseInput] = useState<string>('');
  const [subjectToAdd, setSubjectToAdd] = useState<string>('');
  const [availableSubjects, setAvailableSubjects] = useState<{ subject_id: number; subject_name: string }[]>([]);
  const [otherSubject, setOtherSubject] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [bio, setBio] = useState('');
  const [availability, setAvailability] = useState<Record<string, DayAvailability>>(
    daysOfWeek.reduce((acc, day) => {
      acc[day] = { available: false, startTime: '09:00', endTime: '17:00' };
      return acc;
    }, {} as Record<string, DayAvailability>)
  );

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/subjects');
        setAvailableSubjects(res.data);
      } catch (e) {}
    })();
  }, []);

  const normalizedSelected = useMemo(() => new Set(Array.from(selectedSubjects).map((s: string) => s.toLowerCase())), [selectedSubjects]);
  const otherSubjectExistsInDropdown = useMemo(() => {
    const trimmed = otherSubject.trim().toLowerCase();
    if (!trimmed) return false;
    return availableSubjects.some(s => s.subject_name.toLowerCase() === trimmed);
  }, [otherSubject, availableSubjects]);

  useEffect(() => {
    (async () => { 
      try {
        const res = await apiClient.get('/universities');
        setUniversities(res.data);
        const cr = await apiClient.get('/courses');
        // Normalize courses to always have university_id regardless of backend shape
        const normalized = (Array.isArray(cr.data) ? cr.data : []).map((c: any) => ({
          ...c,
          university_id: c?.university_id ?? c?.university?.university_id ?? c?.universityId ?? null,
        }));
        setCourses(normalized);
      } catch (e) {}
    })();
  }, []);

  useEffect(() => {
    if (!email || !universityId) {
      setEmailDomainError(null);
      return;
    }
    const uni = universities.find(u => u.university_id === universityId);
    if (!uni) {
      setEmailDomainError(null);
      return;
    }
    const domain = email.split('@')[1] || '';
    if (!domain || domain.toLowerCase() !== uni.email_domain.toLowerCase()) {
      setEmailDomainError(`Email domain must be ${uni.email_domain}`);
    } else {
      setEmailDomainError(null);
    }
  }, [email, universityId, universities]);

  const filteredCourses = useMemo(() => {
    return courses.filter((c: any) => {
      const uid = c?.university_id ?? c?.university?.university_id ?? c?.universityId;
      return !universityId || uid === universityId;
    });
  }, [courses, universityId]);

  // Auto-select course if the typed input matches an existing course in the dropdown (case-insensitive)
  useEffect(() => {
    const trimmed = courseInput.trim().toLowerCase();
    if (!trimmed || courseId) return;
    const match = filteredCourses.find(c => c.course_name.toLowerCase() === trimmed);
    if (match) {
      setCourseId(match.course_id);
    }
  }, [courseInput, courseId, filteredCourses]);

  // If university changes and current selected course no longer applies, reset selection and enable input
  useEffect(() => {
    if (!courseId) return;
    const stillValid = filteredCourses.some(c => c.course_id === courseId);
    if (!stillValid) {
      setCourseId('');
      setCourseInput('');
    }
  }, [filteredCourses, courseId]);

  const handleAddSubject = () => {
    if (subjectToAdd && !selectedSubjects.has(subjectToAdd)) {
        setSelectedSubjects(prev => new Set(prev).add(subjectToAdd));
        setSubjectToAdd('');
    }
  };

  const handleAddOtherSubject = () => {
    const trimmedSubject = otherSubject.trim();
    if (trimmedSubject && !selectedSubjects.has(trimmedSubject)) {
        setSelectedSubjects(prev => new Set(prev).add(trimmedSubject));
        setOtherSubject('');
    }
  };

  const handleRemoveSubject = (subjectToRemove: string) => {
    setSelectedSubjects(prev => {
        const newSubjects = new Set(prev);
        newSubjects.delete(subjectToRemove);
        return newSubjects;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) setProfileImage(file);
  };

  const handleAvailabilityToggle = (day: string) => {
    setAvailability(prev => ({
      ...prev,
      [day]: { ...prev[day], available: !prev[day].available }
    }));
  };

  const handleTimeChange = (day: string, type: 'startTime' | 'endTime', value: string) => {
    setAvailability(prev => ({
      ...prev,
      [day]: { ...prev[day], [type]: value }
    }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !universityId) {
      alert('Please enter email, password, and select your university.');
      return;
    }
    if (emailDomainError) {
      alert(emailDomainError);
      return;
    }
    if (password.length < 7 || password.length > 13) {
      alert('Password must be between 7 and 13 characters.');
      return;
    }
    if (selectedSubjects.size === 0 || uploadedFiles.length === 0) {
      alert('Please select at least one subject and upload at least one document.');
      return;
    }

    try {
      // 1) Apply to get tutor_id
      const applyRes = await apiClient.post('/tutors/apply', {
        email,
        password,
        university_id: Number(universityId),
        course_id: courseId ? Number(courseId) : undefined,
        course_name: !courseId && courseInput.trim().length > 0 ? courseInput.trim() : undefined,
        bio,
      });
      const tutorId = applyRes.data?.tutor_id;
      if (!tutorId) throw new Error('Missing tutor_id');

      // 2) Upload profile image (optional)
      if (profileImage) {
        const pf = new FormData();
        pf.append('file', profileImage);
        await apiClient.post(`/tutors/${tutorId}/profile-image`, pf, { headers: { 'Content-Type': 'multipart/form-data' } });
      }

      // 3) Upload documents
      const form = new FormData();
      uploadedFiles.forEach(f => form.append('files', f));
      await apiClient.post(`/tutors/${tutorId}/documents`, form, { headers: { 'Content-Type': 'multipart/form-data' } });

      // 4) Save availability
      const slots = Object.entries(availability)
        .filter(([, d]) => (d as any).available)
        .map(([day, d]) => ({ day_of_week: day, start_time: (d as any).startTime, end_time: (d as any).endTime }));
      await apiClient.post(`/tutors/${tutorId}/availability`, { slots });

      // 5) Save subjects
      await apiClient.post(`/tutors/${tutorId}/subjects`, { subjects: Array.from(selectedSubjects) });

      setIsSubmitted(true);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'Failed to submit application';
      const notify = (window as any).__notify as ((msg: string, type?: 'success' | 'error' | 'info') => void) | undefined;
      // Avoid duplicate toasts: if interceptor already displayed, skip here by not calling notify again for common API errors
      if (notify) {
        // Only standardize for this specific case if we decide to display something custom here
        if (typeof message === 'string' && message.toLowerCase().includes('email already registered')) {
          notify('Email already registered', 'error');
        } else {
          // In most cases, the interceptor already showed a toast; do nothing here
        }
      } else {
        alert(typeof message === 'string' && message.toLowerCase().includes('email already registered') ? 'Email already registered' : message);
      }
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-[calc(100vh-68px)] flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full text-center bg-white p-10 rounded-xl shadow-lg">
          <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto" />
          <h2 className="text-3xl font-bold text-slate-800 mt-4">Application Submitted!</h2>
          <p className="text-slate-600 mt-2">
            Thank you for your application. Our team will review your documents and you will be notified via email once your account is approved.
          </p>
          <button
            onClick={() => navigate('/LandingPage')}
            className="mt-8 w-full bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-68px)] flex flex-col items-center justify-center bg-gradient-to-br from-indigo-200 to-sky-100 p-4">
      <div className="max-w-3xl w-full bg-white/80 backdrop-blur-lg p-8 rounded-2xl shadow-xl border border-white/50">
        <div className="text-center">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Tutor Application</h1>
            <p className="text-slate-600 mb-6">Share your expertise and start earning.</p>
        </div>
        <form onSubmit={handleSubmit}>
          {/* Account Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`w-full px-4 py-2 border rounded-lg ${emailDomainError ? 'border-red-400' : 'border-slate-300'}`} required />
              {emailDomainError && <p className="text-sm text-red-600 mt-1">{emailDomainError}</p>}
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={7} maxLength={13} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">University</label>
              <select className="w-full px-4 py-2 border border-slate-300 rounded-lg" value={universityId} onChange={(e) => setUniversityId(e.target.value ? Number(e.target.value) : '')} required>
                <option value="">Select University</option>
                {universities.map(u => (
                  <option key={u.university_id} value={u.university_id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Course (optional)</label>
              <select
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                value={courseId}
                onChange={(e) => {
                  const value = e.target.value ? Number(e.target.value) : '';
                  setCourseId(value);
                  if (value) {
                    // disable input by virtue of courseId being set
                    setCourseInput('');
                  }
                }}
              >
                <option value="">Select Course</option>
                {filteredCourses.map(c => (
                  <option key={c.course_id} value={c.course_id}>{c.course_name}</option>
                ))}
              </select>
              <div className="mt-2">
                <label htmlFor="course-input" className="block text-slate-600 text-sm mb-1">Not in the list? Input your course (optional):</label>
                <input
                  id="course-input"
                  type="text"
                  value={courseInput}
                  onChange={(e) => setCourseInput(e.target.value)}
                  placeholder="e.g., BS Astrophysics"
                  disabled={!!courseId}
                  className={`w-full px-4 py-2 border rounded-lg ${courseId ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed' : 'border-slate-300'}`}
                />
                {courseId && (
                  <p className="text-xs text-slate-500 mt-1">Select "Select Course" above to enable manual input.</p>
                )}
              </div>
            </div>
          </div>

          {/* Bio */}
          <div className="mb-6">
            <label className="block text-slate-700 font-semibold mb-1">Your Bio (why you’d be a great tutor)</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} className="w-full px-4 py-2 border border-slate-300 rounded-lg" placeholder="Briefly describe your teaching experience, specialties, and approach." />
          </div>
          {/* Subjects of Expertise */}
          <div>
            <h2 className="block text-slate-700 font-semibold mb-2 text-lg">1. Subjects of Expertise</h2>
            <div className="flex flex-wrap gap-2 mb-4 min-h-[2.5rem] items-center">
              {Array.from(selectedSubjects).map((subject: string) => (
                <div key={subject} className="flex items-center bg-indigo-100 text-indigo-800 text-sm font-medium pl-3 pr-2 py-1 rounded-full">
                  {subject}
                  <button
                    type="button"
                    onClick={() => handleRemoveSubject(subject)}
                    className="ml-2 flex-shrink-0 bg-indigo-200 hover:bg-indigo-300 text-indigo-800 rounded-full p-0.5"
                    aria-label={`Remove ${subject}`}
                  >
                    <svg className="h-3 w-3" stroke="currentColor" fill="none" viewBox="0 0 8 8"><path strokeLinecap="round" strokeWidth="1.5" d="M1 1l6 6m0-6L1 7" /></svg>
                  </button>
                </div>
              ))}
              {selectedSubjects.size === 0 && (
                <p className="text-sm text-slate-500">No subjects selected yet.</p>
              )}
            </div>
            
            <div className="flex items-center gap-2 mb-4">
              <select
                value={subjectToAdd}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSubjectToAdd(e.target.value)}
                className="flex-grow w-full px-4 py-2 border border-slate-600 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                aria-label="Select a subject to add"
              >
                <option value="">Select a subject...</option>
                {availableSubjects
                  .filter(s => !selectedSubjects.has(s.subject_name))
                  .map(s => <option key={s.subject_id} value={s.subject_name}>{s.subject_name}</option>)}
              </select>
              <button
                type="button"
                onClick={handleAddSubject}
                disabled={!subjectToAdd || normalizedSelected.has(subjectToAdd.toLowerCase())}
                className="bg-indigo-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-600 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>

            <div>
              <label htmlFor="other-subject" className="block text-slate-600 text-sm mb-1">Not in the list? Add another subject (optional):</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  id="other-subject"
                  value={otherSubject}
                  onChange={(e) => setOtherSubject(e.target.value)}
                  placeholder="e.g., Astrophysics"
                  className="flex-grow w-full px-4 py-2 border border-slate-600 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-400"
                />
                <button
                  type="button"
                  onClick={handleAddOtherSubject}
                  disabled={!otherSubject.trim() || otherSubjectExistsInDropdown}
                  className="bg-slate-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-slate-600 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
              {otherSubjectExistsInDropdown && (
                <p className="mt-1 text-xs text-red-300">Subject already exists. Please select it from the dropdown above.</p>
              )}
            </div>
          </div>


           {/* Availability Scheduling */}
          <div className="mt-8">
            <h2 className="block text-slate-700 font-semibold mb-2 text-lg">2. Weekly Availability</h2>
            <div className="space-y-3">
              {daysOfWeek.map(day => (
                <div key={day} className={`grid grid-cols-1 md:grid-cols-3 items-center gap-4 p-3 border rounded-lg transition-all ${availability[day].available ? 'bg-white' : 'bg-slate-50'}`}>
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded border-slate-600 bg-slate-700 text-indigo-600 focus:ring-indigo-500"
                      checked={availability[day].available}
                      onChange={() => handleAvailabilityToggle(day)}
                    />
                    <span className="font-medium text-slate-800 w-24">{day}</span>
                  </label>
                  <div className={`flex items-center gap-2 md:col-span-2 ${!availability[day].available ? 'opacity-50 pointer-events-none' : ''}`}>
                    <input
                      type="time"
                      aria-label={`${day} start time`}
                      value={availability[day].startTime}
                      onChange={(e) => handleTimeChange(day, 'startTime', e.target.value)}
                      disabled={!availability[day].available}
                      className="w-full px-2 py-1 border border-slate-600 bg-slate-700 text-white rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      style={{ colorScheme: 'dark' }}
                    />
                    <span className="text-slate-500">-</span>
                    <input
                      type="time"
                      aria-label={`${day} end time`}
                      value={availability[day].endTime}
                      onChange={(e) => handleTimeChange(day, 'endTime', e.target.value)}
                      disabled={!availability[day].available}
                      className="w-full px-2 py-1 border border-slate-600 bg-slate-700 text-white rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Document Upload */}
          <div className="mt-8">
            <h2 className="block text-slate-700 font-semibold mb-2 text-lg">3. Proof Documents</h2>
            <div className="mb-6">
              <label className="block text-slate-700 font-semibold mb-1">Profile Image (optional)</label>
              <input type="file" accept="image/*" onChange={handleProfileImageChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg" />
              {profileImage && <p className="text-xs text-slate-500 mt-1">Selected: {profileImage.name}</p>}
            </div>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-slate-400" />
                <div className="flex text-sm text-slate-600">
                  <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                    <span>Upload your files</span>
                    <input id="file-upload" name="file-upload" type="file" className="sr-only" multiple accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileChange} />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-slate-500">PDF, PNG, JPG, JPEG up to 10MB</p>
              </div>
            </div>
            {uploadedFiles.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold text-slate-700">Selected files:</h4>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-slate-600">
                  {uploadedFiles.map((file, index) => <li key={index}>{file.name}</li>)}
                </ul>
              </div>
            )}
          </div>
          
          <button type="submit" className="mt-8 w-full bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-slate-400">
            Submit Application
          </button>
        </form>
      </div>
    </div>
  );
};

export default TutorRegistrationPage;