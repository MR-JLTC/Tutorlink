import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { University } from '../../types';
import { UNIVERSITIES } from '../../constants';
import { CheckCircleIcon } from '../../components/icons/CheckCircleIcon';

const TuteeRegistrationPage: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    university: '',
    email: '',
    password: '',
    course: '',
    yearLevel: '',
  });
  const [emailError, setEmailError] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const selectedUniversity = useMemo(() => 
    UNIVERSITIES.find(u => u.name === formData.university), 
    [formData.university]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'email' || name === 'university') {
      validateEmail(name === 'email' ? value : formData.email, name === 'university' ? UNIVERSITIES.find(u => u.name === value) : selectedUniversity);
    }
  };

  const validateEmail = (email: string, university: University | undefined) => {
    if (university && email) {
      if (!email.endsWith(`@${university.domain}`)) {
        setEmailError(`Email must be a valid ${university.name} email (ending in @${university.domain}).`);
      } else {
        setEmailError('');
      }
    } else {
      setEmailError('');
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    validateEmail(formData.email, selectedUniversity);
    if (!emailError && Object.values(formData).every(field => field !== '')) {
      console.log('Tutee Registration Data:', formData);
      setIsSubmitted(true);
    } else {
      alert('Please fill all fields correctly.');
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
    <div className="min-h-[calc(100vh-68px)] flex flex-col items-center justify-center bg-gradient-to-br from-sky-100 to-indigo-200 p-4">
      <div className="max-w-lg w-full bg-white/80 backdrop-blur-lg p-8 rounded-2xl shadow-xl border border-white/50">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Student Registration</h1>
          <p className="text-slate-600 mb-6">Create your account to find a tutor.</p>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-slate-700 font-semibold mb-1" htmlFor="name">Full Name</label>
              <input type="text" id="name" name="name" value={formData.name} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-600 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 placeholder-slate-400" required />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1" htmlFor="university">University</label>
              <select id="university" name="university" value={formData.university} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-600 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500" required>
                <option value="">Select University</option>
                {UNIVERSITIES.map(uni => <option key={uni.name} value={uni.name}>{uni.name}</option>)}
              </select>
            </div>
             <div>
              <label className="block text-slate-700 font-semibold mb-1" htmlFor="email">University Email</label>
              <input type="email" id="email" name="email" value={formData.email} onChange={handleInputChange} className={`w-full px-4 py-2 border rounded-lg focus:ring-2 bg-slate-700 text-white placeholder-slate-400 ${emailError ? 'border-red-500 focus:ring-red-500' : 'border-slate-600 focus:ring-sky-500 focus:border-sky-500'}`} required />
             {emailError && <p className="text-red-500 text-sm mt-1">{emailError}</p>}
            </div>
            <div className="md:col-span-2">
              <label className="block text-slate-700 font-semibold mb-1" htmlFor="password">Password</label>
              <input type="password" id="password" name="password" value={formData.password} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-600 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 placeholder-slate-400" required />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1" htmlFor="course">Course</label>
              <input type="text" id="course" name="course" placeholder="e.g., Computer Science" value={formData.course} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-600 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 placeholder-slate-400" required />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1" htmlFor="yearLevel">Year Level</label>
              <input type="number" id="yearLevel" name="yearLevel" placeholder="e.g., 3" min="1" max="8" value={formData.yearLevel} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-600 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 placeholder-slate-400" required />
            </div>
          </div>
          <button type="submit" className="mt-6 w-full bg-sky-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-sky-700 transition-colors disabled:bg-slate-400">
            Create Account
          </button>
        </form>
      </div>
    </div>
  );
};

export default TuteeRegistrationPage;