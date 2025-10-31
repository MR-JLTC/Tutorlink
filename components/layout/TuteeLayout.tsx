import React from 'react';
import TuteeSidebar from './TuteeSidebar';
import TuteeHeader from './TuteeHeader';

interface TuteeLayoutProps {
  children: React.ReactNode;
}

const TuteeLayout: React.FC<TuteeLayoutProps> = ({ children }) => {
  return (
    <div className="flex h-screen bg-slate-50">
      <div className="hidden md:flex"><TuteeSidebar /></div>
      <div className="flex-1 flex flex-col min-h-0">
        <TuteeHeader />
        <main className="flex-1 overflow-y-auto bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default TuteeLayout;
