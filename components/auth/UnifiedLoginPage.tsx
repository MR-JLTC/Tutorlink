import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../Logo';
import { useAuth } from '../../hooks/useAuth';

const UnifiedLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { loginTutorTutee } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentSlide, setCurrentSlide] = useState(0);

  // Online images related to tutoring/learning concepts
  const slideshowImages = [
    {
      src: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=2070&auto=format&fit=crop',
      alt: 'Students studying together in a modern classroom',
      title: 'Collaborative Learning',
      description: 'Students working together to achieve academic success'
    },
    {
      src: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?q=80&w=2070&auto=format&fit=crop',
      alt: 'Tutor helping student with laptop',
      title: 'Expert Guidance',
      description: 'Experienced tutors providing personalized support'
    },
    {
      src: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=2070&auto=format&fit=crop',
      alt: 'Students in university lecture hall',
      title: 'Academic Excellence',
      description: 'Building knowledge and skills for future success'
    },
    {
      src: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?q=80&w=2070&auto=format&fit=crop',
      alt: 'Student raising hand in classroom',
      title: 'Interactive Learning',
      description: 'Engaging educational experiences that inspire growth'
    }
  ];

  // Auto-advance slideshow
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prevSlide) => (prevSlide + 1) % slideshowImages.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [slideshowImages.length]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError(''); // Clear error when user starts typing
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await loginTutorTutee(formData.email, formData.password);
      // Navigation is handled by the AuthContext
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Invalid credentials. Please try again.';
      setError(errorMessage);
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50 to-indigo-100 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-sky-400/20 to-indigo-400/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-indigo-400/20 to-sky-400/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-sky-300/10 to-indigo-300/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 flex flex-col justify-center min-h-screen py-4 px-4 sm:px-6 lg:px-8 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl">
          {/* Desktop Layout - Side by Side */}
          <div className="lg:grid lg:grid-cols-2 lg:gap-0 lg:items-stretch lg:h-[calc(100vh-2rem)]">
            {/* Left Side - Slideshow and Branding */}
            <div className="lg:order-1 hidden lg:block">
              <div className="relative h-full rounded-l-3xl overflow-hidden shadow-2xl">
                {/* Slideshow Images */}
                <div className="relative h-full">
                  {slideshowImages.map((image, index) => (
                    <div
                      key={index}
                      className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                        index === currentSlide ? 'opacity-100' : 'opacity-0'
                      }`}
                    >
                      <img
                        src={image.src}
                        alt={image.alt}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
                    </div>
                  ))}
                </div>

                {/* Content Overlay */}
                <div className="absolute inset-0 flex flex-col justify-end p-4">

                  {/* Slide Content */}
                  <div className="text-white">
                    <h2 className="text-xl font-bold mb-1">
                      {slideshowImages[currentSlide].title}
                    </h2>
                    <p className="text-sm text-white/90 mb-3 leading-relaxed">
                      {slideshowImages[currentSlide].description}
                    </p>
                    
                    {/* Slide Indicators */}
                    <div className="flex space-x-2">
                      {slideshowImages.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentSlide(index)}
                          className={`w-2 h-2 rounded-full transition-all duration-300 ${
                            index === currentSlide 
                              ? 'bg-white scale-125' 
                              : 'bg-white/50 hover:bg-white/75'
                          }`}
                          aria-label={`Go to slide ${index + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Header - Only visible on mobile/tablet */}
            <div className="lg:hidden mb-6">
              <div className="flex justify-center mb-4">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-sky-500 to-indigo-600 rounded-xl blur-lg opacity-40 group-hover:opacity-60 transition-opacity duration-300"></div>
                  <div className="relative bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-2xl border border-white/50 group-hover:shadow-3xl transition-all duration-300 group-hover:scale-105">
                    <Logo className="h-12 w-auto" />
                  </div>
                </div>
              </div>
              
              <div className="text-center">
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-slate-900 via-sky-800 to-indigo-800 bg-clip-text text-transparent mb-2">
                  Welcome Back
                </h1>
                <p className="text-sm text-slate-600 font-medium mb-3">
                  Sign in to your TutorLink account
                </p>
                <div className="flex items-center justify-center space-x-1">
                  <div className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-pulse"></div>
                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="lg:order-2">
              <div className="bg-white/80 backdrop-blur-xl py-3 lg:py-4 px-4 lg:px-5 shadow-2xl rounded-r-3xl border border-white/50 relative overflow-hidden h-full flex flex-col">
                {/* Form Background Pattern */}
                <div className="absolute inset-0 opacity-5">
                  <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-sky-500 to-indigo-600"></div>
                </div>
                
                {/* Desktop Header with Logo - Only visible on desktop */}
                <div className="hidden lg:block mb-6">
                  {/* Logo at the top, centered */}
                  <div className="flex justify-center mb-4">
                    <div className="relative group">
                      <div className="absolute inset-0 bg-gradient-to-r from-sky-500 to-indigo-600 rounded-xl blur-lg opacity-40 group-hover:opacity-60 transition-opacity duration-300"></div>
                      <div className="relative bg-white/90 backdrop-blur-sm p-3 rounded-xl shadow-2xl border border-white/50 group-hover:shadow-3xl transition-all duration-300 group-hover:scale-105">
                        <Logo className="h-12 w-auto" />
                      </div>
                    </div>
                  </div>
                  
                  {/* Welcome text centered below logo */}
                  <div className="text-center">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-sky-800 to-indigo-800 bg-clip-text text-transparent mb-1">
                      Welcome Back
                    </h1>
                    <p className="text-slate-600 font-medium text-sm">
                      Sign in to your TutorLink account
                    </p>
                    <div className="flex items-center justify-center space-x-1 mt-2">
                      <div className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-pulse"></div>
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                </div>
                
                <div className="relative z-10 flex-1 flex flex-col justify-center">
                  {/* Form Container with better organization */}
                  <div className="bg-white/60 backdrop-blur-sm rounded-xl p-5 shadow-xl border border-white/30">
                    <form className="space-y-4" onSubmit={handleSubmit}>
                      {/* Email Field */}
                      <div className="space-y-2">
                        {/* Error Message - positioned above Email Address label */}
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
                        
                        <label htmlFor="email" className="block text-sm font-semibold text-slate-800">
                          Email Address
                        </label>
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-4 w-4 text-slate-400 group-focus-within:text-sky-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                            </svg>
                          </div>
                          <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            value={formData.email}
                            onChange={handleInputChange}
                            className="w-full pl-10 pr-4 py-3 bg-white/95 backdrop-blur-sm border-2 border-slate-200 rounded-lg focus:ring-4 focus:ring-sky-500/20 focus:border-sky-500 transition-all duration-300 placeholder-slate-400 font-medium shadow-lg hover:shadow-xl text-sm group-focus-within:shadow-xl"
                            placeholder="Enter your university email"
                          />
                        </div>
                      </div>

                      {/* Password Field */}
                      <div className="space-y-2">
                        <label htmlFor="password" className="block text-sm font-semibold text-slate-800">
                          Password
                        </label>
                        <input
                          id="password"
                          name="password"
                          type="password"
                          autoComplete="current-password"
                          required
                          value={formData.password}
                          onChange={handleInputChange}
                          minLength={7}
                          maxLength={13}
                          className="w-full px-4 py-3 bg-white/95 backdrop-blur-sm border-2 border-slate-200 rounded-lg focus:ring-4 focus:ring-sky-500/20 focus:border-sky-500 transition-all duration-300 placeholder-slate-400 font-medium shadow-lg hover:shadow-xl text-sm"
                          placeholder="Enter your password"
                        />
                      </div>

                      {/* Remember Me & Forgot Password */}
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center">
                          <input
                            id="remember-me"
                            name="remember-me"
                            type="checkbox"
                            className="h-4 w-4 text-sky-600 focus:ring-4 focus:ring-sky-500/20 border-2 border-slate-300 rounded-lg transition-all duration-200"
                          />
                          <label htmlFor="remember-me" className="ml-2 block text-sm font-medium text-slate-700">
                            Remember me
                          </label>
                        </div>
                        <div className="text-sm">
                          <span className="font-medium text-slate-500 cursor-not-allowed">
                            Forgot password? <span className="text-xs text-slate-400">(Coming soon)</span>
                          </span>
                        </div>
                      </div>

                      {/* Sign In Button */}
                      <div className="pt-3">
                        <button
                          type="submit"
                          disabled={isLoading}
                          className="w-full flex justify-center items-center py-3 px-6 border border-transparent rounded-lg shadow-2xl text-sm font-bold text-white bg-gradient-to-r from-sky-600 via-sky-500 to-indigo-600 hover:from-sky-700 hover:via-sky-600 hover:to-indigo-700 focus:outline-none focus:ring-4 focus:ring-sky-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 hover:shadow-3xl relative overflow-hidden group"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                          {isLoading ? (
                            <div className="flex items-center relative z-10">
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span className="text-sm">Signing in...</span>
                            </div>
                          ) : (
                            <span className="relative z-10 flex items-center">
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                              </svg>
                              Sign In
                            </span>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Back to Landing Page Section */}
                  <div className="mt-4">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t-2 border-slate-200" />
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-3 bg-white/60 text-slate-500 font-medium">New to TutorLink?</span>
                      </div>
                    </div>

                    <div className="mt-3">
                      <button
                        onClick={() => navigate('/LandingPage')}
                        className="w-full inline-flex justify-center items-center py-2.5 px-4 border-2 border-slate-200 rounded-lg shadow-lg bg-white/60 backdrop-blur-sm text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all duration-300 transform hover:scale-105 hover:shadow-xl group"
                      >
                        <svg className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Landing Page
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnifiedLoginPage;
