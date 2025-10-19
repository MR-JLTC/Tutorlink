import React from 'react';
import TutorSidebar from './TutorSidebar';
import TutorHeader from './TutorHeader';
import { VerificationProvider } from '../../context/VerificationContext';

interface TutorLayoutProps {
  children: React.ReactNode;
}

const TutorLayout: React.FC<TutorLayoutProps> = ({ children }) => {
  return (
    <VerificationProvider>
      <div className="flex h-screen bg-slate-50">
        <TutorSidebar />
        <div className="flex-1 flex flex-col min-h-0">
          <TutorHeader />
          <main className="flex-1 overflow-y-auto bg-slate-50">
            <div className="max-w-7xl mx-auto px-6 py-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </VerificationProvider>
  );
};

export default TutorLayout;
