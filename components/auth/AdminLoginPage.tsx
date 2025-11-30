import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { logoBase64 } from '../../assets/logo';
import ForgotPasswordModal from './ForgotPasswordModal';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      if (password.length < 7 || password.length > 13) {
        setError('Password must be between 7 and 13 characters.');
        setIsLoading(false);
        return;
      }

      await login(email, password);

      const storedUser = localStorage.getItem('user');
      if (!storedUser) {
        throw new Error('Login failed: No user data found');
      }

      const userData = JSON.parse(storedUser);
      if (userData.user_type !== 'admin' && userData.role !== 'admin') {
        throw new Error('This login is for administrators only. Please use the regular login page.');
      }

      navigate('/admin/dashboard', { replace: true });
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Invalid credentials. Please try again.';
      setError(errorMessage);
    } finally {
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
        <div className="absolute inset-0 opacity-[0.035]" style={{backgroundImage:'radial-gradient(circle at 1px 1px, #0ea5e9 1px, transparent 0)', backgroundSize:'24px 24px'}} />
      </div>

      <div className="relative z-10 w-full max-w-6xl">
        {/* Unified card with slideshow + form */}
        <div className="rounded-2xl border border-white/60 bg-white/70 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 items-stretch">
            {/* Slideshow side */}
            <div className="relative hidden md:block">
              <div className="absolute inset-0">
                <AdminLoginSlideshow />
              </div>
              <div className="relative h-full w-full min-h-[420px] bg-gradient-to-tr from-sky-600/10 to-indigo-600/10" />
              {/* Removed redundant logo on left slideshow side */}
              <div className="absolute bottom-4 left-4 right-4 text-white drop-shadow-lg">
                <h2 className="text-xl font-bold">Admin Portal</h2>
                <p className="text-sm text-white/90">Manage users, courses, payments, and tutor applications</p>
              </div>
            </div>

            {/* Form side */}
            <Card className="!p-10 bg-white/85 border-0 rounded-none md:rounded-l-none">
              {/* Logo and Branding above form on right side */}
              <div className="mb-6 flex flex-col items-center">
                {/* Modern Logo Container */}
                <div className="relative mb-4">
                  {/* Animated gradient background */}
                  <div className="absolute -inset-3 bg-gradient-to-r from-sky-500/30 via-indigo-500/30 to-sky-500/30 rounded-xl blur-xl animate-pulse"></div>
                  
                  {/* Logo with modern frame */}
                  <div className="relative bg-gradient-to-br from-white via-sky-50/50 to-indigo-50/50 rounded-xl p-4 shadow-lg border border-sky-100/50 backdrop-blur-sm">
                    {/* Decorative corner accents */}
                    <div className="absolute top-0 left-0 w-8 h-8 bg-gradient-to-br from-sky-400/20 to-transparent rounded-tl-xl"></div>
                    <div className="absolute bottom-0 right-0 w-8 h-8 bg-gradient-to-tl from-indigo-400/20 to-transparent rounded-br-xl"></div>
                    
                    {/* Logo */}
                    <div className="relative z-10">
                      <img 
                        className="h-16 w-auto drop-shadow-lg transition-all duration-500 hover:scale-105 hover:rotate-1" 
                        src={logoBase64} 
                        alt="TutorLink" 
                      />
                    </div>
                  </div>
                </div>
                
                {/* Branding Text */}
                <div className="text-center space-y-1.5">
                  <h1 className="text-2xl font-extrabold bg-gradient-to-r from-sky-600 via-indigo-600 to-sky-600 bg-clip-text text-transparent">
                    TutorLink
                  </h1>
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-px w-8 bg-gradient-to-r from-transparent via-sky-400 to-sky-400"></div>
                    <p className="text-sm font-semibold text-slate-600 tracking-wide">
                      Connecting Minds, Building Futures
                    </p>
                    <div className="h-px w-8 bg-gradient-to-l from-transparent via-indigo-400 to-indigo-400"></div>
                  </div>
                </div>
              </div>
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Error Message */}
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
                onChange={(e) => {
                  let value = e.target.value.toLowerCase();
                  
                  // Extract local part (before @) and domain part
                  const atIndex = value.indexOf('@');
                  let localPart = '';
                  let domainPart = '';
                  
                  if (atIndex !== -1) {
                    localPart = value.slice(0, atIndex);
                    domainPart = value.slice(atIndex);
                  } else {
                    localPart = value;
                  }
                  
                  // Only allow letters, numbers, and one dot in local part
                  let filteredLocal = localPart.replace(/[^a-zA-Z0-9.]/g, '');
                  
                  // Allow only one dot in local part
                  const periodCount = (filteredLocal.match(/\./g) || []).length;
                  if (periodCount > 1) {
                    const firstPeriodIndex = filteredLocal.indexOf('.');
                    filteredLocal = filteredLocal.slice(0, firstPeriodIndex + 1) + 
                                   filteredLocal.slice(firstPeriodIndex + 1).replace(/\./g, '');
                  }
                  
                  // If domain part exists, ensure it's @gmail.com format
                  if (domainPart) {
                    // Only allow @gmail.com
                    if (domainPart.startsWith('@gmail.com')) {
                      value = filteredLocal + '@gmail.com';
                    } else if (domainPart.startsWith('@')) {
                      // User is typing domain, only allow @gmail.com
                      const domainInput = domainPart.replace(/[^a-z.]/g, '');
                      if (domainInput.startsWith('gmail.com') || domainInput === 'gmail' || domainInput === 'gmail.') {
                        value = filteredLocal + '@' + domainInput;
                      } else {
                        value = filteredLocal + '@';
                      }
                    }
                  } else {
                    value = filteredLocal;
                  }
                  
                  setEmail(value);
                }}
                className={inputStyles}
                placeholder="admin@gmail.com"
              />
            </div>

            <div className="pt-1">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"} // This is the standard and best way
                autoComplete="current-password"
                data-form-type="other"
                data-lpignore="true"
                data-1p-ignore="true"
                data-bwignore="true"
                style={{
                  // WebkitTextSecurity is redundant since you're already changing the 'type'
                  WebkitAppearance: 'none',
                  MozAppearance: 'textfield'
                }}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputStyles} pr-10 
                  [&::-ms-reveal]:hidden 
                  [&::-webkit-credentials-auto-fill-button]:!hidden 
                  [&::-webkit-strong-password-auto-fill-button]:!hidden`}
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
              
              {/* Forgot Password Link */}
              <div className="flex items-center justify-end pt-2">
                <div className="text-sm">
                  <button
                    type="button"
                    onClick={() => setShowForgotPasswordModal(true)}
                    className="font-medium text-sky-600 hover:text-sky-700 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>
            </div>

            <div>
              <Button type="submit" className="w-full justify-center shadow-lg hover:shadow-xl" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign in'}
              </Button>
            </div>
          </form>
          <div className="mt-6 text-center text-sm text-gray-600">
            <span>Don't have an account? </span>
            <Link to="/register" className="font-medium text-primary-600 hover:text-primary-500 underline underline-offset-2">
              Register here
            </Link>
          </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={showForgotPasswordModal}
        onClose={() => setShowForgotPasswordModal(false)}
        onSuccess={() => {}}
        mode="admin"
      />
    </div>
  );
};

export default LoginPage;

// Simple fading slideshow for admin-themed images
const AdminLoginSlideshow: React.FC = () => {
  const [index, setIndex] = React.useState(0);
  const slides = React.useMemo(() => [
    {
      src: 'https://images.unsplash.com/photo-1553729459-efe14ef6055d?q=80&w=2070&auto=format&fit=crop',
      alt: 'Admin reviewing dashboard analytics charts',
    },
    {
      src: 'https://images.unsplash.com/photo-1556157382-97eda2d62296?q=80&w=2070&auto=format&fit=crop',
      alt: 'Team collaboration with laptops in modern office',
    },
    {
      src: 'https://images.unsplash.com/photo-1552581234-26160f608093?q=80&w=2070&auto=format&fit=crop',
      alt: 'Secure admin operations on computer',
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