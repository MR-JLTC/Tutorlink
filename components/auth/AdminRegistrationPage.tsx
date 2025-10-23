import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Link } from 'react-router-dom';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { logoBase64 } from '../../assets/logo';
import apiClient from '../../services/api';
import { University } from '../../types';

const RegistrationPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { register } = useAuth();
  const [universities, setUniversities] = useState<University[]>([]);
  const [universityId, setUniversityId] = useState<number | ''>('');

  useEffect(() => {
    const loadUniversities = async () => {
      try {
        const res = await apiClient.get('/universities');
        setUniversities(res.data);
      } catch (e) {
        // ignore, handled by interceptor
      }
    };
    loadUniversities();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 7 || password.length > 13) {
      setError('Password must be between 7 and 13 characters.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await register({ name, email, password, ...(universityId ? { university_id: Number(universityId) } : {}) });
      // The register function in AuthContext handles navigation on success
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred during registration.');
      setIsLoading(false);
    }
  };

  const inputStyles = "mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-600 focus:border-primary-600 bg-white text-slate-900 focus:bg-slate-50 transition-colors duration-200";

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-50 via-sky-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-sky-400/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-24 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[28rem] h-[28rem] bg-gradient-to-r from-sky-300/10 to-indigo-300/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-5xl">
        {/* Unified card with slideshow + form */}
        <div className="rounded-2xl border border-white/60 bg-white/70 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 items-stretch">
            {/* Slideshow side */}
            <div className="relative hidden md:block">
              <div className="absolute inset-0">
                <AdminRegisterSlideshow />
              </div>
              <div className="relative h-full w-full min-h-[320px] bg-gradient-to-tr from-sky-600/10 to-indigo-600/10" />
              <div className="absolute top-4 left-4">
                <div className="inline-block bg-white/90 backdrop-blur-sm border border-white/60 rounded-xl shadow-xl px-4 py-3">
                  <img className="h-10 w-auto" src={logoBase64} alt="TutorLink" />
                </div>
              </div>
              <div className="absolute bottom-4 left-4 right-4 text-white drop-shadow-lg">
                <h2 className="text-xl font-bold">Create Admin Account</h2>
                <p className="text-sm text-white/90">Register to access the admin portal</p>
              </div>
            </div>

            {/* Form side */}
            <Card className="!p-8 bg-white/80 border-0 rounded-none md:rounded-l-none">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputStyles}
                placeholder="John Doe"
              />
            </div>
            
            <div>
              <label htmlFor="university" className="block text-sm font-medium text-gray-700">
                University (for email validation)
              </label>
              <select
                id="university"
                name="university"
                value={universityId}
                onChange={(e) => setUniversityId(e.target.value ? Number(e.target.value) : '')}
                className={inputStyles}
              >
                <option value="">Select a university (optional)</option>
                {universities.map((u) => (
                  <option key={u.university_id} value={u.university_id}>
                    {u.name} {((u as any).acronym ? `(${(u as any).acronym})` : '')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputStyles}
                placeholder="admin@tutorlink.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputStyles} pr-10 
                    [&::-ms-reveal]:hidden 
                    [&::-webkit-credentials-auto-fill-button]:!hidden 
                    [&::-webkit-strong-password-auto-fill-button]:!hidden 
                    [&::-webkit-credentials-auto-fill-button]:!hidden 
                    [&::-webkit-strong-password-auto-fill-button]:!hidden`
                  }
                  minLength={7}
                  maxLength={13}
                  placeholder="********"
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
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  data-form-type="other"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  style={{
                    WebkitTextSecurity: showConfirmPassword ? 'none' : 'disc',
                    WebkitAppearance: 'none',
                    MozAppearance: 'textfield'
                  }}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`${inputStyles} pr-10 
                    [&::-ms-reveal]:hidden 
                    [&::-webkit-credentials-auto-fill-button]:!hidden 
                    [&::-webkit-strong-password-auto-fill-button]:!hidden 
                    [&::-webkit-credentials-auto-fill-button]:!hidden 
                    [&::-webkit-strong-password-auto-fill-button]:!hidden`
                  }
                  minLength={7}
                  maxLength={13}
                  placeholder="********"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
            
            {error && (
              <div className="bg-red-50/90 backdrop-blur-sm border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-medium shadow-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              </div>
            )}

            <div>
              <Button type="submit" className="w-full justify-center shadow-lg hover:shadow-xl" disabled={isLoading}>
                {isLoading ? 'Creating account...' : 'Create account'}
              </Button>
            </div>
          </form>
          <div className="mt-6 text-center text-sm text-gray-600">
            <span>Already have an account? </span>
            <Link to="/admin-login" className="font-medium text-primary-600 hover:text-primary-500 underline underline-offset-2">
              Sign in here
            </Link>
          </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistrationPage;

// Simple fading slideshow for admin-themed images
const AdminRegisterSlideshow: React.FC = () => {
  const [index, setIndex] = React.useState(0);
  const slides = React.useMemo(() => [
    {
      src: 'https://images.unsplash.com/photo-1552581234-26160f608093?q=80&w=2070&auto=format&fit=crop',
      alt: 'Admin secure registration environment',
    },
    {
      src: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=2070&auto=format&fit=crop',
      alt: 'Admin collaboration in modern workspace',
    },
    {
      src: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?q=80&w=2070&auto=format&fit=crop',
      alt: 'Admin teamwork in modern office',
    },
  ], []);

  React.useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), 4000);
    return () => clearInterval(id);
  }, [slides.length]);

  return (
    <div className="absolute inset-0">
      {slides.map((s, i) => (
        <img
          key={i}
          src={s.src}
          alt={s.alt}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${i === index ? 'opacity-100' : 'opacity-0'}`}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent"></div>
    </div>
  );
};