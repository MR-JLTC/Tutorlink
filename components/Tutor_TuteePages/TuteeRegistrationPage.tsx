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
  const [universities, setUniversities] = useState<{ university_id: number; name: string; email_domain: string; status: string }[]>([]);
  const [universityId, setUniversityId] = useState<number | ''>('');
  const [emailDomainError, setEmailDomainError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [courses, setCourses] = useState<{ course_id: number; course_name: string; university_id: number | null }[]>([]);
  const [courseId, setCourseId] = useState<number | ''>('');
  
  // Email verification states
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  
  // Profile image state
  const [profileImage, setProfileImage] = useState<File | null>(null);

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

  const validateEmail = (email: string, university: { university_id: number; name: string; email_domain: string; status: string } | undefined) => {
    if (!email || !universityId) {
      setEmailDomainError(null);
      setIsEmailVerified(false);
      return;
    }
    const uni = universities.find(u => u.university_id === universityId);
    if (!uni) {
      setEmailDomainError(null);
      setIsEmailVerified(false);
      return;
    }
    const domain = email.split('@')[1] || '';
    if (!domain || domain.toLowerCase() !== uni.email_domain.toLowerCase()) {
      setEmailDomainError(`Email domain must be ${uni.email_domain}`);
      setIsEmailVerified(false);
    } else {
      setEmailDomainError(null);
      // Check if email is already verified
      checkEmailVerificationStatus(email);
    }
  };

  const checkEmailVerificationStatus = async (emailToCheck: string) => {
    if (!emailToCheck || !universityId) {
      setIsEmailVerified(false);
      return;
    }

    try {
      const response = await apiClient.get(`/auth/email-verification/status?email=${encodeURIComponent(emailToCheck)}&user_type=tutee`);
      if (response.data && response.data.is_verified === 1) {
        setIsEmailVerified(true);
      } else {
        setIsEmailVerified(false);
      }
    } catch (err) {
      // If API call fails, assume email is not verified
      setIsEmailVerified(false);
    }
  };

  const handleSendVerificationCode = async () => {
    if (!formData.email || !universityId) {
      notify('Please enter email and select university first.', 'error');
      return;
    }
    if (emailDomainError) {
      notify(emailDomainError, 'error');
      return;
    }

    setIsSendingCode(true);
    setVerificationError('');

    try {
      console.log('Frontend: Sending verification code to:', formData.email);
      const response = await apiClient.post('/auth/email-verification/send-code', { 
        email: formData.email, 
        user_type: 'tutee' 
      });
      console.log('Frontend: Verification code response:', response.data);
      
      if (response.data) {
        setShowVerificationModal(true);
        notify('Verification code sent to your email!', 'success');
      }
    } catch (err: any) {
      console.log('Frontend: Verification code error:', err);
      const errorMessage = err.response?.data?.message || 'Failed to send verification code. Please try again.';
      setVerificationError(errorMessage);
      notify(errorMessage, 'error');
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      setVerificationError('Please enter the verification code');
      return;
    }

    setIsVerifyingCode(true);
    setVerificationError('');

    try {
      console.log('Frontend: Verifying code:', verificationCode);
      const response = await apiClient.post('/auth/email-verification/verify-code', { 
        email: formData.email, 
        code: verificationCode,
        user_type: 'tutee'
      });
      console.log('Frontend: Verification response:', response.data);
      
      if (response.data) {
        setIsEmailVerified(true);
        setShowVerificationModal(false);
        setVerificationCode('');
        notify('Email verified successfully! You can now submit your registration.', 'success');
      }
    } catch (err: any) {
      console.log('Frontend: Verification error:', err);
      const errorMessage = err.response?.data?.message || 'Invalid verification code. Please try again.';
      setVerificationError(errorMessage);
      notify(errorMessage, 'error');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleCloseVerificationModal = () => {
    setShowVerificationModal(false);
    setVerificationCode('');
    setVerificationError('');
  };

  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      // Check if it's an image file
      if (file.type.startsWith('image/')) {
        setProfileImage(file);
        notify('Profile image selected successfully!', 'success');
    } else {
        notify('Please select a valid image file.', 'error');
        e.target.value = '';
      }
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/universities');
        // Filter to only include universities with "active" status
        const activeUniversities = (res.data || []).filter((uni: any) => uni.status === 'active');
        setUniversities(activeUniversities);
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
    if (!formData.email || !universityId) {
      setEmailDomainError(null);
      setIsEmailVerified(false);
      return;
    }
    const uni = universities.find(u => u.university_id === universityId);
    if (!uni) {
      setEmailDomainError(null);
      setIsEmailVerified(false);
      return;
    }
    const domain = formData.email.split('@')[1] || '';
    if (!domain || domain.toLowerCase() !== uni.email_domain.toLowerCase()) {
      setEmailDomainError(`Email domain must be ${uni.email_domain}`);
      setIsEmailVerified(false);
    } else {
      setEmailDomainError(null);
      // Check if email is already verified
      checkEmailVerificationStatus(formData.email);
    }
  }, [formData.email, universityId, universities]);

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
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.password || !formData.yearLevel) {
      notify('Please fill all required fields.', 'error');
      return;
    }
    
    if (emailDomainError) {
      notify(emailDomainError, 'error');
      return;
    }
    
    if (!isEmailVerified) {
      notify('Please verify your email address before submitting the registration.', 'error');
      return;
    }
    
    if (formData.password.length < 7 || formData.password.length > 13) {
      notify('Password must be between 7 and 13 characters.', 'error');
      return;
    }
    
    const courseProvided = !!courseId || !!formData.course.trim();
    if (!courseProvided) {
      notify('Please select or enter a course.', 'error');
      return;
    }

    try {
      console.log('Starting tutee registration submission...');
      console.log('Form data:', {
        name: formData.name.trim(),
        email: formData.email,
        password: formData.password,
        university_id: Number(universityId),
        course_id: courseId ? Number(courseId) : undefined,
        course_name: !courseId && formData.course.trim().length > 0 ? formData.course.trim() : undefined,
        year_level: Number(formData.yearLevel),
      });

      // Register the user as a tutee
      const registerPayload = {
        name: formData.name.trim(),
        email: formData.email,
        password: formData.password,
        user_type: 'tutee',
        university_id: Number(universityId),
        course_id: courseId ? Number(courseId) : undefined,
        course_name: !courseId && formData.course.trim().length > 0 ? formData.course.trim() : undefined,
        year_level: Number(formData.yearLevel),
      };

      const registrationResponse = await apiClient.post('/auth/register', registerPayload);
      console.log('Tutee registration successful:', registrationResponse.data);
      
      // Store the token for authenticated requests
      const { user, accessToken } = registrationResponse.data;
      localStorage.setItem('token', accessToken);
      localStorage.setItem('user', JSON.stringify(user));
      
      console.log('Token stored:', accessToken);
      console.log('User stored:', user);
      
      // Test authentication endpoint
      try {
        const testResponse = await apiClient.get('/users/test-auth', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        console.log('Auth test successful:', testResponse.data);
      } catch (testErr) {
        console.error('Auth test failed:', testErr);
      }
      
      // Small delay to ensure token is properly set
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Upload profile image if provided
      if (profileImage) {
        try {
          console.log('Uploading profile image for tutee:', user.user_id);
          console.log('Using token:', accessToken);
          
          const pf = new FormData();
          pf.append('file', profileImage);
          
          const profileResponse = await apiClient.post(`/users/${user.user_id}/profile-image`, pf, { 
            headers: { 
              'Content-Type': 'multipart/form-data',
              'Authorization': `Bearer ${accessToken}`
            } 
          });
          console.log('Profile image uploaded successfully:', profileResponse.data);
          
          // Update user with new profile image URL
          const updatedUser = { ...user, profile_image_url: profileResponse.data.profile_image_url };
          localStorage.setItem('user', JSON.stringify(updatedUser));
          notify('Profile image uploaded successfully!', 'success');
        } catch (imageErr) {
          console.error('Failed to upload profile image:', imageErr);
          console.error('Error details:', imageErr.response?.data);
          console.error('Error status:', imageErr.response?.status);
          // Don't block registration if image upload fails
          notify('Registration successful, but profile image upload failed. You can update it later.', 'info');
        }
      } else {
        // Set placeholder profile image
        try {
          console.log('Setting placeholder profile image for tutee');
          await apiClient.post(`/users/${user.user_id}/profile-image-placeholder`, {}, {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          });
          console.log('Placeholder profile image set');
        } catch (placeholderErr) {
          console.error('Failed to set placeholder profile image:', placeholderErr);
        }
      }
      
      setIsSubmitted(true);
    } catch (err: any) {
      console.error('Registration error:', err);
      console.error('Error response:', err?.response?.data);
      console.error('Error status:', err?.response?.status);
      
      const message = err?.response?.data?.message || err?.message || 'Failed to submit registration';
      
      if (typeof message === 'string' && message.toLowerCase().includes('email already registered')) {
        notify('Email already registered', 'error');
    } else {
        notify(message, 'error');
      }
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-[calc(100vh-68px)] flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full text-center bg-white p-10 rounded-xl shadow-lg">
          <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto" />
          <h2 className="text-3xl font-bold text-slate-800 mt-4">Registration Successful!</h2>
          <p className="text-slate-600 mt-2">
          Your account is now active! You can log in with your credentials anytime.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="mt-8 w-full bg-sky-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-sky-700 transition-colors"
          >
            Proceed to Login
          </button>
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
      <div className="max-w-4xl w-full bg-white/80 backdrop-blur-lg p-8 rounded-2xl shadow-xl border border-white/50">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Student Registration</h1>
          <p className="text-slate-600 mb-6">Create your account to find a tutor.</p>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          {/* Email Verification Section */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200 mb-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email Verification
            </h3>
            
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-slate-700 font-semibold mb-2">University</label>
              <select
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" 
                value={universityId}
                onChange={(e) => setUniversityId(e.target.value ? Number(e.target.value) : '')}
                required
              >
                <option value="">Select University</option>
                {universities.map(u => (
                  <option key={u.university_id} value={u.university_id}>{u.name}</option>
                ))}
              </select>
            </div>
              
             <div>
                <label className="block text-slate-700 font-semibold mb-2">Email Address</label>
                <input 
                  type="email" 
                  value={formData.email} 
                  onChange={handleInputChange} 
                  disabled={!universityId}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${
                    emailDomainError ? 'border-red-400 bg-red-50' : 
                    !universityId ? 'border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed' : 
                    'border-slate-300'
                  }`} 
                  placeholder={!universityId ? "Select a university first" : "Enter your university email"}
                  name="email"
                  required 
                />
                {!universityId && (
                  <p className="text-sm text-slate-500 mt-2 flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Please select a university first to enter your email
                  </p>
                )}
                {emailDomainError && <p className="text-sm text-red-600 mt-2 flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 000 16zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {emailDomainError}
                </p>}
              </div>
            </div>

            {/* Verification Status and Button */}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center">
                {isEmailVerified ? (
                  <div className="flex items-center text-green-700">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">
                      Email Verified Successfully!
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center text-slate-600">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span>Email verification required to submit registration</span>
                  </div>
                )}
              </div>
              
              <button
                type="button"
                onClick={handleSendVerificationCode}
                disabled={!formData.email || !universityId || emailDomainError || isSendingCode || isEmailVerified}
                className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 transform ${
                  isEmailVerified
                    ? 'bg-green-100 text-green-800 border-2 border-green-300 cursor-default' 
                    : !formData.email || !universityId || emailDomainError
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105 shadow-lg hover:shadow-xl'
                }`}
                title={
                  isEmailVerified
                    ? 'Email verified ✓' 
                    : !formData.email || !universityId 
                    ? 'Enter email and select university first'
                    : emailDomainError
                    ? 'Fix email domain error first'
                    : 'Send verification code'
                }
              >
                {isSendingCode ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending Code...
                  </div>
                ) : isEmailVerified ? (
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Verified ✓
                  </div>
                ) : (
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Send Verification Code
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Other Account Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="md:col-span-2">
              <label className="block text-slate-700 font-semibold mb-1" htmlFor="name">Full Name</label>
              <input type="text" id="name" name="name" value={formData.name} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required />
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
                  disabled={!universityId || courseId !== ''}
                  className={`w-full px-4 py-2 border rounded-lg ${(!universityId || courseId !== '') ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed' : 'border-slate-300'}`}
                />
                {courseId !== '' && (
                  <p className="text-xs text-slate-500 mt-1">Select "Select Course" above to enable manual input.</p>
                )}
                {courseId === '' && !universityId && (
                  <p className="text-xs text-slate-500 mt-1">Select a university to enable course selection or manual input.</p>
                )}
              </div>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1" htmlFor="yearLevel">Year Level</label>
              <select 
                id="yearLevel" 
                name="yearLevel" 
                value={formData.yearLevel} 
                onChange={handleInputChange} 
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                required
              >
                <option value="">Select Year Level</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
                <option value="5">5th Year</option>
              </select>
            </div>
          </div>
          
          {/* Profile Image Upload */}
          <div className="mb-6">
            <label className="block text-slate-700 font-semibold mb-1">Profile Image (optional)</label>
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleProfileImageChange} 
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            />
            {profileImage && <p className="text-xs text-slate-500 mt-1">Selected: {profileImage.name}</p>}
            <p className="text-xs text-slate-500 mt-1">Upload a photo of yourself (JPG, PNG, or other image formats)</p>
          </div>
          
          <button  
            type="submit" 
            className={`mt-6 w-full font-bold py-3 px-6 rounded-lg transition-colors ${
              isEmailVerified 
                ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                : 'bg-gray-400 text-gray-600 cursor-not-allowed'
            }`}
            disabled={!isEmailVerified}
            title={!isEmailVerified ? 'Please verify your email first' : 'Create your account'}
          >
            {isEmailVerified ? 'Create Account' : 'Verify Email to Submit'}
          </button>
        </form>
      </div>

      {/* Email Verification Modal */}
      {showVerificationModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 max-w-md w-full relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600"></div>
            </div>

            <div className="relative z-10 p-6">
              {/* Header */}
              <div className="text-center mb-6">
                <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-800 bg-clip-text text-transparent mb-2">
                  Verify Your Email
                </h2>
                <p className="text-slate-600 text-sm">
                  We've sent a 6-digit verification code to <strong>{formData.email}</strong>. Please check your email and enter the code below.
                </p>
              </div>

              {/* Error Message */}
              {verificationError && (
                <div className="bg-red-50/90 backdrop-blur-sm border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-medium shadow-lg mb-4">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    {verificationError}
                  </div>
                </div>
              )}

              {/* Verification Code Input */}
              <div className="space-y-4">
                <div>
                  <label htmlFor="verification-code" className="block text-sm font-semibold text-slate-800 mb-2">
                    Verification Code
                  </label>
                  <input
                    id="verification-code"
                    type="text"
                    value={verificationCode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setVerificationCode(value);
                    }}
                    placeholder="Enter 6-digit code"
                    className="w-full px-4 py-3 bg-white/95 backdrop-blur-sm border-2 border-slate-200 rounded-lg focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 placeholder-slate-400 font-medium shadow-lg hover:shadow-xl text-center text-2xl tracking-widest"
                    maxLength={6}
                    autoComplete="off"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleVerifyCode}
                    disabled={!verificationCode.trim() || verificationCode.length !== 6 || isVerifyingCode}
                    className="flex-1 flex justify-center items-center py-3 px-6 border border-transparent rounded-lg shadow-2xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-700 hover:via-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-4 focus:ring-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 hover:shadow-3xl relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    {isVerifyingCode ? (
                      <div className="flex items-center relative z-10">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-sm">Verifying...</span>
                      </div>
                    ) : (
                      <span className="relative z-10 flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Verify Code
                      </span>
                    )}
                  </button>
                  
                  <button
                    onClick={handleCloseVerificationModal}
                    className="px-4 py-3 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>

                {/* Resend Code */}
                <div className="text-center">
                  <button
                    onClick={handleSendVerificationCode}
                    disabled={isSendingCode}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                  >
                    {isSendingCode ? 'Sending...' : "Didn't receive the code? Resend"}
                  </button>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={handleCloseVerificationModal}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TuteeRegistrationPage;