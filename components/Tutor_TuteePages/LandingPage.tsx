import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../../components/Logo';
import Modal from '../../components/ui/Modal';
import { TutorRegistrationModal } from './TutorRegistrationPage';
import { TuteeRegistrationModal } from './TuteeRegistrationPage';
import apiClient, { getFileUrl } from '../../services/api';

// New icons for "How it works" section
const MagnifyingGlassIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>
);

const LinkIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
  </svg>
);

const LightbulbIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v-.75a.75.75 0 01.75-.75h4.5a.75.75 0 01.75.75v.75m-6 0h6M12 4.5a5.25 5.25 0 015.25 5.25c0 2.298-1.04 4.33-2.625 5.625H9.375c-1.585-1.295-2.625-3.327-2.625-5.625A5.25 5.25 0 0112 4.5z" />
  </svg>
);


const LiveStats: React.FC = () => {
  const [stats, setStats] = useState<{ users: number; tutors: number; universities: number; courses: number; sessions: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    fetch('http://localhost:3000/api/landing/stats', {
      signal: controller.signal
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load stats');
        return res.json();
      })
      .then((data) => {
        if (mounted) setStats(data);
      })
      .catch((e) => {
        // Only set error if this is not an abort error
        if (mounted && e.name !== 'AbortError') {
          setError(e.message);
        }
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-16">
      {['Users', 'Tutors', 'Universities', 'Courses', 'Sessions'].map((label, idx) => {
        const key = label.toLowerCase() as 'users' | 'tutors' | 'universities' | 'courses' | 'sessions';
        const value = stats ? stats[key] : undefined;
        return (
          <div key={label} className="bg-white rounded-xl border border-slate-100 p-5 text-center shadow-sm">
            <p className="text-slate-500 text-sm">{label}</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{value !== undefined ? value : '—'}</p>
          </div>
        );
      })}
      {error && (
        <div className="col-span-2 md:col-span-5 text-center text-slate-500 text-sm">Stats unavailable</div>
      )}
    </div>
  );
};

interface Slide {
    src: string;
    alt: string;
}

const slides: Slide[] = [
    { 
        src: 'assets/images/bgp1.jpg',
        alt: 'A tutor helping a student with a laptop in a well-lit room'
    },
    { 
        src: 'assets/images/bgp2.jpg',
        alt: 'A diverse group of young students studying together around a table'
    },
    { 
        src: 'assets/images/bgp3.jpg',
        alt: 'Students in a university lecture hall, focused on learning'
    },
    { 
        src: 'assets/images/bgp4.jpg',
        alt: 'Online tutoring session in progress'
    },
    { 
        src: 'assets/images/bgp5.jpg',
        alt: 'Student studying with digital resources'
    },
];

const HeroImageSlider = () => {
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentIndex((prevIndex) => (prevIndex + 1) % slides.length);
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="relative w-full h-full bg-slate-200">
            {slides.map((slide, index) => (
                <img
                    key={index}
                    src={slide.src}
                    alt={slide.alt}
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${index === currentIndex ? 'opacity-100' : 'opacity-0'}`}
                    aria-hidden={index !== currentIndex}
                />
            ))}
        </div>
    );
};

const RoleSelectionModal: React.FC<{ isOpen: boolean; onClose: () => void; onNavigate: (path: string) => void; }> = ({ isOpen, onClose, onNavigate }) => {
    useEffect(() => {
      if (!isOpen) return;
  
      const handleEsc = (event: KeyboardEvent) => {
         if (event.key === 'Escape') {
            onClose();
         }
      };
      window.addEventListener('keydown', handleEsc);
  
      return () => {
         window.removeEventListener('keydown', handleEsc);
      };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 transition-opacity" onClick={(e) => { e.preventDefault(); onClose(); }} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="bg-white rounded-2xl shadow-2xl p-8 m-4 max-w-3xl w-full flex flex-col md:flex-row gap-8" onClick={e => e.stopPropagation()}>
          <div 
            role="button"
            tabIndex={0}
            className="flex-1 p-8 rounded-xl border-2 border-slate-200 hover:border-sky-500 hover:bg-sky-50 transition-all duration-300 cursor-pointer flex flex-col items-center text-center focus:outline-none focus:ring-2 focus:ring-sky-500 group"
            onClick={(e) => { e.preventDefault(); onNavigate('/TuteeRegistrationPage'); }}
            onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('/TuteeRegistrationPage'); }}}
          >
            <div className="relative flex items-center justify-center h-32 w-32 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 mb-6 overflow-hidden shadow-lg group-hover:shadow-xl transition-all duration-300">
              <img 
                src="assets/images/tutee.png" 
                alt="Student" 
                className="w-full h-full object-cover rounded-full transform transition-transform duration-500 group-hover:scale-125"
              />  
              <div className="absolute inset-0 bg-gradient-to-br from-sky-500/20 to-transparent rounded-full"></div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-sky-500 rounded-full flex items-center justify-center shadow-md">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
            </div>
            <h3 id="modal-title" className="text-2xl font-bold text-slate-800 group-hover:text-sky-700 transition-colors">I'm a Student</h3>
            <p className="mt-2 text-slate-600 group-hover:text-slate-700 transition-colors">Find a tutor to help you achieve your academic goals.</p>
          </div>
          <div 
            role="button"
            tabIndex={0}
            className="flex-1 p-8 rounded-xl border-2 border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all duration-300 cursor-pointer flex flex-col items-center text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 group"
            onClick={() => onNavigate('/TutorRegistrationPage')}
            onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') onNavigate('/TutorRegistrationPage')}}
          >
            <div className="relative flex items-center justify-center h-32 w-32 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 mb-6 overflow-hidden shadow-lg group-hover:shadow-xl transition-all duration-300">
              <img 
                src="assets/images/tutor.png" 
                alt="Tutor" 
                className="w-full h-full object-cover rounded-full transform transition-transform duration-500 group-hover:scale-125"
              />
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent rounded-full"></div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center shadow-md">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg> 
              </div>
            </div>
            <h3 className="text-2xl font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">I'm a Tutor</h3>
            <p className="mt-2 text-slate-600 group-hover:text-slate-700 transition-colors">Share your knowledge, help students, and earn money.</p>
          </div>
        </div>
      </div>
    );
};


const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('');
  const [isScrolled, setIsScrolled] = useState(false);
  const [isTutorModalOpen, setIsTutorModalOpen] = useState(false);
  const [isTuteeModalOpen, setIsTuteeModalOpen] = useState(false);
    const [tutorModalKey, setTutorModalKey] = useState(0);
  const [tuteeModalKey, setTuteeModalKey] = useState(0);
  const [partnerUniversities, setPartnerUniversities] = useState<Array<{ university_id: number; name: string; logo_url?: string; status?: string }>>([]);

  const handleNavigate = (path: string) => {
    if (path === '/TutorRegistrationPage') {
      setIsModalOpen(false);
      // Reset tutor modal
      setTutorModalKey(k => k + 1);
      setIsTutorModalOpen(true);
      return;
    }
    if (path === '/TuteeRegistrationPage') {
      setIsModalOpen(false);
      // Reset tutee modal
      setTuteeModalKey(k => k + 1);
      setIsTuteeModalOpen(true);
      return;
    }
    navigate(path);
  };

  useEffect(() => {
    // Debounce scroll handler
    let timeoutId: NodeJS.Timeout;
    const handleScroll = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        const scrollTop = window.scrollY;
        setIsScrolled(scrollTop > 50);
      }, 100); // 100ms debounce
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await apiClient.get('/universities', {
          signal: controller.signal
        });
        if (mounted) {
          const rows = Array.isArray(res.data) ? res.data : [];
          const active = rows.filter((u: any) => (u.status || 'active') === 'active');
          setPartnerUniversities(active);
        }
      } catch (err) {
        // Ignore AbortError
        if (err.name !== 'AbortError') {
          console.error('Failed to fetch universities:', err);
        }
      }
    })();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  return (
    <div className="bg-white text-slate-800 antialiased min-h-screen flex flex-col"> {/* Added antialiased for smoother fonts */}
      <header className={`relative py-3 px-4 sm:px-6 md:px-10 sticky top-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? 'bg-white/80 backdrop-blur-md border-b border-slate-200/50 shadow-lg' 
          : 'bg-white/95 backdrop-blur-lg border-b border-slate-200/60 shadow-md'
      }`}>
        {/* Subtle gradient overlay */}
        <div className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${
          isScrolled ? 'bg-gradient-to-r from-sky-50/20 via-transparent to-indigo-50/20 opacity-50' : 'bg-gradient-to-r from-sky-50/30 via-transparent to-indigo-50/30'
        }`}></div>
        
        <div className="max-w-7xl mx-auto flex items-center justify-between relative">
          {/* Logo and Brand Section */}
          <div className="flex items-center group cursor-pointer space-x-3" onClick={() => navigate('/LandingPage')}>
            <Logo className="h-10 sm:h-12 md:h-14 lg:h-16 w-auto transition-all duration-300" />
            <div className="flex flex-col">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-sky-600 to-indigo-600 bg-clip-text text-transparent">
                TutorLink
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 font-medium hidden sm:block">
                Connecting Minds, Building Futures
              </p>
            </div>
          </div>
          
          {/* Navigation Menu */}
          <nav className="hidden md:flex items-center space-x-6">
            <a 
              href="#how-it-works" 
              className={`${activeSection === 'how-it-works' ? 'text-sky-600' : 'text-slate-600'} hover:text-sky-600 transition-all duration-200 font-medium text-sm relative group focus:outline-none focus:ring-0`}
              onClick={(e) => {
                e.preventDefault();
                setActiveSection('how-it-works');
                document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              How It Works
              <span className={`absolute bottom-0 left-0 h-0.5 bg-sky-600 transition-all duration-200 ${activeSection === 'how-it-works' ? 'w-full' : 'w-0 group-hover:w-full'}`}></span>
            </a>
            <a 
              href="#features" 
              className={`${activeSection === 'features' ? 'text-sky-600' : 'text-slate-600'} hover:text-sky-600 transition-all duration-200 font-medium text-sm relative group focus:outline-none focus:ring-0`}
              onClick={(e) => {
                e.preventDefault();
                setActiveSection('features');
                document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Features
              <span className={`absolute bottom-0 left-0 h-0.5 bg-sky-600 transition-all duration-200 ${activeSection === 'features' ? 'w-full' : 'w-0 group-hover:w-full'}`}></span>
            </a>
            <a 
              href="#contact" 
              className={`${activeSection === 'contact' ? 'text-sky-600' : 'text-slate-600'} hover:text-sky-600 transition-all duration-200 font-medium text-sm relative group focus:outline-none focus:ring-0`}
              onClick={(e) => {
                e.preventDefault();
                setActiveSection('contact');
                document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Contact
              <span className={`absolute bottom-0 left-0 h-0.5 bg-sky-600 transition-all duration-200 ${activeSection === 'contact' ? 'w-full' : 'w-0 group-hover:w-full'}`}></span>
            </a>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            <button 
              className="hidden sm:block text-slate-600 hover:text-sky-600 transition-colors duration-200 font-medium text-sm"
              onClick={() => navigate('/login')}
            >
              Login
            </button>
            <button 
              className="bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
              onClick={() => setIsModalOpen(true)}
            >
              Get Started
            </button>
            
            {/* Mobile Menu Button */}
            <button
              aria-label="Toggle menu"
              className="md:hidden p-2 text-slate-700 hover:text-sky-600 transition-colors duration-200"
              onClick={() => setIsMobileMenuOpen((v) => !v)}
            >
              {isMobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white/95 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-4 py-3 space-y-2">
              <button
                className={`block w-full text-left ${activeSection === 'how-it-works' ? 'text-sky-600' : 'text-slate-700'} hover:text-sky-600 py-2 relative group focus:outline-none focus:ring-0`}
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setActiveSection('how-it-works');
                  document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                How It Works
                <span className={`absolute bottom-1 left-0 h-0.5 bg-sky-600 transition-all duration-200 ${activeSection === 'how-it-works' ? 'w-full' : 'w-0 group-hover:w-full'}`}></span>
              </button>
              <button
                className={`block w-full text-left ${activeSection === 'features' ? 'text-sky-600' : 'text-slate-700'} hover:text-sky-600 py-2 relative group focus:outline-none focus:ring-0`}
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setActiveSection('features');
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Features
                <span className={`absolute bottom-1 left-0 h-0.5 bg-sky-600 transition-all duration-200 ${activeSection === 'features' ? 'w-full' : 'w-0 group-hover:w-full'}`}></span>
              </button>
              <button
                className={`block w-full text-left ${activeSection === 'contact' ? 'text-sky-600' : 'text-slate-700'} hover:text-sky-600 py-2 relative group focus:outline-none focus:ring-0`}
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setActiveSection('contact');
                  document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Contact
                <span className={`absolute bottom-1 left-0 h-0.5 bg-sky-600 transition-all duration-200 ${activeSection === 'contact' ? 'w-full' : 'w-0 group-hover:w-full'}`}></span>
              </button>
              <div className="pt-2">
                <button 
                  className="w-full text-slate-700 hover:text-sky-600 font-medium py-2 transition-colors duration-200"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    navigate('/login');
                  }}
                >
                  Login
                </button>
                <button 
                  className="mt-2 w-full bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsModalOpen(true);
                  }}
                >
                  Get Started
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Subtle gradient overlay for modern effect */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-sky-100 blur-3xl"></div>
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-indigo-100 blur-3xl"></div>
          <div className="px-3 sm:px-5 md:px-8 lg:px-16 py-6 md:py-10 xl:py-14 grid md:grid-cols-2 gap-8 md:gap-16 items-center min-h-[72vh] max-w-7xl mx-auto w-full">
          <div className="hero-text text-center md:text-left space-y-6">
            <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-extrabold text-slate-900 leading-tight break-words">
              Connecting Students with <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-indigo-600">Tutors</span> <br className="hidden sm:inline" /> for Success.
            </h1>
            <p className="mt-4 md:mt-6 text-base sm:text-lg md:text-xl text-slate-600 max-w-lg mx-auto md:mx-0 leading-relaxed">
              Find the perfect local tutor to help you excel in any subject. Personalized learning, simplified.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 lg:gap-8 mt-7 md:mt-10">
              <button 
                className="bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-bold py-3.5 px-10 rounded-xl shadow-lg hover:from-sky-700 hover:to-indigo-700 transition-all duration-300 text-lg sm:text-xl transform hover:-translate-y-1 hover:shadow-2xl"
                onClick={() => setIsModalOpen(true)}
              >
                Get Started Today
              </button>
              <button 
                className="border-2 border-sky-600 text-sky-600 font-bold py-3.5 px-10 rounded-xl hover:bg-sky-600 hover:text-white transition-all duration-300 text-lg sm:text-xl transform hover:-translate-y-1"
                onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Learn More
              </button>
            </div>
          </div>
          <div className="hero-image aspect-[1.3/1] h-56 xs:h-72 sm:h-80 md:h-96 lg:h-[520px] rounded-2xl overflow-hidden relative shadow-2xl border-4 border-white w-full max-w-[640px] mx-auto md:mx-0">
            <HeroImageSlider />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
          </div>
          </div>
        </section>

        {/* Partnered institutions */}
        <section className="px-3 sm:px-8 md:px-16 py-10 md:py-14 w-full">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-6">Partnered institutions</h2>
            {partnerUniversities.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
                {partnerUniversities.map((u) => (
                  <div key={u.university_id} className="flex flex-col items-center justify-between bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow min-h-[150px]">
                    <div className="flex items-center justify-center h-20 w-20 rounded-full bg-white border border-slate-200 shadow-sm overflow-hidden mb-3">
                      {u.logo_url ? (
                        <img src={getFileUrl(u.logo_url)} alt={u.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full bg-slate-100" />
                      )}
                    </div>
                    <span className="font-sans text-[13px] sm:text-sm text-slate-800 text-center leading-snug" style={{ wordBreak: 'break-word' }} title={u.name}>{u.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500">No partners yet.</p>
            )}
          </div>
        </section>

        {/* Features Section (with live stats) */}
        <section id="features" className="relative bg-gradient-to-br from-slate-50 to-blue-50 px-3 sm:px-8 md:px-12 lg:px-20 py-14 md:py-20 xl:py-28 w-full">
          <div className="pointer-events-none absolute top-8 right-8 h-28 w-28 rounded-full bg-sky-100 blur-3xl"></div>
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">Powerful Features for Everyone</h2>
              <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">Whether you're a student seeking help or a tutor sharing knowledge, TutorLink provides all the tools you need for successful learning.</p>
            </div>

            {/* Live Stats from DB */}
            <div className="overflow-x-auto"><LiveStats /></div>

            {/* Student Features */}
            <div className="mb-20">
              <div className="text-center mb-12">
                <h3 className="text-3xl font-bold text-sky-600 mb-4">For Students</h3>
                <p className="text-lg text-slate-600">Everything you need to find the perfect tutor and excel in your studies</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-200 hover:shadow-xl transition-all duration-300 group">
                  <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-sky-200 transition-colors">
                    <svg className="w-6 h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h4 className="text-xl font-bold text-slate-800 mb-3">Easy Registration</h4>
                  <p className="text-slate-600 leading-relaxed">Quick signup with university email verification. Enter your course and year level to get started.</p>
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-200 hover:shadow-xl transition-all duration-300 group">
                  <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-sky-200 transition-colors">
                    <svg className="w-6 h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <h4 className="text-xl font-bold text-slate-800 mb-3">Smart Tutor Matching</h4>
                  <p className="text-slate-600 leading-relaxed">Browse tutors filtered by your course subjects. View profiles, ratings, and availability.</p>
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-200 hover:shadow-xl transition-all duration-300 group">
                  <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-sky-200 transition-colors">
                    <svg className="w-6 h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h4 className="text-xl font-bold text-slate-800 mb-3">Easy Booking</h4>
                  <p className="text-slate-600 leading-relaxed">Book sessions with your preferred tutors. Simple scheduling and session management.</p>
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-200 hover:shadow-xl transition-all duration-300 group">
                  <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-sky-200 transition-colors">
                    <svg className="w-6 h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <h4 className="text-xl font-bold text-slate-800 mb-3">Secure Payments</h4>
                  <p className="text-slate-600 leading-relaxed">Pay via GCash with secure payment proof upload. Session confirmed after tutor approval.</p>
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-200 hover:shadow-xl transition-all duration-300 group">
                  <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-sky-200 transition-colors">
                    <svg className="w-6 h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </div>
                  <h4 className="text-xl font-bold text-slate-800 mb-3">Rate & Review</h4>
                  <p className="text-slate-600 leading-relaxed">Leave feedback after sessions. Help other students find the best tutors.</p>
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-200 hover:shadow-xl transition-all duration-300 group">
                  <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-sky-200 transition-colors">
                    <svg className="w-6 h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <h4 className="text-xl font-bold text-slate-800 mb-3">Become a Tutor</h4>
                  <p className="text-slate-600 leading-relaxed">Apply to become a tutor. Share your knowledge and earn money helping others.</p>
                </div>
              </div>
            </div>

            {/* Tutor Features */}
            <div className="mb-20">
              <div className="text-center mb-12">
                <h3 className="text-3xl font-bold text-indigo-600 mb-4">For Tutors</h3>
                <p className="text-lg text-slate-600">Share your expertise and build a successful tutoring business</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-100 hover:shadow-xl transition-all duration-300 group">
                  <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-indigo-200 transition-colors">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h4 className="text-xl font-bold text-slate-800 mb-3">Easy Application</h4>
                  <p className="text-slate-600 leading-relaxed">Apply with your subjects of expertise and upload supporting documents for verification.</p>
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-100 hover:shadow-xl transition-all duration-300 group">
                  <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-indigo-200 transition-colors">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h4 className="text-xl font-bold text-slate-800 mb-3">Profile Management</h4>
                  <p className="text-slate-600 leading-relaxed">Create a compelling profile with bio, subjects, and GCash payment details.</p>
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-100 hover:shadow-xl transition-all duration-300 group">
                  <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-indigo-200 transition-colors">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h4 className="text-xl font-bold text-slate-800 mb-3">Flexible Scheduling</h4>
                  <p className="text-slate-600 leading-relaxed">Set your weekly availability with custom time slots for each day.</p>
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-100 hover:shadow-xl transition-all duration-300 group">
                  <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-indigo-200 transition-colors">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <h4 className="text-xl font-bold text-slate-800 mb-3">Session Management</h4>
                  <p className="text-slate-600 leading-relaxed">Receive booking requests, accept/decline, and manage session confirmations.</p>
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-100 hover:shadow-xl transition-all duration-300 group">
                  <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-indigo-200 transition-colors">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h4 className="text-xl font-bold text-slate-800 mb-3">Earnings Tracking</h4>
                  <p className="text-slate-600 leading-relaxed">Track your earnings, view completed sessions, and monitor payment status.</p>
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-100 hover:shadow-xl transition-all duration-300 group">
                  <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-indigo-200 transition-colors">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </div>
                  <h4 className="text-xl font-bold text-slate-800 mb-3">Build Reputation</h4>
                  <p className="text-slate-600 leading-relaxed">Earn ratings and reviews from students to build your tutoring reputation.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="bg-white px-3 sm:px-8 md:px-16 py-14 md:py-20 xl:py-28 w-full">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">How It Works</h2>
              <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">Getting academic help is easier than ever. Follow these simple steps to connect with your ideal tutor.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
              <div className="text-center p-8 bg-gradient-to-br from-sky-50 to-blue-50 rounded-2xl shadow-lg border border-sky-100 transform hover:scale-105 transition-all duration-300 group">
                <div className="flex items-center justify-center h-20 w-20 rounded-full bg-gradient-to-br from-sky-500 to-sky-600 text-white mx-auto mb-6 shadow-lg group-hover:shadow-xl transition-shadow">
                  <MagnifyingGlassIcon className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-4">1. Find a Tutor</h3>
                <p className="text-slate-600 leading-relaxed">Search our diverse network of qualified tutors by subject, location, and availability.</p>
              </div>
              <div className="text-center p-8 bg-gradient-to-br from-sky-50 to-blue-50 rounded-2xl shadow-lg border border-sky-100 transform hover:scale-105 transition-all duration-300 group">
                <div className="flex items-center justify-center h-20 w-20 rounded-full bg-gradient-to-br from-sky-500 to-sky-600 text-white mx-auto mb-6 shadow-lg group-hover:shadow-xl transition-shadow">
                  <LinkIcon className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-4">2. Connect & Book</h3>
                <p className="text-slate-600 leading-relaxed">Message tutors directly to discuss your needs and easily schedule your first session.</p>
              </div>
              <div className="text-center p-8 bg-gradient-to-br from-sky-50 to-blue-50 rounded-2xl shadow-lg border border-sky-100 transform hover:scale-105 transition-all duration-300 group">
                <div className="flex items-center justify-center h-20 w-20 rounded-full bg-gradient-to-br from-sky-500 to-sky-600 text-white mx-auto mb-6 shadow-lg group-hover:shadow-xl transition-shadow">
                  <LightbulbIcon className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-4">3. Get Expert Help</h3>
                <p className="text-slate-600 leading-relaxed">Start learning from experienced educators and watch your grades and confidence soar!</p>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="bg-gradient-to-br from-slate-900 to-slate-800 px-3 sm:px-8 md:px-16 py-14 md:py-20 xl:py-28 w-full">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">Get in Touch</h2>
              <p className="text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">Have questions? We're here to help you succeed in your academic journey.</p>
            </div>
            
            <div className="max-w-3xl mx-auto">
              {/* Contact Info Card */}
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 shadow-xl space-y-8">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-sky-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Email Support</h3>
                    <p className="text-slate-300">darkages38@gmail.com</p>
                    <p className="text-slate-400 text-sm">We'll respond within 24 hours</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-sky-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Business Hours</h3>
                    <p className="text-slate-300">Monday - Friday: 9:00 AM - 6:00 PM</p>
                    <p className="text-slate-300">Saturday: 10:00 AM - 4:00 PM</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-sky-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Location</h3>
                    <p className="text-slate-300">Philippines</p>
                    <p className="text-slate-400 text-sm">Serving universities nationwide</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-300 py-8 sm:py-12 px-3 sm:px-8 overflow-hidden w-full mt-auto">
        {/* Background pattern overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-sky-900/10 via-transparent to-indigo-900/10 pointer-events-none"></div>
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-sky-500/30 to-transparent"></div>
        <div className="max-w-6xl mx-auto relative">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 mb-6 sm:mb-8">
            <div>
              <div className="flex items-center mb-4 space-x-3">
                <Logo className="h-14 w-14 object-contain" style={{aspectRatio: '1/1'}} />
                <div className="flex flex-col">
                  <h3 className="text-xl font-bold text-white mb-1">TutorLink</h3>
                  <p className="text-sm text-sky-300 font-medium">Connecting Minds, Building Futures</p>
                </div>
              </div>
              <p className="text-slate-400 leading-relaxed text-base">Connecting students with qualified tutors for academic success. Empowering learners and educators to achieve their goals together through personalized learning experiences.</p>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold text-white mb-4">For Students</h4>
              <ul className="space-y-2">
                <li><span className="text-slate-400 hover:text-sky-400 transition-colors cursor-default">Find Tutors</span></li>
                <li><span className="text-slate-400 hover:text-sky-400 transition-colors cursor-default">Book Sessions</span></li>
                <li><span className="text-slate-400 hover:text-sky-400 transition-colors cursor-default">Payment Guide</span></li>
                <li><span className="text-slate-400 hover:text-sky-400 transition-colors cursor-default">Help Center</span></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold text-white mb-4">For Tutors</h4>
              <ul className="space-y-2">
                <li><span className="text-slate-400 hover:text-sky-400 transition-colors cursor-default">Apply to Teach</span></li>
                <li><span className="text-slate-400 hover:text-sky-400 transition-colors cursor-default">Tutor Resources</span></li>
                <li><span className="text-slate-400 hover:text-sky-400 transition-colors cursor-default">Earnings</span></li>
                <li><span className="text-slate-400 hover:text-sky-400 transition-colors cursor-default">Support</span></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2">
                <li className="w-max">
                  <button type="button" onClick={() => setAboutOpen(true)} className="text-left text-slate-400 hover:text-sky-400 transition-colors">About Us</button>
                </li>
                <li className="w-max">
                  <button type="button" onClick={() => setPrivacyOpen(true)} className="text-left text-slate-400 hover:text-sky-400 transition-colors">Privacy Policy</button>
                </li>
                <li className="w-max">
                  <button type="button" onClick={() => setTermsOpen(true)} className="text-left text-slate-400 hover:text-sky-400 transition-colors">Terms of Service</button>
                </li>
                <li className="relative group w-max">
                  <button
                    type="button"
                    onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
                    className="text-left text-slate-400 hover:text-sky-400 transition-colors"
                  >
                    Contact
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* About Us Modal */}
          <Modal isOpen={aboutOpen} onClose={() => setAboutOpen(false)} title="About TutorLink">
            <div className="space-y-4 text-slate-700">
              <p>
                TutorLink connects university students with verified local tutors for one‑on‑one learning.
                We focus on transparent profiles, simple booking, and secure confirmations so students
                can learn confidently and tutors can grow sustainable careers.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Student‑first experience: relevant subjects, clear rates, and reviews</li>
                <li>Verified tutors from Philippine universities and communities</li>
                <li>Fast communication and reliable scheduling tools</li>
              </ul>
            </div>
          </Modal>

          {/* Privacy Policy Modal */}
          <Modal isOpen={privacyOpen} onClose={() => setPrivacyOpen(false)} title="Privacy Policy">
            <div className="space-y-4 text-slate-700">
              <p>
                We comply with the Data Privacy Act of 2012 (Republic Act No. 10173) and process
                personal data lawfully and transparently. This summary explains how we collect,
                use, and protect information for tutor/tutee services.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  Data we collect: account details (name, email), university/course info, tutor profiles,
                  booking and payment confirmations, and support communications.
                </li>
                <li>
                  Purpose: enable registration, matching, booking, messaging, payment validation,
                  and safety monitoring.
                </li>
                <li>
                  Rights: you may access, correct, or request deletion of your data; you may also
                  withdraw consent subject to legal/operational requirements.
                </li>
                <li>
                  Security: we apply appropriate organizational and technical safeguards and limit access
                  to authorized personnel only.
                </li>
                <li>
                  Retention: we retain data only as long as needed for services and legal obligations.
                </li>
                <li>
                  Third parties: we share data only with processors essential to our services (e.g., hosting,
                  email) under confidentiality and DPA‑compliant agreements.
                </li>
                <li>
                  Contact: for privacy requests or concerns, email <span className="font-medium">darkages38@gmail.com</span>.
                </li>
              </ul>
            </div>
          </Modal>

          {/* Terms of Service Modal */}
          <Modal isOpen={termsOpen} onClose={() => setTermsOpen(false)} title="Terms of Service">
            <div className="space-y-4 text-slate-700">
              <p>
                By using TutorLink, you agree to these terms. If you do not agree, please do not use the service.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Accounts: provide accurate information and keep your credentials secure.</li>
                <li>Bookings and Payments: follow the posted process; submit valid proofs when required.</li>
                <li>Conduct: be respectful; no harassment, fraud, or academic dishonesty.</li>
                <li>
                  Content: reviews and profiles must be truthful and may be moderated to ensure platform safety.
                </li>
                <li>
                  Liability: TutorLink facilitates connections; session outcomes remain between tutors and students
                  subject to applicable law.
                </li>
                <li>
                  Changes: we may update these terms and will indicate the effective date; continued use means acceptance.
                </li>
                <li>Contact: questions about these terms? Email us at <span className="font-medium">darkages38@gmail.com</span>.</li>
              </ul>
            </div>
          </Modal>
          
          <div className="border-t border-gradient-to-r from-transparent via-slate-600 to-transparent pt-7 sm:pt-10 text-center relative">
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-24 h-px bg-gradient-to-r from-transparent via-sky-500 to-transparent"></div>
            <p className="text-slate-400 text-base font-medium">&copy; {new Date().getFullYear()} TutorLink. All rights reserved.</p>
            <p className="text-slate-500 text-sm mt-2">Empowering education through technology</p>
          </div>
        </div>
      </footer>
      
      <RoleSelectionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onNavigate={handleNavigate} />
            {isTutorModalOpen && <TutorRegistrationModal 
        key={`tutor-${tutorModalKey}`}
        isOpen={true} 
        onClose={() => {
          setIsTutorModalOpen(false);
          setTutorModalKey(k => k + 1);
        }} 
      />}
      {isTuteeModalOpen && <TuteeRegistrationModal 
        key={`tutee-${tuteeModalKey}`}
        isOpen={true} 
        onClose={() => {
          setIsTuteeModalOpen(false);
          setTuteeModalKey(k => k + 1);
        }}
      />}
    </div>
  );
};

export default LandingPage;