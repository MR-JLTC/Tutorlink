import React from 'react';
import TutorSidebar from './TutorSidebar';
import TutorHeader from './TutorHeader';
import { VerificationProvider } from '../../context/VerificationContext';
import { NotificationProvider } from '../../context/NotificationContext';

interface TutorLayoutProps {
  children: React.ReactNode;
}

const TutorLayout: React.FC<TutorLayoutProps> = ({ children }) => {
  return (
    <VerificationProvider>
      <NotificationProvider>
        <div className="flex h-screen bg-slate-50">
          <div className="hidden md:flex"><TutorSidebar /></div>
          <div className="flex-1 flex flex-col min-h-0">
            <TutorHeader />
            <main className="flex-1 overflow-y-auto bg-slate-50">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
                {children}
              </div>
            </main>
          </div>
        </div>
      </NotificationProvider>
    </VerificationProvider>
  );
};

export default TutorLayout;
