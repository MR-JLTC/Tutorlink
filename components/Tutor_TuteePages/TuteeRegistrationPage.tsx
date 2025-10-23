import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../services/api';
import { CheckCircleIcon } from '../../components/icons/CheckCircleIcon';
import { useToast } from '../../components/ui/Toast';

const TuteeRegistrationPage: React.FC = () => {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    course: '',
    yearLevel: '',
  });
  const [universities, setUniversities] = useState<{ university_id: number; name: string; email_domain: string }[]>([]);
  const [universityId, setUniversityId] = useState<number | ''>('');
  const [emailError, setEmailError] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [courses, setCourses] = useState<{ course_id: number; course_name: string; university_id: number | null }[]>([]);
  const [courseId, setCourseId] = useState<number | ''>('');

  const selectedUniversity = useMemo(() => 
    universities.find(u => u.university_id === universityId), 
    [universities, universityId]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'email') {
      validateEmail(value, selectedUniversity);
    }
  };

  const validateEmail = (email: string, university: { university_id: number; name: string; email_domain: string } | undefined) => {
    if (university && email) {
      const domain = university.email_domain;
      if (!email.toLowerCase().endsWith(`@${domain.toLowerCase()}`)) {
        setEmailError(`Email must be a valid ${university.name} email (ending in @${domain}).`);
      } else {
        setEmailError('');
      }
    } else {
      setEmailError('');
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/universities');
        setUniversities(res.data || []);
        const cr = await apiClient.get('/courses');
        const normalized = (Array.isArray(cr.data) ? cr.data : []).map((c: any) => ({
          ...c,
          university_id: c?.university_id ?? c?.university?.university_id ?? c?.universityId ?? null,
        }));
        setCourses(normalized);
      } catch (e) {
        setUniversities([]);
        setCourses([]);
      }
    })();
  }, []);

  useEffect(() => {
    // revalidate when university changes
    validateEmail(formData.email, selectedUniversity);
  }, [selectedUniversity]);

  const filteredCourses = useMemo(() => {
    return courses.filter((c: any) => {
      const uid = c?.university_id ?? c?.university?.university_id ?? c?.universityId;
      return !universityId || uid === universityId;
    });
  }, [courses, universityId]);

  // Auto-select course if typed exactly matches existing (case-insensitive)
  useEffect(() => {
    const trimmed = formData.course.trim().toLowerCase();
    if (!trimmed || courseId) return;
    const match = filteredCourses.find(c => c.course_name.toLowerCase() === trimmed);
    if (match) {
      setCourseId(match.course_id);
    }
  }, [formData.course, courseId, filteredCourses]);

  // If university changes and current selected course no longer applies, reset
  useEffect(() => {
    if (!courseId) return;
    const stillValid = filteredCourses.some(c => c.course_id === courseId);
    if (!stillValid) {
      setCourseId('');
      setFormData(prev => ({ ...prev, course: '' }));
    }
  }, [filteredCourses, courseId]);

  // If no university selected, clear course selection/input
  useEffect(() => {
    if (!universityId) {
      setCourseId('');
      setFormData(prev => ({ ...prev, course: '' }));
    }
  }, [universityId]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    validateEmail(formData.email, selectedUniversity);
    const requiredFilled = formData.name && formData.email && formData.password && formData.yearLevel;
    const courseProvided = !!courseId || !!formData.course.trim();
    if (!emailError && requiredFilled && universityId && courseProvided) {
      console.log('Tutee Registration Data:', formData);
      setIsSubmitted(true);
    } else {
      notify('Please fill all fields correctly.', 'error');
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-[calc(100vh-68px)] flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full text-center bg-white p-10 rounded-xl shadow-lg">
          <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto" />
          <h2 className="text-3xl font-bold text-slate-800 mt-4">Registration Successful!</h2>
          <p className="text-slate-600 mt-2">
            A verification link has been sent to <strong>{formData.email}</strong>. Please check your inbox to activate your account.
          </p>
          <button
            onClick={() => navigate('/LandingPage')}
            className="mt-8 w-full bg-sky-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-sky-700 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-68px)] flex flex-col items-center justify-center bg-gradient-to-br from-indigo-200 to-sky-100 p-4">
      <div className="max-w-lg w-full bg-white/80 backdrop-blur-lg p-8 rounded-2xl shadow-xl border border-white/50">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Student Registration</h1>
          <p className="text-slate-600 mb-6">Create your account to find a tutor.</p>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-slate-700 font-semibold mb-1" htmlFor="name">Full Name</label>
              <input type="text" id="name" name="name" value={formData.name} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1" htmlFor="university">University</label>
              <select
                id="university"
                name="universityId"
                value={universityId}
                onChange={(e) => setUniversityId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                required
              >
                <option value="">Select University</option>
                {universities.map(u => (
                  <option key={u.university_id} value={u.university_id}>{u.name}</option>
                ))}
              </select>
            </div>
             <div>
              <label className="block text-slate-700 font-semibold mb-1" htmlFor="email">University Email</label>
              <input type="email" id="email" name="email" value={formData.email} onChange={handleInputChange} className={`w-full px-4 py-2 border rounded-lg ${emailError ? 'border-red-400' : 'border-slate-300'}`} required />
             {emailError && <p className="text-red-500 text-sm mt-1">{emailError}</p>}
            </div>
            <div className="md:col-span-2">
              <label className="block text-slate-700 font-semibold mb-1" htmlFor="password">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  id="password" 
                  name="password" 
                  value={formData.password} 
                  onChange={handleInputChange} 
                  minLength={7} 
                  maxLength={13} 
                  className="w-full px-4 py-2 pr-10 border border-slate-300 rounded-lg 
                  [&::-ms-reveal]:hidden 
                  [&::-webkit-credentials-auto-fill-button]:!hidden 
                  [&::-webkit-strong-password-auto-fill-button]:!hidden 
                  [&::-webkit-credentials-auto-fill-button]:!hidden
                  [&::-webkit-strong-password-auto-fill-button]:!hidden" 
                  autoComplete="new-password"
                  data-form-type="other"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  style={{
                    WebkitTextSecurity: showPassword ? 'none' : 'disc',
                    WebkitAppearance: 'none',
                    MozAppearance: 'textfield'
                  }}
                  required 
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? (
                    // Swapped to a cleaner, known-good "Eye" SVG
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      strokeWidth={1.5} 
                      stroke="currentColor" 
                      className="h-5 w-5"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" 
                      />
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" 
                      />
                    </svg>
                  ) : (
                    // Swapped to a cleaner, known-good "EyeOff" SVG
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      strokeWidth={1.5} 
                      stroke="currentColor" 
                      className="h-5 w-5"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L6.228 6.228" 
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Course</label>
              <select
                className={`w-full px-4 py-2 border rounded-lg ${!universityId ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed' : 'border-slate-300'}`}
                value={courseId}
                onChange={(e) => {
                  const value = e.target.value ? Number(e.target.value) : '';
                  setCourseId(value);
                  if (value) {
                    setFormData(prev => ({ ...prev, course: '' }));
                  }
                }}
                disabled={!universityId}
                title={!universityId ? 'Select a university first' : undefined}
              >
                <option value="">Select Course</option>
                {filteredCourses.map(c => (
                  <option key={c.course_id} value={c.course_id}>{c.course_name}</option>
                ))}
              </select>
              <div className="mt-2">
                <label htmlFor="course" className="block text-slate-600 text-sm mb-1">Not in the list? Input your course:</label>
                <input
                  type="text"
                  id="course"
                  name="course"
                  placeholder="e.g., Computer Science"
                  value={formData.course}
                  onChange={handleInputChange}
                  disabled={!universityId || !!courseId}
                  className={`w-full px-4 py-2 border rounded-lg ${(!universityId || courseId) ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed' : 'border-slate-300'}`}
                />
                {courseId && (
                  <p className="text-xs text-slate-500 mt-1">Select "Select Course" above to enable manual input.</p>
                )}
                {!courseId && !universityId && (
                  <p className="text-xs text-slate-500 mt-1">Select a university to enable course selection or manual input.</p>
                )}
              </div>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1" htmlFor="yearLevel">Year Level</label>
              <input type="number" id="yearLevel" name="yearLevel" placeholder="e.g., 3" min="1" max="5" value={formData.yearLevel} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required />
            </div>
          </div>
          <button type="submit" className="mt-6 w-full bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-slate-400">
            Create Account
          </button>
        </form>
      </div>
    </div>
  );
};

export default TuteeRegistrationPage;