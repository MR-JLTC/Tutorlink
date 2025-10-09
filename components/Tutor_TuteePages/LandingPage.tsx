import React, { useState, useEffect } from 'react';
import { Page } from '../../types'; // Ensure Page enum is correctly defined
import { AcademicCapIcon } from '../../components/icons/AcademicCapIcon';
import { UserCircleIcon } from '../../components/icons/UserCircleIcon';
import Logo from '../../components/Logo';

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


const slides = [
    { 
        src: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?q=80&w=2070&auto=format&fit=crop',
        alt: 'A tutor helping a student with a laptop in a well-lit room.' 
    },
    { 
        src: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=2070&auto=format&fit=crop',
        alt: 'A diverse group of young students studying together around a table.' 
    },
    { 
        src: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=2070&auto=format&fit=crop',
        alt: 'Students in a university lecture hall, focused on learning.' 
    },
    { 
        src: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?q=80&w=2070&auto=format&fit=crop',
        alt: 'A female student smiling and raising her hand in a classroom setting.' 
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

const RoleSelectionModal: React.FC<{ isOpen: boolean; onClose: () => void; onNavigate: (page: Page) => void; }> = ({ isOpen, onClose, onNavigate }) => {
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
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 transition-opacity" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="bg-white rounded-2xl shadow-2xl p-8 m-4 max-w-3xl w-full flex flex-col md:flex-row gap-8" onClick={e => e.stopPropagation()}>
          <div 
            role="button"
            tabIndex={0}
            className="flex-1 p-8 rounded-xl border-2 border-slate-200 hover:border-sky-500 hover:bg-sky-50 transition-all duration-300 cursor-pointer flex flex-col items-center text-center focus:outline-none focus:ring-2 focus:ring-sky-500"
            onClick={() => onNavigate(Page.TuteeRegister)}
            onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') onNavigate(Page.TuteeRegister)}}
          >
            <div className="flex items-center justify-center h-16 w-16 rounded-full bg-sky-500 text-white mb-4">
              <UserCircleIcon className="w-8 h-8" />
            </div>
            <h3 id="modal-title" className="text-2xl font-bold text-slate-800">I'm a Student</h3>
            <p className="mt-2 text-slate-600">Find a tutor to help you achieve your academic goals.</p>
          </div>
          <div 
            role="button"
            tabIndex={0}
            className="flex-1 p-8 rounded-xl border-2 border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all duration-300 cursor-pointer flex flex-col items-center text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onClick={() => onNavigate(Page.TutorRegister)}
            onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') onNavigate(Page.TutorRegister)}}
          >
            <div className="flex items-center justify-center h-16 w-16 rounded-full bg-indigo-500 text-white mb-4">
              <AcademicCapIcon className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800">I'm a Tutor</h3>
            <p className="mt-2 text-slate-600">Share your knowledge, help students, and earn money.</p>
          </div>
        </div>
      </div>
    );
};


interface LandingPageProps {
  onNavigate: (page: Page) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="bg-white text-slate-800 antialiased"> {/* Added antialiased for smoother fonts */}
      <header className="py-4 px-6 sm:px-8 md:px-16 border-b border-slate-200 flex justify-between items-center">
        <Logo className="h-10 sm:h-12 md:h-14 w-auto" />
        
        {/* Navigation - Hidden on mobile, visible on medium screens and up */}
        <nav className="hidden md:flex space-x-8">
            {/* Example Nav Links - Uncomment and adjust as needed */}
            {/* 
            <a href="#" className="text-slate-600 hover:text-sky-600 transition-colors duration-200 font-medium">Features</a>
            <a href="#" className="text-slate-600 hover:text-sky-600 transition-colors duration-200 font-medium">How It Works</a>
            <a href="#" className="text-slate-600 hover:text-sky-600 transition-colors duration-200 font-medium">Pricing</a>
            */}
        </nav>

        {/* Action Buttons */}
        {/* <div className="flex items-center space-x-4">
            <button 
                className="text-slate-600 hover:text-sky-600 transition-colors duration-200 font-medium text-base sm:text-lg"
                onClick={() => onNavigate(Page.Login)} // Assuming a Login page exists in your Page enum
            >
                Login
            </button>
            <button 
                className="bg-sky-600 text-white font-bold py-2.5 px-6 rounded-lg shadow-md hover:bg-sky-700 transition-all duration-300 text-base sm:text-lg"
                onClick={() => setIsModalOpen(true)}
            >
                Sign Up
            </button>
        </div> */}

        {/* Future: Hamburger Menu for mobile nav could go here */}
      </header>

      <main>
        {/* Hero Section */}
        <section className="px-6 sm:px-8 md:px-16 py-16 md:py-24 grid md:grid-cols-2 gap-12 md:gap-16 items-center">
          <div className="hero-text text-center md:text-left">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-slate-900 leading-tight">
              Connecting Students with Tutors <br className="hidden sm:inline" /> for Success.
            </h1>
            <p className="mt-6 text-lg md:text-xl text-slate-600 max-w-lg mx-auto md:mx-0 leading-relaxed">
              Find the perfect local tutor to help you excel in any subject. Personalized learning, simplified.
            </p>
            <button 
              className="mt-10 bg-sky-600 text-white font-bold py-3.5 px-10 rounded-lg shadow-xl hover:bg-sky-700 transition-all duration-300 text-lg sm:text-xl transform hover:-translate-y-1"
              onClick={() => setIsModalOpen(true)}
            >
              Get Started Today
            </button>
          </div>
          <div className="hero-image h-64 sm:h-80 md:h-96 rounded-2xl overflow-hidden relative shadow-xl"> {/* Added shadow to image */}
            <HeroImageSlider />
          </div>
        </section>

        {/* How It Works Section */}
        <section className="bg-slate-50 px-6 sm:px-8 md:px-16 py-16 md:py-24">
          <div className="text-center max-w-4xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">How It Works</h2>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">Getting academic help is easier than ever. Follow these simple steps to connect with your ideal tutor.</p>
          </div>
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="step-card text-center p-8 bg-white rounded-2xl shadow-lg border border-slate-100 transform hover:scale-105 transition-transform duration-300">
              <div className="flex items-center justify-center h-16 w-16 rounded-full bg-sky-100 text-sky-600 mx-auto mb-6 shadow-md">
                <MagnifyingGlassIcon className="w-8 h-8" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-800">1. Find a Tutor</h3>
              <p className="mt-2 text-slate-600 leading-relaxed">Search our diverse network of qualified tutors by subject, location, and availability.</p>
            </div>
            <div className="step-card text-center p-8 bg-white rounded-2xl shadow-lg border border-slate-100 transform hover:scale-105 transition-transform duration-300">
              <div className="flex items-center justify-center h-16 w-16 rounded-full bg-sky-100 text-sky-600 mx-auto mb-6 shadow-md">
                <LinkIcon className="w-8 h-8" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-800">2. Connect & Book</h3>
              <p className="mt-2 text-slate-600 leading-relaxed">Message tutors directly to discuss your needs and easily schedule your first session.</p>
            </div>
            <div className="step-card text-center p-8 bg-white rounded-2xl shadow-lg border border-slate-100 transform hover:scale-105 transition-transform duration-300">
              <div className="flex items-center justify-center h-16 w-16 rounded-full bg-sky-100 text-sky-600 mx-auto mb-6 shadow-md">
                <LightbulbIcon className="w-8 h-8" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-800">3. Get Expert Help</h3>
              <p className="mt-2 text-slate-600 leading-relaxed">Start learning from experienced educators and watch your grades and confidence soar!</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="text-center text-slate-500 py-12 px-8 border-t border-slate-200">
        <p>&copy; {new Date().getFullYear()} TutorLink. All rights reserved.</p>
      </footer>
      
      <RoleSelectionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onNavigate={onNavigate} />
    </div>
  );
};

export default LandingPage;