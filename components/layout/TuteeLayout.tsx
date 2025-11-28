import React, { useState, useEffect } from 'react';
import TuteeSidebar from './TuteeSidebar';
import TuteeHeader from './TuteeHeader';
import { NotificationProvider } from '../../context/NotificationContext';
import { X } from 'lucide-react';

interface TuteeLayoutProps {
  children: React.ReactNode;
}

const TuteeLayout: React.FC<TuteeLayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu on window resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  return (
    <NotificationProvider>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden md:flex"><TuteeSidebar /></div>
        
        {/* Mobile Sidebar */}
        <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 md:hidden transform transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200 bg-white">
            <h2 className="text-lg font-bold text-slate-800">Menu</h2>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 rounded-md text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
              aria-label="Close menu"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="overflow-y-auto h-[calc(100vh-4rem)]">
            <TuteeSidebar />
          </div>
        </div>
        
        {/* Mobile Overlay */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
        
        <div className="flex-1 flex flex-col min-h-0">
          <TuteeHeader onMenuClick={() => setIsMobileMenuOpen(true)} />
          <main className="flex-1 overflow-y-auto bg-slate-50">
            <div className="max-w-7xl mx-auto px-2 sm:px-3 md:px-4 lg:px-6 pt-1 sm:pt-1.5 md:pt-2 pb-3 sm:pb-4 md:pb-6 lg:pb-8 w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </NotificationProvider>
  );
};

export default TuteeLayout;
