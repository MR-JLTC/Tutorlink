import React from 'react';
import { GraduationCap } from 'lucide-react';
import TutorRegistrationPage from '../Tutor_TuteePages/TutorRegistrationPage';

const TuteeBecomeTutor: React.FC = () => {
  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 text-white shadow-lg -mx-2 sm:-mx-3 md:mx-0">
        <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
          <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 flex-shrink-0" />
          <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white">Become a Tutor</h1>
        </div>
        <p className="text-xs sm:text-sm md:text-base lg:text-lg text-blue-100/90 leading-relaxed">
          Turn your knowledge into impact and income. Share your expertise, help fellow students excel, and build your portfolio — all in one place.
        </p>
      </div>

      {/* Reuse the full Tutor Registration experience inside the tutee dashboard */}
      <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-slate-200 -mx-2 sm:-mx-3 md:mx-0 overflow-hidden">
        <TutorRegistrationPage />
      </div>
    </div>
  );
};

export default TuteeBecomeTutor;
